const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database/db');
const { getGuildSettings, getBalance, hasAdminRole, hasModRole, errorEmbed, successEmbed } = require('../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('utility')
    .setDescription('Utility and information commands')
    .addSubcommand(s => s.setName('userinfo').setDescription('Get info about a user').addUserOption(o => o.setName('user').setDescription('User').setRequired(false)))
    .addSubcommand(s => s.setName('serverinfo').setDescription('Get info about this server'))
    .addSubcommand(s => s.setName('roleinfo').setDescription('Get info about a role').addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true)))
    .addSubcommand(s => s.setName('avatar').setDescription("Get a user's avatar").addUserOption(o => o.setName('user').setDescription('User').setRequired(false)))
    .addSubcommand(s => s.setName('ping').setDescription('Check bot latency'))
    .addSubcommand(s => s.setName('help').setDescription('Show all commands'))
    .addSubcommand(s => s.setName('remind').setDescription('Set a reminder').addStringOption(o => o.setName('message').setDescription('Reminder message').setRequired(true)).addIntegerOption(o => o.setName('minutes').setDescription('Minutes from now').setRequired(true).setMinValue(1).setMaxValue(10080)))
    .addSubcommand(s => s.setName('level').setDescription('Check your XP level').addUserOption(o => o.setName('user').setDescription('User').setRequired(false)))
    .addSubcommand(s => s.setName('leaderboard').setDescription('View the XP leaderboard'))
    .addSubcommand(s => s.setName('invites').setDescription('Check invite count for a user').addUserOption(o => o.setName('user').setDescription('User').setRequired(false)))
    .addSubcommand(s => s.setName('birthday').setDescription('Set your birthday').addStringOption(o => o.setName('date').setDescription('Your birthday (MM-DD)').setRequired(true)))
    .addSubcommand(s => s.setName('stats').setDescription('View server activity stats')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const settings = getGuildSettings(interaction.guild.id);

    if (sub === 'userinfo') {
      const user = interaction.options.getUser('user') || interaction.user;
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);
      const bal = getBalance(user.id, interaction.guild.id);
      const warnings = db.prepare('SELECT COUNT(*) as c FROM warnings WHERE user_id = ? AND guild_id = ?').get(user.id, interaction.guild.id);
      const levelData = db.prepare('SELECT * FROM user_levels WHERE user_id = ? AND guild_id = ?').get(user.id, interaction.guild.id);
      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle(`👤 ${user.tag}`)
        .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 512 }))
        .addFields(
          { name: '🆔 User ID', value: user.id, inline: true },
          { name: '🤖 Bot', value: user.bot ? 'Yes' : 'No', inline: true },
          { name: '📅 Account Created', value: user.createdAt.toLocaleDateString(), inline: true },
          { name: '📥 Joined Server', value: member ? member.joinedAt?.toLocaleDateString() || 'Unknown' : 'Not in server', inline: true },
          { name: '💎 Minecoins', value: `${bal}`, inline: true },
          { name: '⚠️ Warnings', value: `${warnings.c}`, inline: true },
          { name: '⭐ Level', value: levelData ? `${levelData.level} (${levelData.xp} XP)` : '0 (0 XP)', inline: true },
          { name: '🎭 Roles', value: member ? member.roles.cache.filter(r => r.id !== interaction.guild.id).map(r => r.toString()).join(' ') || 'None' : 'N/A' },
        ).setTimestamp();
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'serverinfo') {
      const g = interaction.guild;
      await g.fetch();
      const totalMembers = g.memberCount;
      const botCount = g.members.cache.filter(m => m.user.bot).size;
      const channelCount = g.channels.cache.size;
      const roleCount = g.roles.cache.size;
      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle(`🏠 ${g.name}`)
        .setThumbnail(g.iconURL({ dynamic: true, size: 512 }))
        .addFields(
          { name: '🆔 Server ID', value: g.id, inline: true },
          { name: '👑 Owner', value: `<@${g.ownerId}>`, inline: true },
          { name: '📅 Created', value: g.createdAt.toLocaleDateString(), inline: true },
          { name: '👥 Members', value: `${totalMembers} (${botCount} bots)`, inline: true },
          { name: '📺 Channels', value: `${channelCount}`, inline: true },
          { name: '🎭 Roles', value: `${roleCount}`, inline: true },
          { name: '🚀 Boosts', value: `${g.premiumSubscriptionCount || 0}`, inline: true },
          { name: '📊 Boost Level', value: `Level ${g.premiumTier}`, inline: true },
          { name: '🌐 Verification Level', value: `${g.verificationLevel}`, inline: true },
        ).setImage(g.bannerURL({ dynamic: true }) || null).setTimestamp();
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'roleinfo') {
      const role = interaction.options.getRole('role');
      const embed = new EmbedBuilder()
        .setColor(role.color || '#99aab5')
        .setTitle(`🎭 ${role.name}`)
        .addFields(
          { name: '🆔 Role ID', value: role.id, inline: true },
          { name: '🎨 Color', value: role.hexColor, inline: true },
          { name: '📌 Position', value: `${role.position}`, inline: true },
          { name: '📅 Created', value: role.createdAt.toLocaleDateString(), inline: true },
          { name: '🔍 Mentionable', value: role.mentionable ? 'Yes' : 'No', inline: true },
          { name: '📌 Hoisted', value: role.hoist ? 'Yes' : 'No', inline: true },
          { name: '👥 Members', value: `${role.members.size}`, inline: true },
          { name: '🤖 Managed', value: role.managed ? 'Yes (Bot/Integration)' : 'No', inline: true },
        ).setTimestamp();
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'avatar') {
      const user = interaction.options.getUser('user') || interaction.user;
      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle(`🖼️ ${user.tag}'s Avatar`)
        .setImage(user.displayAvatarURL({ dynamic: true, size: 1024 }))
        .addFields({ name: '🔗 Links', value: `[PNG](${user.displayAvatarURL({ extension: 'png', size: 1024 })}) | [JPG](${user.displayAvatarURL({ extension: 'jpg', size: 1024 })}) | [WebP](${user.displayAvatarURL({ extension: 'webp', size: 1024 })})` });
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'ping') {
      const start = Date.now();
      await interaction.deferReply();
      const latency = Date.now() - start;
      return interaction.editReply({ embeds: [new EmbedBuilder()
        .setColor(latency < 100 ? '#00ff00' : latency < 300 ? '#ffaa00' : '#ff0000')
        .setTitle('🏓 Pong!')
        .addFields(
          { name: '📡 Bot Latency', value: `${latency}ms`, inline: true },
          { name: '💓 API Latency', value: `${Math.round(interaction.client.ws.ping)}ms`, inline: true },
        )] });
    }

    if (sub === 'help') {
      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('📚 PokeFanIconZ Bot — Commands')
        .setDescription('All available slash commands are listed below.')
        .addFields(
          { name: '🛡️ Moderation', value: '`/mod warn/kick/ban/unban/mute/unmute/purge/slowmode/lock/unlock/nickname/warnings/clearwarnings`' },
          { name: '⚙️ Admin Setup', value: '`/admin setwelcome/setlog/setreport/setadminrole/setmodrole/setverifyrole/setdmstyle/setdmmessage/setdmcolor/autorole/addshoprole/wordfilter/customcmd/sticky/levelupchannel/setyoutubechannel/setuploadchannel/setruleschannel/setsuggestionchannel/serverinfo/colorlist`' },
          { name: '📩 DM', value: '`/dm everyone/user/role [message]`' },
          { name: '✅ Verification', value: '`/verify` — Post the captcha verification panel' },
          { name: '💰 Economy', value: '`/economy balance/daily/work/transfer/deposit/withdraw/rob/slots/bet/leaderboard/shop/buy/loan/repay`' },
          { name: '🔨 Auction', value: '`/auction start/end/list/info`' },
          { name: '🌍 Weather', value: '`/weather <city>` or `$weather <city>`' },
          { name: '🕐 Time', value: '`/time` or `$time` — World clock with timezone selector' },
          { name: '💤 AFK', value: '`/afk [reason]` or `$afk [reason]`' },
          { name: '🚨 Report', value: '`/report <user> <reason> [proof]`' },
          { name: '🎉 Giveaway', value: '`/giveaway start/end/list`' },
          { name: '📊 Poll', value: '`/poll create/end`' },
          { name: '🎭 Reaction Roles', value: '`/reactionrole add/remove/list`' },
          { name: '🎟️ Tickets', value: '`/ticket setup/close`' },
          { name: '📊 Tier List', value: '`/tierlist create/rate/view/sheet/list/myresult/unrate/delete`' },
          { name: '🎮 Minecraft', value: '`/mc java <username>` — Java edition lookup\n`/mc bedrock <username>` — Bedrock (GeyserMC) lookup' },
          { name: '📜 Rules', value: '`/rules add/remove/list/post/clear` — Manage & post server rules' },
          { name: '👤 Profile', value: '`/profile user <id>` — Discord user lookup by ID\n`/profile server <id>` — Server info by ID' },
          { name: '💡 Suggestions', value: '`/suggest submit <text>` — Submit a suggestion\n`/suggest accept/deny <id> [reason]` — Mod actions' },
          { name: '🔧 Utility', value: '`/utility userinfo/serverinfo/roleinfo/avatar/ping/help/remind/level/leaderboard/invites/birthday/stats`' },
          { name: '🎮 Fun', value: '`/fun meme/punch/kiss/hug/slap/pat/bite/cuddle/poke/wave/cry/dance/shoot/8ball/coinflip/dice/rps/joke/fact/ship/roast/compliment/rate/trivia`' },
          { name: '💬 Message', value: '`/message send` — Send a message through the bot' },
          { name: '📝 Prefix Commands', value: '`$afk`, `$time`, `$weather`, `$meme`, `$8ball`, `$coinflip`' },
        )
        .setFooter({ text: 'Prefix: $ | Slash: / | Fun GIFs powered by waifu.pics 🎌' })
        .setTimestamp();
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'remind') {
      const msg = interaction.options.getString('message');
      const mins = interaction.options.getInteger('minutes');
      const remindAt = Date.now() + mins * 60 * 1000;
      db.prepare('INSERT INTO reminders (user_id, guild_id, channel_id, message, remind_at) VALUES (?, ?, ?, ?, ?)').run(interaction.user.id, interaction.guild.id, interaction.channel.id, msg, remindAt);
      return interaction.reply({ embeds: [successEmbed(`⏰ Reminder set! I'll remind you in **${mins} minute(s)**.\n\n"${msg}"`)] });
    }

    if (sub === 'level') {
      const user = interaction.options.getUser('user') || interaction.user;
      const data = db.prepare('SELECT * FROM user_levels WHERE user_id = ? AND guild_id = ?').get(user.id, interaction.guild.id);
      const xp = data?.xp || 0;
      const level = data?.level || 0;
      const nextLevelXP = Math.pow((level + 1) / 0.1, 2);
      const progress = Math.min(Math.floor((xp / nextLevelXP) * 100), 100);
      const bar = '█'.repeat(Math.floor(progress / 5)) + '░'.repeat(20 - Math.floor(progress / 5));
      return interaction.reply({ embeds: [new EmbedBuilder()
        .setColor('#9900ff')
        .setTitle(`⭐ ${user.username}'s Level`)
        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: '⭐ Level', value: `${level}`, inline: true },
          { name: '✨ XP', value: `${xp} / ${Math.floor(nextLevelXP)}`, inline: true },
          { name: '📊 Progress', value: `${bar} **${progress}%**` }
        ).setTimestamp()] });
    }

    if (sub === 'leaderboard') {
      const top = db.prepare('SELECT user_id, level, xp FROM user_levels WHERE guild_id = ? ORDER BY level DESC, xp DESC LIMIT 10').all(interaction.guild.id);
      if (top.length === 0) return interaction.reply({ embeds: [errorEmbed('No level data yet. Start chatting!')] });
      const medals = ['🥇', '🥈', '🥉'];
      let desc = '';
      for (let i = 0; i < top.length; i++) {
        desc += `${medals[i] || `**${i+1}.**`} <@${top[i].user_id}> — Level **${top[i].level}** (${top[i].xp} XP)\n`;
      }
      return interaction.reply({ embeds: [new EmbedBuilder().setColor('#9900ff').setTitle('🏆 XP Leaderboard').setDescription(desc).setTimestamp()] });
    }

    if (sub === 'invites') {
      const user = interaction.options.getUser('user') || interaction.user;
      const invites = await interaction.guild.invites.fetch();
      const userInvites = invites.filter(i => i.inviter?.id === user.id);
      const totalUses = userInvites.reduce((a, i) => a + (i.uses || 0), 0);
      return interaction.reply({ embeds: [new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle(`📨 ${user.username}'s Invites`)
        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: '🔗 Total Invite Links', value: `${userInvites.size}`, inline: true },
          { name: '👥 Total Members Invited', value: `${totalUses}`, inline: true }
        ).setTimestamp()] });
    }

    if (sub === 'birthday') {
      const dateStr = interaction.options.getString('date');
      if (!/^\d{2}-\d{2}$/.test(dateStr)) return interaction.reply({ embeds: [errorEmbed('Invalid date format. Use MM-DD (e.g. `01-15` for January 15th).')], ephemeral: true });
      const [mm, dd] = dateStr.split('-').map(Number);
      if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return interaction.reply({ embeds: [errorEmbed('Invalid date.')], ephemeral: true });
      db.prepare('INSERT OR REPLACE INTO birthday (user_id, guild_id, birthday) VALUES (?, ?, ?)').run(interaction.user.id, interaction.guild.id, dateStr);
      return interaction.reply({ embeds: [successEmbed(`🎂 Birthday set to **${dateStr}**! I'll wish you on your special day!`)] });
    }

    if (sub === 'stats') {
      const today = new Date().toISOString().split('T')[0];
      const stats = db.prepare('SELECT * FROM server_stats WHERE guild_id = ? AND date = ?').get(interaction.guild.id, today);
      const week = db.prepare("SELECT SUM(messages) as msgs, SUM(joins) as joins, SUM(leaves) as leaves FROM server_stats WHERE guild_id = ? AND date >= date(?, '-7 days')").get(interaction.guild.id, today);
      return interaction.reply({ embeds: [new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle(`📊 Server Stats — ${interaction.guild.name}`)
        .addFields(
          { name: '📅 Today', value: '\u200b' },
          { name: '💬 Messages', value: `${stats?.messages || 0}`, inline: true },
          { name: '📥 Joins', value: `${stats?.joins || 0}`, inline: true },
          { name: '📤 Leaves', value: `${stats?.leaves || 0}`, inline: true },
          { name: '📆 Last 7 Days', value: '\u200b' },
          { name: '💬 Messages', value: `${week?.msgs || 0}`, inline: true },
          { name: '📥 Joins', value: `${week?.joins || 0}`, inline: true },
          { name: '📤 Leaves', value: `${week?.leaves || 0}`, inline: true },
        ).setTimestamp()] });
    }
  }
};
