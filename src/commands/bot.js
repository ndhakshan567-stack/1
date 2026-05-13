const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');
const db = require('../database/db');
const { getGuildSettings, hasAdminRole, errorEmbed, successEmbed } = require('../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bot')
    .setDescription('Bot configuration commands')
    .addSubcommandGroup(g => g
      .setName('log')
      .setDescription('Log channel settings')
      .addSubcommand(s => s
        .setName('channel')
        .setDescription('Set the channel where the bot sends moderation and activity logs')
        .addChannelOption(o => o
          .setName('channel')
          .setDescription('The channel to use as the log channel')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
        )
      )
    ),

  async execute(interaction) {
    const settings = getGuildSettings(interaction.guild.id);

    if (!hasAdminRole(interaction.member, settings)) {
      return interaction.reply({
        embeds: [errorEmbed('You need admin permissions to use bot configuration commands.')],
        ephemeral: true
      });
    }

    const group = interaction.options.getSubcommandGroup();
    const sub = interaction.options.getSubcommand();

    if (group === 'log' && sub === 'channel') {
      const ch = interaction.options.getChannel('channel');

      db.prepare('UPDATE guild_settings SET log_channel = ? WHERE guild_id = ?').run(ch.id, interaction.guild.id);

      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('📋 Log Channel Set')
        .setDescription(`The bot log channel has been set to ${ch}.`)
        .addFields(
          { name: '📌 Channel', value: `${ch} (\`${ch.name}\`)`, inline: true },
          { name: '🆔 Channel ID', value: `\`${ch.id}\``, inline: true },
          {
            name: '📦 What gets logged here',
            value:
              '• Warnings issued to members\n' +
              '• Kicks and bans\n' +
              '• Mutes and unmutes\n' +
              '• Unbans\n' +
              '• Other moderation actions'
          }
        )
        .setFooter({ text: `Set by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }
  }
};
