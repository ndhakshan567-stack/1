const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database/db');
const { getGuildSettings, hasAdminRole, hasModRole, parseColor, errorEmbed, successEmbed, COLORS } = require('../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('message')
    .setDescription('Send messages through the bot')
    .addSubcommand(s => s.setName('send').setDescription('Send a message to a channel')
      .addChannelOption(o => o.setName('channel').setDescription('Target channel').setRequired(true))
      .addStringOption(o => o.setName('content').setDescription('Message content').setRequired(true))
      .addBooleanOption(o => o.setName('embed').setDescription('Send as embed?').setRequired(false))
      .addStringOption(o => o.setName('color').setDescription('Embed color (e.g. red, blue, #FF0000)').setRequired(false))
      .addStringOption(o => o.setName('title').setDescription('Embed title').setRequired(false)))
    .addSubcommand(s => s.setName('edit').setDescription('Edit a bot message')
      .addStringOption(o => o.setName('messageid').setDescription('Message ID to edit').setRequired(true))
      .addStringOption(o => o.setName('content').setDescription('New content').setRequired(true)))
    .addSubcommand(s => s.setName('announce').setDescription('Send an announcement to a channel')
      .addChannelOption(o => o.setName('channel').setDescription('Channel').setRequired(true))
      .addStringOption(o => o.setName('title').setDescription('Announcement title').setRequired(true))
      .addStringOption(o => o.setName('content').setDescription('Announcement content').setRequired(true))
      .addStringOption(o => o.setName('color').setDescription('Color').setRequired(false))),

  async execute(interaction) {
    const settings = getGuildSettings(interaction.guild.id);
    if (!hasModRole(interaction.member, settings)) return interaction.reply({ embeds: [errorEmbed('You need mod or admin role to use this command.')], ephemeral: true });

    const sub = interaction.options.getSubcommand();

    if (sub === 'send') {
      const channel = interaction.options.getChannel('channel');
      const content = interaction.options.getString('content');
      const asEmbed = interaction.options.getBoolean('embed') ?? false;
      const colorInput = interaction.options.getString('color') || 'blue';
      const title = interaction.options.getString('title');

      if (asEmbed) {
        const color = parseColor(colorInput);
        const embed = new EmbedBuilder().setColor(color).setDescription(content).setTimestamp();
        if (title) embed.setTitle(title);
        embed.setFooter({ text: `Sent by ${interaction.user.tag}` });
        await channel.send({ embeds: [embed] });
      } else {
        await channel.send(content);
      }
      await interaction.reply({ embeds: [successEmbed(`Message sent to ${channel}.`)], ephemeral: true });
    }

    else if (sub === 'edit') {
      const messageId = interaction.options.getString('messageid');
      const content = interaction.options.getString('content');
      const msg = await interaction.channel.messages.fetch(messageId).catch(() => null);
      if (!msg) return interaction.reply({ embeds: [errorEmbed('Message not found.')], ephemeral: true });
      if (msg.author.id !== interaction.client.user.id) return interaction.reply({ embeds: [errorEmbed('I can only edit my own messages.')], ephemeral: true });
      await msg.edit(content);
      await interaction.reply({ embeds: [successEmbed('Message edited.')], ephemeral: true });
    }

    else if (sub === 'announce') {
      const channel = interaction.options.getChannel('channel');
      const title = interaction.options.getString('title');
      const content = interaction.options.getString('content');
      const colorInput = interaction.options.getString('color') || 'gold';
      const color = parseColor(colorInput);

      const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(`📢 ${title}`)
        .setDescription(content)
        .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
        .setFooter({ text: `Announcement by ${interaction.user.tag}` })
        .setTimestamp();

      await channel.send({ content: '@everyone', embeds: [embed] });
      await interaction.reply({ embeds: [successEmbed(`Announcement sent to ${channel}.`)], ephemeral: true });
    }
  }
};
