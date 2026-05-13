const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../database/db');
const { getGuildSettings, hasModRole, hasAdminRole, errorEmbed, successEmbed } = require('../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mod')
    .setDescription('Moderation commands')
    .addSubcommand(s => s.setName('warn').setDescription('Warn a user')
      .addUserOption(o => o.setName('user').setDescription('User to warn').setRequired(true))
      .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(true)))
    .addSubcommand(s => s.setName('kick').setDescription('Kick a user')
      .addUserOption(o => o.setName('user').setDescription('User to kick').setRequired(true))
      .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false)))
    .addSubcommand(s => s.setName('ban').setDescription('Ban a user')
      .addUserOption(o => o.setName('user').setDescription('User to ban').setRequired(true))
      .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false)))
    .addSubcommand(s => s.setName('unban').setDescription('Unban a user by ID')
      .addStringOption(o => o.setName('userid').setDescription('User ID').setRequired(true)))
    .addSubcommand(s => s.setName('warnings').setDescription('View warnings for a user')
      .addUserOption(o => o.setName('user').setDescription('User').setRequired(true)))
    .addSubcommand(s => s.setName('clearwarnings').setDescription('Clear all warnings for a user')
      .addUserOption(o => o.setName('user').setDescription('User').setRequired(true)))
    .addSubcommand(s => s.setName('mute').setDescription('Timeout a user')
      .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
      .addIntegerOption(o => o.setName('minutes').setDescription('Minutes to mute').setRequired(true).setMinValue(1).setMaxValue(10080))
      .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false)))
    .addSubcommand(s => s.setName('unmute').setDescription('Remove timeout from a user')
      .addUserOption(o => o.setName('user').setDescription('User').setRequired(true)))
    .addSubcommand(s => s.setName('purge').setDescription('Delete messages')
      .addIntegerOption(o => o.setName('amount').setDescription('Number of messages (1-100)').setRequired(true).setMinValue(1).setMaxValue(100)))
    .addSubcommand(s => s.setName('slowmode').setDescription('Set slowmode in channel')
      .addIntegerOption(o => o.setName('seconds').setDescription('Seconds (0 = off)').setRequired(true).setMinValue(0).setMaxValue(21600)))
    .addSubcommand(s => s.setName('lock').setDescription('Lock the current channel'))
    .addSubcommand(s => s.setName('unlock').setDescription('Unlock the current channel'))
    .addSubcommand(s => s.setName('nickname').setDescription('Change a member\'s nickname')
      .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
      .addStringOption(o => o.setName('nickname').setDescription('New nickname (blank to reset)').setRequired(false))),

  async execute(interaction) {
    const settings = getGuildSettings(interaction.guild.id);
    if (!hasModRole(interaction.member, settings)) {
      return interaction.reply({ embeds: [errorEmbed('You do not have permission to use moderation commands.')], ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();
    const logCh = settings.log_channel ? interaction.guild.channels.cache.get(settings.log_channel) : null;

    const sendLog = (embed) => { if (logCh) logCh.send({ embeds: [embed] }).catch(() => {}); };

    if (sub === 'warn') {
      const user = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason');
      db.prepare('INSERT INTO warnings (user_id, guild_id, moderator_id, reason, timestamp) VALUES (?, ?, ?, ?, ?)').run(user.id, interaction.guild.id, interaction.user.id, reason, Date.now());
      const count = db.prepare('SELECT COUNT(*) as c FROM warnings WHERE user_id = ? AND guild_id = ?').get(user.id, interaction.guild.id);

      // Public/log embed
      const logEmbed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('⚠️ User Warned')
        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: '👤 User', value: `${user.tag} (<@${user.id}>)`, inline: true },
          { name: '🛡️ Moderator', value: `${interaction.user.tag}`, inline: true },
          { name: '📋 Reason', value: reason },
          { name: '🔢 Total Warnings', value: String(count.c), inline: true },
          { name: '🏠 Server', value: interaction.guild.name, inline: true }
        )
        .setFooter({ text: `Warning issued in ${interaction.guild.name}` })
        .setTimestamp();

      // DM embed — red sapphire style
      const dmEmbed = new EmbedBuilder()
        .setColor('#8B0000')
        .setTitle('🔴 You Have Received a Warning')
        .setDescription(
          `> You have been **officially warned** in **${interaction.guild.name}**.\n` +
          `> Please review the server rules to avoid further action.`
        )
        .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
        .addFields(
          { name: '📋 Reason', value: `\`\`\`${reason}\`\`\`` },
          { name: '🛡️ Issued By', value: interaction.user.tag, inline: true },
          { name: '🔢 Warning #', value: String(count.c), inline: true },
          { name: '🏠 Server', value: interaction.guild.name, inline: true },
          {
            name: '⚠️ Notice',
            value: 'Continued violations may result in a mute, kick, or ban.\nIf you believe this warning was issued in error, please contact a moderator.'
          }
        )
        .setFooter({ text: '💎 Moderation System', iconURL: interaction.guild.iconURL({ dynamic: true }) })
        .setTimestamp();

      // Attempt to DM the warned user
      try {
        await user.send({ embeds: [dmEmbed] });
      } catch (_) {
        // User has DMs closed — silently skip
      }

      sendLog(logEmbed);
      await interaction.reply({ embeds: [logEmbed] });
    }

    else if (sub === 'kick') {
      const user = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason') || 'No reason provided';
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);
      if (!member) return interaction.reply({ embeds: [errorEmbed('User not found in server.')], ephemeral: true });
      await member.kick(reason);
      const embed = new EmbedBuilder().setColor('#ff6600').setTitle('👢 User Kicked')
        .addFields({ name: 'User', value: user.tag, inline: true }, { name: 'Moderator', value: interaction.user.tag, inline: true }, { name: 'Reason', value: reason }).setTimestamp();
      sendLog(embed);
      await interaction.reply({ embeds: [embed] });
    }

    else if (sub === 'ban') {
      const user = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason') || 'No reason provided';
      await interaction.guild.members.ban(user.id, { reason }).catch(e => { throw e; });
      const embed = new EmbedBuilder().setColor('#ff0000').setTitle('🔨 User Banned')
        .addFields({ name: 'User', value: user.tag, inline: true }, { name: 'Moderator', value: interaction.user.tag, inline: true }, { name: 'Reason', value: reason }).setTimestamp();
      sendLog(embed);
      await interaction.reply({ embeds: [embed] });
    }

    else if (sub === 'unban') {
      const userId = interaction.options.getString('userid');
      await interaction.guild.members.unban(userId).catch(e => { throw e; });
      const embed = new EmbedBuilder().setColor('#00ff00').setTitle('✅ User Unbanned').addFields({ name: 'User ID', value: userId, inline: true }, { name: 'Moderator', value: interaction.user.tag, inline: true }).setTimestamp();
      sendLog(embed);
      await interaction.reply({ embeds: [embed] });
    }

    else if (sub === 'warnings') {
      const user = interaction.options.getUser('user');
      const warns = db.prepare('SELECT * FROM warnings WHERE user_id = ? AND guild_id = ? ORDER BY timestamp DESC LIMIT 10').all(user.id, interaction.guild.id);
      if (warns.length === 0) return interaction.reply({ embeds: [new EmbedBuilder().setColor('#00ff00').setDescription(`✅ ${user.tag} has no warnings.`)] });
      const embed = new EmbedBuilder().setColor('#ffaa00').setTitle(`⚠️ Warnings for ${user.tag}`).setThumbnail(user.displayAvatarURL({ dynamic: true }));
      warns.forEach((w, i) => embed.addFields({ name: `#${i+1} — ${new Date(w.timestamp).toLocaleDateString()}`, value: `**Reason:** ${w.reason}\n**By:** <@${w.moderator_id}>` }));
      await interaction.reply({ embeds: [embed] });
    }

    else if (sub === 'clearwarnings') {
      const user = interaction.options.getUser('user');
      db.prepare('DELETE FROM warnings WHERE user_id = ? AND guild_id = ?').run(user.id, interaction.guild.id);
      await interaction.reply({ embeds: [successEmbed(`All warnings cleared for ${user.tag}.`)] });
    }

    else if (sub === 'mute') {
      const user = interaction.options.getUser('user');
      const minutes = interaction.options.getInteger('minutes');
      const reason = interaction.options.getString('reason') || 'No reason provided';
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);
      if (!member) return interaction.reply({ embeds: [errorEmbed('User not found.')], ephemeral: true });
      await member.timeout(minutes * 60 * 1000, reason);
      const embed = new EmbedBuilder().setColor('#ff6600').setTitle('🔇 User Muted').addFields({ name: 'User', value: user.tag, inline: true }, { name: 'Duration', value: `${minutes} minutes`, inline: true }, { name: 'Reason', value: reason }).setTimestamp();
      sendLog(embed);
      await interaction.reply({ embeds: [embed] });
    }

    else if (sub === 'unmute') {
      const user = interaction.options.getUser('user');
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);
      if (!member) return interaction.reply({ embeds: [errorEmbed('User not found.')], ephemeral: true });
      await member.timeout(null);
      await interaction.reply({ embeds: [successEmbed(`Timeout removed for ${user.tag}.`)] });
    }

    else if (sub === 'purge') {
      const amount = interaction.options.getInteger('amount');
      const deleted = await interaction.channel.bulkDelete(amount, true);
      const m = await interaction.reply({ embeds: [successEmbed(`Deleted ${deleted.size} messages.`)], fetchReply: true });
      setTimeout(() => m.delete().catch(() => {}), 5000);
    }

    else if (sub === 'slowmode') {
      const secs = interaction.options.getInteger('seconds');
      await interaction.channel.setRateLimitPerUser(secs);
      await interaction.reply({ embeds: [successEmbed(`Slowmode set to ${secs} seconds.`)] });
    }

    else if (sub === 'lock') {
      await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false });
      await interaction.reply({ embeds: [new EmbedBuilder().setColor('#ff0000').setDescription('🔒 Channel locked.')] });
    }

    else if (sub === 'unlock') {
      await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: null });
      await interaction.reply({ embeds: [new EmbedBuilder().setColor('#00ff00').setDescription('🔓 Channel unlocked.')] });
    }

    else if (sub === 'nickname') {
      const user = interaction.options.getUser('user');
      const nick = interaction.options.getString('nickname') || null;
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);
      if (!member) return interaction.reply({ embeds: [errorEmbed('User not found.')], ephemeral: true });
      await member.setNickname(nick);
      await interaction.reply({ embeds: [successEmbed(`Nickname ${nick ? `set to **${nick}**` : 'reset'} for ${user.tag}.`)] });
    }
  }
};
