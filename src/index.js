require('dotenv').config();
const { Client, GatewayIntentBits, Collection, Partials, ActivityType, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const db = require('./database/db');
const { isAllowedGuild } = require('./utils/helpers');
const cron = require('node-cron');

if (!process.env.BOT_TOKEN) {
  console.error('[BOT] ❌ BOT_TOKEN is not set!');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildModeration,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.GuildMember, Partials.User],
});

client.commands = new Collection();
client.prefixCommands = new Collection();
client.inviteCache = new Map();

// Load events
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'));
for (const file of eventFiles) {
  const event = require(path.join(eventsPath, file));
  if (event.once) client.once(event.name, (...args) => event.execute(...args, client));
  else client.on(event.name, (...args) => event.execute(...args, client));
}

// Load commands
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));
for (const file of commandFiles) {
  const cmd = require(path.join(commandsPath, file));
  if (cmd.data) client.commands.set(cmd.data.name, cmd);
  if (cmd.prefixAliases) {
    for (const alias of cmd.prefixAliases) {
      client.prefixCommands.set(alias, cmd);
    }
  }
}

// ─── Weekly loan interest ────────────────────────────────────────────────────
cron.schedule('0 0 * * 0', () => {
  const loans = db.prepare('SELECT * FROM loans WHERE active = 1').all();
  for (const loan of loans) {
    const interest = Math.floor(loan.amount * 0.05);
    const bal = db.prepare('SELECT balance FROM user_balances WHERE user_id = ? AND guild_id = ?').get(loan.user_id, loan.guild_id);
    if (bal) db.prepare('UPDATE user_balances SET balance = MAX(0, balance - ?) WHERE user_id = ? AND guild_id = ?').run(interest, loan.user_id, loan.guild_id);
  }
  console.log('[CRON] Applied weekly loan interest');
});

// ─── Birthday check daily at 8am UTC ────────────────────────────────────────
cron.schedule('0 8 * * *', async () => {
  const today = new Date();
  const mmdd = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const birthdays = db.prepare('SELECT * FROM birthday WHERE birthday LIKE ?').all(`%${mmdd}`);
  for (const b of birthdays) {
    const guild = client.guilds.cache.get(b.guild_id);
    if (!guild) continue;
    const settings = db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(b.guild_id);
    if (!settings || !settings.log_channel) continue;
    const ch = guild.channels.cache.get(settings.log_channel);
    if (!ch) continue;
    try {
      const member = await guild.members.fetch(b.user_id).catch(() => null);
      if (!member) continue;
      const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🎂 Happy Birthday!')
        .setDescription(`Today is **${member.user.username}**'s birthday! Wish them well! 🎉`)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }));
      ch.send({ content: `@everyone 🎂`, embeds: [embed] });
    } catch {}
  }
});

// ─── Giveaway checker every minute ──────────────────────────────────────────
cron.schedule('* * * * *', async () => {
  const now = Date.now();
  const ended = db.prepare('SELECT * FROM giveaways WHERE active = 1 AND end_time <= ?').all(now);
  for (const giveaway of ended) {
    db.prepare('UPDATE giveaways SET active = 0 WHERE id = ?').run(giveaway.id);
    const guild = client.guilds.cache.get(giveaway.guild_id);
    if (!guild) continue;
    const ch = guild.channels.cache.get(giveaway.channel_id);
    if (!ch) continue;
    let entries = [];
    try { entries = JSON.parse(giveaway.entries); } catch {}
    if (entries.length === 0) {
      ch.send({ embeds: [new EmbedBuilder().setColor('#ff0000').setTitle('🎉 Giveaway Ended').setDescription(`**Prize:** ${giveaway.prize}\nNo valid entries. No winner!`)] });
      continue;
    }
    const winners = [];
    const pool = [...entries];
    for (let i = 0; i < Math.min(giveaway.winners, pool.length); i++) {
      winners.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    }
    const embed = new EmbedBuilder().setColor('#FFD700').setTitle('🎉 Giveaway Ended!').setDescription(`**Prize:** ${giveaway.prize}\n**Winner(s):** ${winners.map(w => `<@${w}>`).join(', ')}\nCongratulations! 🎊`);
    ch.send({ content: winners.map(w => `<@${w}>`).join(', '), embeds: [embed] });
  }
});

