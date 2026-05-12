const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const db = require('../database/db');
const { getGuildSettings, errorEmbed } = require('../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('report')
    .setDescription('Report a user to the server staff')
    .addUserOption(o => o.setName('user').setDescription('User to report').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason for the report').setRequired(true))
    .addStringOption(o => o.setName('proof').setDescription('Proof (screenshot URL, video link, etc.)').setRequired(false)),

  async execute(interaction) {
    const settings = getGuildSettings(interaction.guild.id);
    if (!settings.report_channel) {
      return interaction.reply({ embeds: [errorEmbed('Report channel not configured. Ask an admin to use `/admin setreport`.')], ephemeral: true });
    }

    const target = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason');
    const proof = interaction.options.getString('proof') || 'No proof provided';

    if (target.id === interaction.user.id) return interaction.reply({ embeds: [errorEmbed("You can't report yourself.")], ephemeral: true });
    if (target.bot) return interaction.reply({ embeds: [errorEmbed("You can't report a bot.")], ephemeral: true });

    const targetMember = await interaction.guild.members.fetch(target.id).catch(() => null);
    const reporterMember = interaction.member;

    const result = db.prepare('INSERT INTO reports (guild_id, reporter_id, reported_id, reason, proof, timestamp) VALUES (?, ?, ?, ?, ?, ?)').run(interaction.guild.id, interaction.user.id, target.id, reason, proof, Date.now());
    const reportId = result.lastInsertRowid;

    const targetCreated = target.createdAt;
    const now = new Date();
    const targetAge = Math.floor((now - targetCreated) / (1000 * 60 * 60 * 24));

    const reporterCreated = interaction.user.createdAt;
    const reporterAge = Math.floor((now - reporterCreated) / (1000 * 60 * 60 * 24));

    const embed = new EmbedBuilder()
      .setColor('#ffff00')
      .setTitle(`🚨 Report #${reportId}`)
      .setDescription('A new report has been submitted and requires staff attention.')
      .addFields(
        { name: '📋 Report Details', value: '\u200b' },
        { name: '⚠️ Reported User', value: `${target.tag} (<@${target.id}>)`, inline: true },
        { name: '🆔 Reported User ID', value: target.id, inline: true },
        { name: '📅 Account Age', value: `${targetAge} days`, inline: true },
        { name: '🖼️ Reported User Avatar', value: target.displayAvatarURL({ dynamic: true }) },
        { name: '\u200b', value: '\u200b' },
        { name: '👤 Reporter', value: `${interaction.user.tag} (<@${interaction.user.id}>)`, inline: true },
        { name: '🆔 Reporter ID', value: interaction.user.id, inline: true },
        { name: '📅 Reporter Account Age', value: `${reporterAge} days`, inline: true },
        { name: '\u200b', value: '\u200b' },
        { name: '📝 Reason', value: reason },
        { name: '🔍 Proof', value: proof },
        { name: '📊 Status', value: '🟡 Open — Awaiting staff review' }
      )
      .setThumbnail(target.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: `Report ID: #${reportId} | ${new Date().toLocaleString()}` });

    const claimBtn = new ButtonBuilder().setCustomId(`claimreport_${reportId}`).setLabel('🙋 Claim').setStyle(ButtonStyle.Primary);
    const closeBtn = new ButtonBuilder().setCustomId(`closereport_${reportId}`).setLabel('✅ Close').setStyle(ButtonStyle.Success);
    const priorityBtn = new ButtonBuilder().setCustomId(`priorityreport_${reportId}`).setLabel('🔴 Priority').setStyle(ButtonStyle.Danger);
    const row = new ActionRowBuilder().addComponents(claimBtn, closeBtn, priorityBtn);

    const reportChannel = interaction.guild.channels.cache.get(settings.report_channel);
    if (reportChannel) {
      const msg = await reportChannel.send({ embeds: [embed], components: [row] });
      db.prepare('UPDATE reports SET message_id = ?, channel_id = ? WHERE id = ?').run(msg.id, reportChannel.id, reportId);
    }

    await interaction.reply({
      embeds: [new EmbedBuilder().setColor('#00ff00').setTitle('✅ Report Submitted').setDescription(`Your report against **${target.tag}** has been submitted.\n\n**Report ID:** #${reportId}\nOur staff team will review it shortly. Thank you for helping keep the server safe.`).setTimestamp()],
      ephemeral: true
    });
  }
};
