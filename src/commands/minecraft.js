const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const { errorEmbed } = require('../utils/helpers');

async function getJavaProfile(username) {
  const res = await axios.get(`https://api.mojang.com/users/profiles/minecraft/${username}`, { timeout: 6000 });
  return res.data; // { id, name }
}

async function getBedrockProfile(username) {
  const res = await axios.get(`https://api.geysermc.org/v2/xbox/xuid/${encodeURIComponent(username)}`, { timeout: 6000 });
  return res.data; // { xuid }
}

async function getJavaNameHistory(uuid) {
  try {
    const formatted = `${uuid.slice(0, 8)}-${uuid.slice(8, 12)}-${uuid.slice(12, 16)}-${uuid.slice(16, 20)}-${uuid.slice(20)}`;
    return formatted;
  } catch { return uuid; }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mc')
    .setDescription('Minecraft player lookup (Java & Bedrock)')
    .addSubcommand(s => s
      .setName('java')
      .setDescription('Look up a Java Edition player by username')
      .addStringOption(o => o.setName('username').setDescription('Minecraft Java username').setRequired(true)))
    .addSubcommand(s => s
      .setName('bedrock')
      .setDescription('Look up a Bedrock Edition player by gamertag (via GeyserMC)')
      .addStringOption(o => o.setName('username').setDescription('Xbox gamertag / Bedrock username').setRequired(true))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const username = interaction.options.getString('username').trim();

    await interaction.deferReply();

    if (sub === 'java') {
      try {
        const profile = await getJavaProfile(username);
        const uuid = profile.id;
        const name = profile.name;
        const formattedUUID = getJavaNameHistory(uuid);

        const avatarUrl = `https://crafatar.com/avatars/${uuid}?overlay=true&size=256`;
        const bodyUrl = `https://crafatar.com/renders/body/${uuid}?overlay=true`;
        const skinUrl = `https://crafatar.com/skins/${uuid}`;

        const embed = new EmbedBuilder()
          .setColor('#5cb85c')
          .setTitle(`⛏️ ${name} — Java Edition`)
          .setThumbnail(avatarUrl)
          .setImage(bodyUrl)
          .addFields(
            { name: '📛 Username', value: name, inline: true },
            { name: '🆔 UUID', value: `\`${await formattedUUID}\``, inline: false },
            { name: '🖼️ Avatar', value: `[View on Crafatar](${avatarUrl})`, inline: true },
            { name: '👕 Skin', value: `[Download Skin](${skinUrl})`, inline: true },
            { name: '🌐 NameMC', value: `[View Profile](https://namemc.com/profile/${uuid})`, inline: true },
          )
          .setFooter({ text: 'Data from Mojang API • Renders from Crafatar' })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      } catch (err) {
        if (err.response?.status === 404) {
          return interaction.editReply({ embeds: [errorEmbed(`No Java Edition player found with the username **${username}**.`)] });
        }
        return interaction.editReply({ embeds: [errorEmbed('Could not fetch Minecraft profile. Mojang API may be down.')] });
      }
    }

    if (sub === 'bedrock') {
      try {
        const profile = await getBedrockProfile(username);
        const xuid = profile.xuid;

        if (!xuid) {
          return interaction.editReply({ embeds: [errorEmbed(`No Bedrock player found with the gamertag **${username}**.`)] });
        }

        const floodgateUUID = `00000000-0000-0000-${xuid.slice(0, 4)}-${xuid.slice(4)}`.replace(/[^0-9a-f-]/gi, '0');
        const avatarUrl = `https://crafatar.com/avatars/00000000000000000000${xuid.slice(-12).padStart(12, '0')}?overlay=true&size=256`;

        const embed = new EmbedBuilder()
          .setColor('#7ecef4')
          .setTitle(`🟦 ${username} — Bedrock Edition`)
          .addFields(
            { name: '📛 Gamertag', value: username, inline: true },
            { name: '🆔 XUID', value: `\`${xuid}\``, inline: true },
            { name: '🔗 GeyserMC', value: `[View on GeyserMC](https://geysermc.org/lookup?gamertag=${encodeURIComponent(username)})`, inline: true },
          )
          .setFooter({ text: 'XUID data from GeyserMC Global API' })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      } catch (err) {
        if (err.response?.status === 404) {
          return interaction.editReply({ embeds: [errorEmbed(`No Bedrock player found with the gamertag **${username}**.\nMake sure the gamertag is correct and the player has logged in via GeyserMC at least once.`)] });
        }
        return interaction.editReply({ embeds: [errorEmbed('Could not fetch Bedrock profile. GeyserMC API may be down.')] });
      }
    }
  }
};
