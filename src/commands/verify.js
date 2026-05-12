const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { getGuildSettings, hasAdminRole, errorEmbed } = require('../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('verify')
    .setDescription('Post the verification panel in this channel'),

  async execute(interaction) {
    const settings = getGuildSettings(interaction.guild.id);
    if (!hasAdminRole(interaction.member, settings)) {
      return interaction.reply({ embeds: [errorEmbed('Only admins can post the verification panel.')], ephemeral: true });
    }
    if (!settings.verify_role) {
      return interaction.reply({ embeds: [errorEmbed('Set a verification role first with `/admin setverifyrole`.')], ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setColor('#00ffff')
      .setTitle('🔐 Server Verification')
      .setDescription(`Welcome to **${interaction.guild.name}**!\n\nTo access the server, you need to verify yourself.\n\nClick the **Verify** button below. You will receive a small math captcha via DM to prove you are not a bot.\n\n✅ Takes less than 30 seconds!`)
      .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
      .setFooter({ text: 'Make sure your DMs are open to receive the captcha' });

    const btn = new ButtonBuilder()
      .setCustomId('verify')
      .setLabel('✅ Verify Me')
      .setStyle(ButtonStyle.Success);

    const row = new ActionRowBuilder().addComponents(btn);
    await interaction.reply({ embeds: [embed], components: [row] });
  }
};
