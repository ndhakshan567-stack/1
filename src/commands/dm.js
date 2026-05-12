const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database/db');
const { getGuildSettings, hasAdminRole, hasModRole, parseColor, errorEmbed, successEmbed } = require('../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dm')
    .setDescription('DM commands')
    .addSubcommand(s => s
      .setName('everyone')
      .setDescription('DM every member in the server (admin only)')
      .addStringOption(o => o
        .setName('message')
        .setDescription('Custom message to send (overrides server default)')
        .setRequired(false)
        .setMaxLength(2000)))
    .addSubcommand(s => s
      .setName('user')
      .setDescription('DM a specific user')
      .addUserOption(o => o.setName('user').setDescription('User to DM').setRequired(true))
      .addStringOption(o => o
        .setName('message')
        .setDescription('Custom message to send (overrides server default)')
        .setRequired(false)
        .setMaxLength(2000)))
    .addSubcommand(s => s
      .setName('role')
      .setDescription('DM all members with a specific role')
      .addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true))
      .addStringOption(o => o
        .setName('message')
        .setDescription('Custom message to send (overrides server default)')
        .setRequired(false)
        .setMaxLength(2000))),

  async execute(interaction) {
    const settings = getGuildSettings(interaction.guild.id);
    const sub = interaction.options.getSubcommand();

    if (sub === 'everyone' && !hasAdminRole(interaction.member, settings)) {
      return interaction.reply({ embeds: [errorEmbed('Only admins can DM everyone.')], ephemeral: true });
    }
    if (!hasModRole(interaction.member, settings)) {
      return interaction.reply({ embeds: [errorEmbed('You need the mod or admin role to use DM commands.')], ephemeral: true });
    }

    await interaction.deferReply();

    const customMsg = interaction.options.getString('message');
    const msg = customMsg || settings.dm_message || 'Hello from the server!';
    const isEmbed = settings.dm_embed;
    const color = settings.dm_color || '#00ff00';

    const sendDm = async (user) => {
      try {
        if (isEmbed) {
          const embed = new EmbedBuilder()
            .setColor(parseColor(color))
            .setTitle(`📩 Message from ${interaction.guild.name}`)
            .setDescription(msg)
            .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
            .setTimestamp();
          await user.send({ embeds: [embed] });
        } else {
          await user.send(`📩 **Message from ${interaction.guild.name}:**\n${msg}`);
        }
        return true;
      } catch {
        return false;
      }
    };

    let sent = 0, failed = 0;

    if (sub === 'user') {
      const target = interaction.options.getUser('user');
      const ok = await sendDm(target);
      const label = customMsg ? 'Custom' : 'Default';
      if (ok) {
        await interaction.editReply({ embeds: [successEmbed(`DM sent to **${target.tag}**.\n📝 **[${label}]** ${msg}`)] });
      } else {
        await interaction.editReply({ embeds: [errorEmbed(`Could not DM ${target.tag}. They may have DMs disabled.`)] });
      }
    }

    else if (sub === 'role') {
      const role = interaction.options.getRole('role');
      const members = await interaction.guild.members.fetch();
      const targets = members.filter(m => m.roles.cache.has(role.id) && !m.user.bot);
      const label = customMsg ? 'Custom' : 'Default';
      for (const [, member] of targets) {
        const ok = await sendDm(member.user);
        if (ok) sent++; else failed++;
        await new Promise(r => setTimeout(r, 200));
      }
      await interaction.editReply({
        embeds: [successEmbed(
          `DMs sent to **${role.name}** members.\n📝 **[${label}]** ${msg}\n✅ Sent: ${sent}\n❌ Failed: ${failed}`
        )]
      });
    }

    else if (sub === 'everyone') {
      const members = await interaction.guild.members.fetch();
      const targets = members.filter(m => !m.user.bot);
      const label = customMsg ? 'Custom' : 'Default';
      for (const [, member] of targets) {
        const ok = await sendDm(member.user);
        if (ok) sent++; else failed++;
        await new Promise(r => setTimeout(r, 300));
      }
      await interaction.editReply({
        embeds: [successEmbed(
          `Mass DM complete.\n📝 **[${label}]** ${msg}\n✅ Sent: ${sent}\n❌ Failed: ${failed}`
        )]
      });
    }
  }
};
