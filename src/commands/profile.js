const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { errorEmbed } = require('../utils/helpers');

const FLAGS = {
  Staff: '👮 Discord Staff',
  Partner: '🤝 Partnered Server Owner',
  Hypesquad: '🏠 HypeSquad Events',
  BugHunterLevel1: '🐛 Bug Hunter Level 1',
  BugHunterLevel2: '🐛 Bug Hunter Level 2',
  HypeSquadOnlineHouse1: '🏠 House Bravery',
  HypeSquadOnlineHouse2: '🏠 House Brilliance',
  HypeSquadOnlineHouse3: '🏠 House Balance',
  PremiumEarlySupporter: '⭐ Early Nitro Supporter',
  TeamPseudoUser: '👥 Team User',
  VerifiedBot: '✅ Verified Bot',
  VerifiedDeveloper: '🛠️ Early Verified Bot Developer',
  CertifiedModerator: '🛡️ Certified Moderator',
  ActiveDeveloper: '💻 Active Developer',
};

function formatAge(createdAt) {
  const now = Date.now();
  const diff = now - createdAt.getTime();
  const days = Math.floor(diff / 86400000);
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  if (years > 0) return `${years}y ${months}m old`;
  if (months > 0) return `${months}m ${days % 30}d old`;
  return `${days} days old`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('Look up a Discord user or server by ID')
    .addSubcommand(s => s
      .setName('user')
      .setDescription('Look up any Discord user by their ID')
      .addStringOption(o => o.setName('id').setDescription('Discord User ID').setRequired(true)))
    .addSubcommand(s => s
      .setName('server')
      .setDescription('Look up a server the bot is in by its ID')
      .addStringOption(o => o.setName('id').setDescription('Discord Server ID').setRequired(true))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const id = interaction.options.getString('id').trim();

    if (!/^\d{17,20}$/.test(id)) {
      return interaction.reply({ embeds: [errorEmbed('Invalid ID. Discord IDs are 17-20 digit numbers.')], ephemeral: true });
    }

    await interaction.deferReply();

    if (sub === 'user') {
      try {
        const user = await interaction.client.users.fetch(id, { force: true });

        const badges = user.flags ? user.flags.toArray().map(f => FLAGS[f] || f).filter(Boolean) : [];
        const accountAge = formatAge(user.createdAt);
        const avatarUrl = user.displayAvatarURL({ dynamic: true, size: 1024 });
        const bannerUrl = user.bannerURL?.({ dynamic: true, size: 1024 }) || null;
        const accentColor = user.accentColor ? `#${user.accentColor.toString(16).padStart(6, '0')}` : null;

        const embed = new EmbedBuilder()
          .setColor(accentColor || '#5865F2')
          .setTitle(`👤 ${user.tag}`)
          .setThumbnail(avatarUrl)
          .addFields(
            { name: '🆔 User ID', value: `\`${user.id}\``, inline: true },
            { name: '🤖 Bot', value: user.bot ? 'Yes ✅' : 'No', inline: true },
            { name: '📅 Account Created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:F>`, inline: false },
            { name: '⏳ Account Age', value: accountAge, inline: true },
          );

        if (badges.length > 0) {
          embed.addFields({ name: '🏅 Badges', value: badges.join('\n'), inline: false });
        }

        if (avatarUrl) {
          embed.addFields({ name: '🖼️ Avatar Links', value: `[PNG](${user.displayAvatarURL({ extension: 'png', size: 1024 })}) | [WebP](${user.displayAvatarURL({ extension: 'webp', size: 1024 })})` });
        }

        if (bannerUrl) {
          embed.setImage(bannerUrl).addFields({ name: '🎨 Profile Banner', value: '(shown below)' });
        }

        if (accentColor) {
          embed.addFields({ name: '🎨 Accent Color', value: accentColor, inline: true });
        }

        embed.setFooter({ text: 'Fetched via Discord API' }).setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      } catch (err) {
        if (err.code === 10013) {
          return interaction.editReply({ embeds: [errorEmbed(`No Discord user found with ID \`${id}\`.\nMake sure you're using a valid User ID (not a username).`)] });
        }
        return interaction.editReply({ embeds: [errorEmbed('Could not fetch user. They may not exist or the ID is invalid.')] });
      }
    }

    if (sub === 'server') {
      const guild = interaction.client.guilds.cache.get(id);
      if (!guild) {
        return interaction.editReply({ embeds: [errorEmbed(`I'm not in a server with the ID \`${id}\`, or that server doesn't exist.\n\nI can only look up servers that I am a member of.`)] });
      }

      try {
        await guild.fetch();
        const owner = await guild.fetchOwner().catch(() => null);
        const totalMembers = guild.memberCount;
        const botCount = guild.members.cache.filter(m => m.user.bot).size;
        const channelCount = guild.channels.cache.size;
        const roleCount = guild.roles.cache.size;
        const emojiCount = guild.emojis.cache.size;

        const embed = new EmbedBuilder()
          .setColor('#0099ff')
          .setTitle(`🏠 ${guild.name}`)
          .setThumbnail(guild.iconURL({ dynamic: true, size: 512 }))
          .addFields(
            { name: '🆔 Server ID', value: `\`${guild.id}\``, inline: true },
            { name: '👑 Owner', value: owner ? `${owner.user.tag}` : `<@${guild.ownerId}>`, inline: true },
            { name: '📅 Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>`, inline: false },
            { name: '👥 Total Members', value: `${totalMembers}`, inline: true },
            { name: '🤖 Bots', value: `${botCount}`, inline: true },
            { name: '👤 Humans', value: `${totalMembers - botCount}`, inline: true },
            { name: '📺 Channels', value: `${channelCount}`, inline: true },
            { name: '🎭 Roles', value: `${roleCount}`, inline: true },
            { name: '😄 Emojis', value: `${emojiCount}`, inline: true },
            { name: '🚀 Boosts', value: `${guild.premiumSubscriptionCount || 0}`, inline: true },
            { name: '📊 Boost Level', value: `Level ${guild.premiumTier}`, inline: true },
            { name: '🌐 Verification', value: `Level ${guild.verificationLevel}`, inline: true },
          )
          .setFooter({ text: 'Fetched from bot guild cache' })
          .setTimestamp();

        if (guild.bannerURL()) embed.setImage(guild.bannerURL({ dynamic: true }));
        if (guild.description) embed.setDescription(guild.description);

        return interaction.editReply({ embeds: [embed] });
      } catch {
        return interaction.editReply({ embeds: [errorEmbed('Could not fetch server details.')] });
      }
    }
  }
};