// ─── Reminder checker every minute ──────────────────────────────────────────
cron.schedule('* * * * *', async () => {
  const now = Date.now();
  const due = db.prepare('SELECT * FROM reminders WHERE done = 0 AND remind_at <= ?').all(now);
  for (const r of due) {
    db.prepare('UPDATE reminders SET done = 1 WHERE id = ?').run(r.id);
    const guild = client.guilds.cache.get(r.guild_id);
    if (!guild) continue;
    const ch = guild.channels.cache.get(r.channel_id);
    if (!ch) continue;
    ch.send({ content: `<@${r.user_id}>`, embeds: [new EmbedBuilder().setColor('#00ffff').setTitle('⏰ Reminder').setDescription(`<@${r.user_id}>, you asked me to remind you:\n**${r.message}**`)] });
  }
});

// ─── YouTube new upload checker (every 10 minutes) ──────────────────────────
cron.schedule('*/10 * * * *', async () => {
  const guildsWithYT = db.prepare("SELECT * FROM guild_settings WHERE yt_channel_id IS NOT NULL AND yt_channel_id != '' AND yt_notify_channel IS NOT NULL AND yt_notify_channel != ''").all();
  for (const settings of guildsWithYT) {
    try {
      const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${settings.yt_channel_id}`;
      const res = await axios.get(feedUrl, { timeout: 10000, headers: { 'User-Agent': 'DiscordBot/2.0' } });
      const xml = res.data;

      const videoIdMatch = xml.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
      const titleMatches = xml.match(/<title>([^<]+)<\/title>/g);
      const linkMatch = xml.match(/href="(https:\/\/www\.youtube\.com\/watch[^"]+)"/);
      const publishedMatch = xml.match(/<published>([^<]+)<\/published>/);
      const channelNameMatch = xml.match(/<title>([^<]+)<\/title>/);

      if (!videoIdMatch) continue;

      const videoId = videoIdMatch[1];
      const videoTitle = titleMatches && titleMatches[1] ? titleMatches[1].replace(/<\/?title>/g, '') : 'New Video';
      const videoUrl = linkMatch ? linkMatch[1] : `https://www.youtube.com/watch?v=${videoId}`;
      const channelName = channelNameMatch ? channelNameMatch[1].replace(/<\/?title>/g, '') : 'YouTube Channel';

      const stored = db.prepare('SELECT * FROM yt_last_video WHERE guild_id = ?').get(settings.guild_id);
      if (stored && stored.video_id === videoId) continue;

      db.prepare('INSERT OR REPLACE INTO yt_last_video (guild_id, video_id, video_title, checked_at) VALUES (?, ?, ?, ?)').run(settings.guild_id, videoId, videoTitle, Date.now());

      if (!stored) continue; // First run — just store, don't post

      const guild = client.guilds.cache.get(settings.guild_id);
      if (!guild) continue;
      const ch = guild.channels.cache.get(settings.yt_notify_channel);
      if (!ch) continue;

      const thumbUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
      const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle(`🎬 New Video: ${videoTitle}`)
        .setURL(videoUrl)
        .setDescription(`**${channelName}** just uploaded a new video!\n\n🔔 Click the title or button below to watch!`)
        .setImage(thumbUrl)
        .addFields({ name: '🔗 Watch Now', value: videoUrl })
        .setFooter({ text: '📺 YouTube Notification' })
        .setTimestamp(publishedMatch ? new Date(publishedMatch[1]) : new Date());

      ch.send({ content: `@everyone 🎬 **New video just dropped!**`, embeds: [embed] }).catch(console.error);
      console.log(`[YT] Posted new video "${videoTitle}" for guild ${settings.guild_id}`);
    } catch (err) {
      console.error(`[YT] Error checking YouTube for guild ${settings.guild_id}:`, err.message);
    }
  }
});

// ─── Dashboard API ───────────────────────────────────────────────────────────
if (process.env.DASHBOARD_API_KEY) {
  const { createApiServer } = require('./api/server');
  client.once('ready', () => createApiServer(client));
  console.log('[API] Dashboard API will start after bot is ready');
}

client.login(process.env.BOT_TOKEN).then(() => {
  console.log(`[BOT] ✅ Logged in as ${client.user.tag}`);
  client.user.setActivity('the server | /help', { type: ActivityType.Watching });
}).catch(err => {
  console.error('[BOT] ❌ Failed to login:', err.message);
  process.exit(1);
});
