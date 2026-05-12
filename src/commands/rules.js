const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../database/db');
const { getGuildSettings, hasAdminRole, errorEmbed, successEmbed } = require('../utils/helpers');

const RULE_EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟', '📌', '📍', '🔹', '🔸', '⭐'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rules')
    .setDescription('Manage and post server rules')
    .addSubcommand(s => s
      .setName('add')
      .setDescription('Add a rule')
      .addIntegerOption(o => o.setName('number').setDescription('Rule number (1-50)').setRequired(true).setMinValue(1).setMaxValue(50))
      .addStringOption(o => o.setName('title').setDescription('Short rule title').setRequired(true).setMaxLength(80))
      .addStringOption(o => o.setName('description').setDescription('Full rule description').setRequired(true).setMaxLength(500))
      .addStringOption(o => o.setName('emoji').setDescription('Emoji for this rule (optional)').setRequired(false)))
    .addSubcommand(s => s
      .setName('remove')
      .setDescription('Remove a rule by number')
      .addIntegerOption(o => o.setName('number').setDescription('Rule number to remove').setRequired(true).setMinValue(1).setMaxValue(50)))
    .addSubcommand(s => s
      .setName('list')
      .setDescription('List all server rules publicly'))
    .addSubcommand(s => s
      .setName('post')
      .setDescription('Post the rules embed to a channel')
      .addChannelOption(o => o.setName('channel').setDescription('Channel to post to (defaults to configured rules channel)').setRequired(false)))
    .addSubcommand(s => s
      .setName('clear')
      .setDescription('Delete ALL rules for this server')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const settings = getGuildSettings(interaction.guild.id);

    // All subcommands except 'list' require admin
    if (sub !== 'list' && !hasAdminRole(interaction.member, settings)) {
      return interaction.reply({ embeds: [errorEmbed('You need admin permissions to manage rules.')], ephemeral: true });
    }

    if (sub === 'add') {
      const number = interaction.options.getInteger('number');
      const title = interaction.options.getString('title');
      const description = interaction.options.getString('description');
      const emoji = interaction.options.getString('emoji') || RULE_EMOJIS[number - 1] || '📌';
      db.prepare('INSERT OR REPLACE INTO guild_rules (guild_id, rule_number, emoji, title, description) VALUES (?, ?, ?, ?, ?)')
        .run(interaction.guild.id, number, emoji, title, description);
      return interaction.reply({
        embeds: [successEmbed(`Rule **#${number}** added!\n\n${emoji} **${title}**\n${description}`)],
        ephemeral: true
      });
    }

    if (sub === 'remove') {
      const number = interaction.options.getInteger('number');
      const existing = db.prepare('SELECT * FROM guild_rules WHERE guild_id = ? AND rule_number = ?').get(interaction.guild.id, number);
      if (!existing) return interaction.reply({ embeds: [errorEmbed(`Rule #${number} does not exist.`)], ephemeral: true });
      db.prepare('DELETE FROM guild_rules WHERE guild_id = ? AND rule_number = ?').run(interaction.guild.id, number);
      return interaction.reply({ embeds: [successEmbed(`Rule **#${number}** removed.`)], ephemeral: true });
    }

    if (sub === 'list') {
      const rules = db.prepare('SELECT * FROM guild_rules WHERE guild_id = ? ORDER BY rule_number ASC').all(interaction.guild.id);
      if (rules.length === 0) {
        return interaction.reply({ embeds: [errorEmbed('No rules set up yet. Use `/rules add` to add some.')], ephemeral: true });
      }

      // Send a public header message first
      const headerEmbed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle(`📜 ${interaction.guild.name} — Server Rules`)
        .setThumbnail(interaction.guild.iconURL({ dynamic: true, size: 256 }))
        .setDescription('Please read and follow all the rules below. 👇')
        .setTimestamp();

      await interaction.reply({ embeds: [headerEmbed] });

      // Send each rule as a separate public message
      for (const rule of rules) {
        const ruleEmbed = new EmbedBuilder()
          .setColor('#0099ff')
          .setTitle(`${rule.emoji} Rule ${rule.rule_number}: ${rule.title}`)
          .setDescription(rule.description);

        await interaction.followUp({ embeds: [ruleEmbed] });
      }

      // Send a footer message
      const footerEmbed = new EmbedBuilder()
        .setColor('#0099ff')
        .setDescription(`**${rules.length} rule(s) total** — Breaking rules may result in a mute or ban.`);

      return interaction.followUp({ embeds: [footerEmbed] });
    }

    if (sub === 'post') {
      const targetChannel = interaction.options.getChannel('channel')
        || (settings.rules_channel ? interaction.guild.channels.cache.get(settings.rules_channel) : null)
        || interaction.channel;

      const rules = db.prepare('SELECT * FROM guild_rules WHERE guild_id = ? ORDER BY rule_number ASC').all(interaction.guild.id);
      if (rules.length === 0) {
        return interaction.reply({ embeds: [errorEmbed('No rules to post! Use `/rules add` to add rules first.')], ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle(`📜 ${interaction.guild.name} — Server Rules`)
        .setThumbnail(interaction.guild.iconURL({ dynamic: true, size: 256 }))
        .setDescription('Welcome! Please read and follow the rules below to keep our community safe and fun for everyone. 🌟')
        .setTimestamp()
        .setFooter({ text: `${interaction.guild.name} • Breaking rules may result in mute/ban` });

      for (const rule of rules) {
        embed.addFields({
          name: `${rule.emoji} Rule ${rule.rule_number}: ${rule.title}`,
          value: rule.description,
        });
      }

      try {
        await targetChannel.send({ embeds: [embed] });
        return interaction.reply({ embeds: [successEmbed(`Rules posted to ${targetChannel}!`)], ephemeral: true });
      } catch {
        return interaction.reply({ embeds: [errorEmbed(`I can't send messages to ${targetChannel}. Check my permissions.`)], ephemeral: true });
      }
    }

    if (sub === 'clear') {
      const count = db.prepare('SELECT COUNT(*) as c FROM guild_rules WHERE guild_id = ?').get(interaction.guild.id).c;
      if (count === 0) return interaction.reply({ embeds: [errorEmbed('There are no rules to clear.')], ephemeral: true });
      db.prepare('DELETE FROM guild_rules WHERE guild_id = ?').run(interaction.guild.id);
      return interaction.reply({ embeds: [successEmbed(`All **${count}** rules have been cleared.`)], ephemeral: true });
    }
  }
};
