const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database/db');
const { errorEmbed } = require('../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('afk')
    .setDescription('Set or remove your AFK status')
    .addStringOption(o => o.setName('reason').setDescription('AFK reason').setRequired(false)),

  prefixAliases: ['afk'],

  async execute(interaction) {
    const reason = interaction.options.getString('reason') || 'AFK';
    db.prepare('INSERT OR REPLACE INTO afk_status (user_id, guild_id, reason, image_url, timestamp) VALUES (?, ?, ?, ?, ?)')
      .run(interaction.user.id, interaction.guild.id, reason, null, Date.now());

    const embed = new EmbedBuilder()
      .setColor('#ffaa00')
      .setTitle('💤 AFK Status Set')
      .setDescription(`${interaction.user} is now AFK!\n**Reason:** ${reason}`)
      .setFooter({ text: 'You will be marked as back when you send a message.' })
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },

  async executePrefixed(message, args) {
    const reason = args.join(' ') || 'AFK';
    db.prepare('INSERT OR REPLACE INTO afk_status (user_id, guild_id, reason, image_url, timestamp) VALUES (?, ?, ?, ?, ?)')
      .run(message.author.id, message.guild.id, reason, null, Date.now());

    const embed = new EmbedBuilder()
      .setColor('#ffaa00')
      .setTitle('💤 AFK Status Set')
      .setDescription(`${message.author} is now AFK!\n**Reason:** ${reason}`)
      .setFooter({ text: 'You will be marked as back when you send a message.' })
      .setTimestamp();
    await message.reply({ embeds: [embed] });
  }
};
