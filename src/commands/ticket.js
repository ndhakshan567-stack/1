const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const db = require('../database/db');
const { getGuildSettings, hasAdminRole, hasModRole, errorEmbed, successEmbed } = require('../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Ticket system commands')
    .addSubcommand(s => s.setName('setup').setDescription('Set up the ticket system in this channel'))
    .addSubcommand(s => s.setName('close').setDescription('Close this ticket channel'))
    .addSubcommand(s => s.setName('add').setDescription('Add a user to this ticket').addUserOption(o => o.setName('user').setDescription('User to add').setRequired(true)))
    .addSubcommand(s => s.setName('remove').setDescription('Remove a user from this ticket').addUserOption(o => o.setName('user').setDescription('User to remove').setRequired(true)))
    .addSubcommand(s => s.setName('list').setDescription('List all open tickets'))
    .addSubcommand(s => s.setName('setsupport').setDescription('Set the support/staff role').addRoleOption(o => o.setName('role').setDescription('Support role').setRequired(true))),

  async execute(interaction) {
    const settings = getGuildSettings(interaction.guild.id);
    const sub = interaction.options.getSubcommand();

    if (sub === 'setup') {
      if (!hasAdminRole(interaction.member, settings)) return interaction.reply({ embeds: [errorEmbed('Admin only.')], ephemeral: true });

      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('🎟️ Support Tickets')
        .setDescription('Need help? Click the button below to open a support ticket!\n\nOur staff team will assist you as soon as possible.')
        .setFooter({ text: 'One ticket per user at a time' });

      const btn = new ButtonBuilder().setCustomId('openticket').setLabel('📩 Open Ticket').setStyle(ButtonStyle.Primary);
      const row = new ActionRowBuilder().addComponents(btn);
      await interaction.reply({ embeds: [embed], components: [row] });
    }

    else if (sub === 'close') {
      const ticket = db.prepare('SELECT * FROM tickets WHERE channel_id = ? AND guild_id = ?').get(interaction.channel.id, interaction.guild.id);
      if (!ticket) return interaction.reply({ embeds: [errorEmbed('This is not a ticket channel.')], ephemeral: true });
      if (!hasModRole(interaction.member, settings) && ticket.user_id !== interaction.user.id) {
        return interaction.reply({ embeds: [errorEmbed('Only staff or the ticket owner can close this ticket.')], ephemeral: true });
      }

      db.prepare('UPDATE tickets SET status = ? WHERE channel_id = ?').run('closed', interaction.channel.id);
      const embed = new EmbedBuilder().setColor('#ff0000').setTitle('🎟️ Ticket Closing').setDescription(`Ticket closed by ${interaction.user.tag}. This channel will be deleted in 5 seconds.`);
      await interaction.reply({ embeds: [embed] });
      setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);

      const logCh = settings.log_channel ? interaction.guild.channels.cache.get(settings.log_channel) : null;
      if (logCh) {
        logCh.send({ embeds: [new EmbedBuilder().setColor('#ff0000').setTitle('🎟️ Ticket Closed').addFields({ name: 'Channel', value: interaction.channel.name, inline: true }, { name: 'Closed by', value: interaction.user.tag, inline: true }, { name: 'Owner', value: `<@${ticket.user_id}>`, inline: true }).setTimestamp()] }).catch(() => {});
      }
    }

    else if (sub === 'add') {
      const user = interaction.options.getUser('user');
      if (!hasModRole(interaction.member, settings)) return interaction.reply({ embeds: [errorEmbed('Staff only.')], ephemeral: true });
      await interaction.channel.permissionOverwrites.edit(user.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
      await interaction.reply({ embeds: [successEmbed(`Added ${user} to this ticket.`)] });
    }

    else if (sub === 'remove') {
      const user = interaction.options.getUser('user');
      if (!hasModRole(interaction.member, settings)) return interaction.reply({ embeds: [errorEmbed('Staff only.')], ephemeral: true });
      await interaction.channel.permissionOverwrites.edit(user.id, { ViewChannel: false });
      await interaction.reply({ embeds: [successEmbed(`Removed ${user} from this ticket.`)] });
    }

    else if (sub === 'list') {
      if (!hasModRole(interaction.member, settings)) return interaction.reply({ embeds: [errorEmbed('Staff only.')], ephemeral: true });
      const tickets = db.prepare('SELECT * FROM tickets WHERE guild_id = ? AND status = ?').all(interaction.guild.id, 'open');
      if (tickets.length === 0) return interaction.reply({ embeds: [new EmbedBuilder().setColor('#00ff00').setDescription('No open tickets! 🎉')] });
      const embed = new EmbedBuilder().setColor('#0099ff').setTitle('🎟️ Open Tickets');
      tickets.forEach(t => embed.addFields({ name: `Ticket #${t.id}`, value: `Owner: <@${t.user_id}> | Channel: <#${t.channel_id}>`, inline: false }));
      await interaction.reply({ embeds: [embed] });
    }

    else if (sub === 'setsupport') {
      if (!hasAdminRole(interaction.member, settings)) return interaction.reply({ embeds: [errorEmbed('Admin only.')], ephemeral: true });
      const role = interaction.options.getRole('role');
      db.prepare('INSERT OR IGNORE INTO ticket_settings (guild_id) VALUES (?)').run(interaction.guild.id);
      db.prepare('UPDATE ticket_settings SET support_role = ? WHERE guild_id = ?').run(role.id, interaction.guild.id);
      await interaction.reply({ embeds: [successEmbed(`Support role set to ${role}.`)] });
    }
  }
};
