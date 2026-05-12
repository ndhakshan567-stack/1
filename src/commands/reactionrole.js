const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database/db');
const { getGuildSettings, hasAdminRole, errorEmbed, successEmbed } = require('../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reactionrole')
    .setDescription('Reaction role commands')
    .addSubcommand(s => s.setName('add').setDescription('Add a reaction role to a message')
      .addStringOption(o => o.setName('messageid').setDescription('Message ID').setRequired(true))
      .addStringOption(o => o.setName('emoji').setDescription('Emoji to react with').setRequired(true))
      .addRoleOption(o => o.setName('role').setDescription('Role to assign').setRequired(true)))
    .addSubcommand(s => s.setName('remove').setDescription('Remove a reaction role')
      .addStringOption(o => o.setName('messageid').setDescription('Message ID').setRequired(true))
      .addStringOption(o => o.setName('emoji').setDescription('Emoji').setRequired(true)))
    .addSubcommand(s => s.setName('list').setDescription('List all reaction roles')),

  async execute(interaction) {
    const settings = getGuildSettings(interaction.guild.id);
    if (!hasAdminRole(interaction.member, settings)) return interaction.reply({ embeds: [errorEmbed('Admin only.')], ephemeral: true });

    const sub = interaction.options.getSubcommand();

    if (sub === 'add') {
      const messageId = interaction.options.getString('messageid');
      const emoji = interaction.options.getString('emoji');
      const role = interaction.options.getRole('role');

      const msg = await interaction.channel.messages.fetch(messageId).catch(() => null);
      if (!msg) return interaction.reply({ embeds: [errorEmbed('Message not found in this channel.')], ephemeral: true });

      db.prepare('INSERT INTO reaction_roles (guild_id, message_id, emoji, role_id) VALUES (?, ?, ?, ?)').run(interaction.guild.id, messageId, emoji, role.id);
      await msg.react(emoji).catch(() => {});
      await interaction.reply({ embeds: [successEmbed(`Reaction role added! Reacting with ${emoji} on the message will give ${role}.`)] });
    }

    else if (sub === 'remove') {
      const messageId = interaction.options.getString('messageid');
      const emoji = interaction.options.getString('emoji');
      db.prepare('DELETE FROM reaction_roles WHERE guild_id = ? AND message_id = ? AND emoji = ?').run(interaction.guild.id, messageId, emoji);
      await interaction.reply({ embeds: [successEmbed('Reaction role removed.')] });
    }

    else if (sub === 'list') {
      const rrs = db.prepare('SELECT * FROM reaction_roles WHERE guild_id = ?').all(interaction.guild.id);
      if (rrs.length === 0) return interaction.reply({ embeds: [new EmbedBuilder().setColor('#ffaa00').setDescription('No reaction roles configured.')] });
      const embed = new EmbedBuilder().setColor('#0099ff').setTitle('🎭 Reaction Roles');
      rrs.forEach(r => embed.addFields({ name: `${r.emoji} → <@&${r.role_id}>`, value: `Message ID: \`${r.message_id}\``, inline: false }));
      await interaction.reply({ embeds: [embed] });
    }
  }
};
