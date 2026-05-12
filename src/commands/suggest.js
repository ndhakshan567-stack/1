const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database/db');
const { getGuildSettings, hasModRole, hasAdminRole, errorEmbed, successEmbed } = require('../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('suggest')
    .setDescription('Submit or manage server suggestions')
    .addSubcommand(s => s
      .setName('submit')
      .setDescription('Submit a suggestion to the server')
      .addStringOption(o => o.setName('text').setDescription('Your suggestion').setRequired(true).setMaxLength(1000)))
    .addSubcommand(s => s
      .setName('accept')
      .setDescription('[Mod] Accept a suggestion')
      .addIntegerOption(o => o.setName('id').setDescription('Suggestion ID').setRequired(true))
      .addStringOption(o => o.setName('reason').setDescription('Reason for accepting (optional)').setRequired(false)))
    .addSubcommand(s => s
      .setName('deny')
      .setDescription('[Mod] Deny a suggestion')
      .addIntegerOption(o => o.setName('id').setDescription('Suggestion ID').setRequired(true))
      .addStringOption(o => o.setName('reason').setDescription('Reason for denying (optional)').setRequired(false)))
    .addSubcommand(s => s
      .setName('list')
      .setDescription('View pending suggestions')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const settings = getGuildSettings(interaction.guild.id);

    if (sub === 'submit') {
      if (!settings.suggestion_channel) {
        return interaction.reply({ embeds: [errorEmbed('No suggestion channel has been configured. Ask an admin to run `/admin setsuggestionchannel`.')], ephemeral: true });
      }

      const text = interaction.options.getString('text');
      const suggestChannel = interaction.guild.channels.cache.get(settings.suggestion_channel);

      if (!suggestChannel) {
        return interaction.reply({ embeds: [errorEmbed('The configured suggestion channel no longer exists. Please contact an admin.')], ephemeral: true });
      }

      const now = Date.now();
      const result = db.prepare('INSERT INTO suggestions (guild_id, user_id, suggestion, timestamp) VALUES (?, ?, ?, ?)').run(interaction.guild.id, interaction.user.id, text, now);
      const suggestionId = result.lastInsertRowid;

      const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle(`💡 Suggestion #${suggestionId}`)
        .setDescription(text)
        .addFields(
          { name: '👤 Submitted by', value: `${interaction.user} (${interaction.user.tag})`, inline: true },
          { name: '📊 Status', value: '⏳ Pending', inline: true },
        )
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: `ID: ${suggestionId} • React to vote!` })
        .setTimestamp();

      try {
        const posted = await suggestChannel.send({ embeds: [embed] });
        await posted.react('👍').catch(() => {});
        await posted.react('👎').catch(() => {});
        db.prepare('UPDATE suggestions SET message_id = ? WHERE id = ?').run(posted.id, suggestionId);

        return interaction.reply({ embeds: [successEmbed(`Your suggestion has been submitted! (ID: **#${suggestionId}**)\n\nCheck ${suggestChannel} to vote!`)], ephemeral: true });
      } catch {
        return interaction.reply({ embeds: [errorEmbed("Couldn't post your suggestion. I may not have permission to send messages in the suggestion channel.")], ephemeral: true });
      }
    }

    if (sub === 'accept' || sub === 'deny') {
      if (!hasModRole(interaction.member, settings)) {
        return interaction.reply({ embeds: [errorEmbed('You need moderator permissions to manage suggestions.')], ephemeral: true });
      }

      const id = interaction.options.getInteger('id');
      const reason = interaction.options.getString('reason') || 'No reason provided.';
      const row = db.prepare('SELECT * FROM suggestions WHERE id = ? AND guild_id = ?').get(id, interaction.guild.id);

      if (!row) return interaction.reply({ embeds: [errorEmbed(`Suggestion #${id} not found.`)], ephemeral: true });
      if (row.status !== 'pending') return interaction.reply({ embeds: [errorEmbed(`Suggestion #${id} has already been **${row.status}**.`)], ephemeral: true });

      const isAccept = sub === 'accept';
      const status = isAccept ? 'accepted' : 'denied';
      const statusEmoji = isAccept ? '✅' : '❌';
      const color = isAccept ? '#00ff00' : '#ff0000';

      db.prepare('UPDATE suggestions SET status = ?, response = ? WHERE id = ?').run(status, reason, id);

      // Update the original embed in suggestion channel
      if (row.message_id && settings.suggestion_channel) {
        try {
          const ch = interaction.guild.channels.cache.get(settings.suggestion_channel);
          if (ch) {
            const msg = await ch.messages.fetch(row.message_id).catch(() => null);
            if (msg) {
              const updatedEmbed = new EmbedBuilder()
                .setColor(color)
                .setTitle(`💡 Suggestion #${id} — ${statusEmoji} ${status.charAt(0).toUpperCase() + status.slice(1)}`)
                .setDescription(row.suggestion)
                .addFields(
                  { name: '👤 Submitted by', value: `<@${row.user_id}>`, inline: true },
                  { name: `${statusEmoji} ${status.charAt(0).toUpperCase() + status.slice(1)} by`, value: `${interaction.user.tag}`, inline: true },
                  { name: '📝 Reason', value: reason },
                )
                .setFooter({ text: `ID: ${id}` })
                .setTimestamp();
              await msg.edit({ embeds: [updatedEmbed] }).catch(() => {});
            }
          }
        } catch {}
      }

      // Notify the suggestion author via DM
      try {
        const author = await interaction.client.users.fetch(row.user_id).catch(() => null);
        if (author && !author.bot) {
          const dmEmbed = new EmbedBuilder()
            .setColor(color)
            .setTitle(`${statusEmoji} Your Suggestion was ${status.charAt(0).toUpperCase() + status.slice(1)}!`)
            .setDescription(`**Your suggestion:**\n${row.suggestion}`)
            .addFields(
              { name: '📝 Moderator Response', value: reason },
              { name: '🏠 Server', value: interaction.guild.name },
            )
            .setTimestamp();
          author.send({ embeds: [dmEmbed] }).catch(() => {});
        }
      } catch {}

      return interaction.reply({ embeds: [successEmbed(`Suggestion **#${id}** has been **${status}**.\n**Reason:** ${reason}`)] });
    }

    if (sub === 'list') {
      if (!hasModRole(interaction.member, settings)) {
        return interaction.reply({ embeds: [errorEmbed('You need moderator permissions to list suggestions.')], ephemeral: true });
      }

      const pending = db.prepare("SELECT * FROM suggestions WHERE guild_id = ? AND status = 'pending' ORDER BY id DESC LIMIT 15").all(interaction.guild.id);
      if (pending.length === 0) return interaction.reply({ embeds: [successEmbed('No pending suggestions right now! 🎉')], ephemeral: true });

      const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('💡 Pending Suggestions')
        .setDescription(pending.map(s => `**#${s.id}** — <@${s.user_id}>\n> ${s.suggestion.slice(0, 100)}${s.suggestion.length > 100 ? '...' : ''}`).join('\n\n'))
        .setFooter({ text: `${pending.length} pending suggestion(s) | Use /suggest accept/deny <id>` })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
};
