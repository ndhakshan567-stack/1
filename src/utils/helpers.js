const { EmbedBuilder } = require('discord.js');
const db = require('../database/db');

function getAllowedGuilds() {
  if (process.env.ALLOWED_GUILD_IDS) {
    return process.env.ALLOWED_GUILD_IDS.split(',').map(s => s.trim()).filter(Boolean);
  }
  return null;
}

function isAllowedGuild(guildId) {
  const allowed = getAllowedGuilds();
  if (!allowed) return true;
  return allowed.includes(guildId);
}

function getGuildSettings(guildId) {
  let settings = db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(guildId);
  if (!settings) {
    db.prepare('INSERT OR IGNORE INTO guild_settings (guild_id) VALUES (?)').run(guildId);
    settings = db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(guildId);
  }
  return settings;
}

function getBalance(userId, guildId) {
  let row = db.prepare('SELECT balance FROM user_balances WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
  if (!row) {
    db.prepare('INSERT OR IGNORE INTO user_balances (user_id, guild_id) VALUES (?, ?)').run(userId, guildId);
    return 0;
  }
  return row.balance;
}

function getBankBalance(userId, guildId) {
  let row = db.prepare('SELECT bank FROM user_balances WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
  if (!row) {
    db.prepare('INSERT OR IGNORE INTO user_balances (user_id, guild_id) VALUES (?, ?)').run(userId, guildId);
    return 0;
  }
  return row.bank || 0;
}

function addBalance(userId, guildId, amount) {
  db.prepare('INSERT OR IGNORE INTO user_balances (user_id, guild_id) VALUES (?, ?)').run(userId, guildId);
  db.prepare('UPDATE user_balances SET balance = balance + ? WHERE user_id = ? AND guild_id = ?').run(amount, userId, guildId);
}

function removeBalance(userId, guildId, amount) {
  db.prepare('INSERT OR IGNORE INTO user_balances (user_id, guild_id) VALUES (?, ?)').run(userId, guildId);
  db.prepare('UPDATE user_balances SET balance = MAX(0, balance - ?) WHERE user_id = ? AND guild_id = ?').run(amount, userId, guildId);
}

function addBankBalance(userId, guildId, amount) {
  db.prepare('INSERT OR IGNORE INTO user_balances (user_id, guild_id) VALUES (?, ?)').run(userId, guildId);
  db.prepare('UPDATE user_balances SET bank = bank + ? WHERE user_id = ? AND guild_id = ?').run(amount, userId, guildId);
}

function removeBankBalance(userId, guildId, amount) {
  db.prepare('INSERT OR IGNORE INTO user_balances (user_id, guild_id) VALUES (?, ?)').run(userId, guildId);
  db.prepare('UPDATE user_balances SET bank = MAX(0, bank - ?) WHERE user_id = ? AND guild_id = ?').run(amount, userId, guildId);
}

function hasAdminRole(member, settings) {
  if (!settings) return false;
  if (member.guild.ownerId === member.id) return true;
  if (member.permissions.has('Administrator')) return true;
  if (settings.admin_role && member.roles.cache.has(settings.admin_role)) return true;
  return false;
}

function hasModRole(member, settings) {
  if (hasAdminRole(member, settings)) return true;
  if (settings.mod_role && member.roles.cache.has(settings.mod_role)) return true;
  return false;
}

function errorEmbed(message) {
  return new EmbedBuilder().setColor('#ff0000').setDescription(`❌ ${message}`);
}

function successEmbed(message) {
  return new EmbedBuilder().setColor('#00ff00').setDescription(`✅ ${message}`);
}

function infoEmbed(title, description, color = '#0099ff') {
  return new EmbedBuilder().setColor(color).setTitle(title).setDescription(description);
}

const COLORS = {
  'red': '#FF0000', 'light red': '#FF6666', 'dark red': '#8B0000',
  'blue': '#0000FF', 'light blue': '#ADD8E6', 'dark blue': '#00008B',
  'green': '#00FF00', 'light green': '#90EE90', 'dark green': '#006400',
  'yellow': '#FFFF00', 'orange': '#FFA500', 'purple': '#800080',
  'pink': '#FFC0CB', 'cyan': '#00FFFF', 'magenta': '#FF00FF',
  'white': '#FFFFFF', 'black': '#000000', 'gold': '#FFD700',
  'silver': '#C0C0C0', 'teal': '#008080',
};

function parseColor(input) {
  if (!input) return '#0099ff';
  const lower = input.toLowerCase().trim();
  if (COLORS[lower]) return COLORS[lower];
  if (/^#[0-9a-fA-F]{6}$/.test(input)) return input;
  return '#0099ff';
}

// ─── Anime GIF fallback pool (used when API is down) ────────────────────────
const ANIME_GIFS = {
  punch: [
    'https://media.giphy.com/media/ScmSKPFIUEoRG/giphy.gif',
    'https://media.giphy.com/media/LTFbyWuELIlqlXGLeN/giphy.gif',
    'https://media.giphy.com/media/xT1XH3yj7ujmm1PXNK/giphy.gif',
    'https://media.giphy.com/media/1k4OfGqSeGXVvhkHMf/giphy.gif',
    'https://media.giphy.com/media/3oKIPnAiaMCws8nOsE/giphy.gif',
  ],
  kiss: [
    'https://media.giphy.com/media/G3va31oEEnIkM/giphy.gif',
    'https://media.giphy.com/media/bGm9FzmFQABJK/giphy.gif',
    'https://media.giphy.com/media/FqBTvSNjNzeZa/giphy.gif',
    'https://media.giphy.com/media/ZkEXisGbMawMg/giphy.gif',
    'https://media.giphy.com/media/ORqGBGAnuAcQZSI7kp/giphy.gif',
  ],
  hug: [
    'https://media.giphy.com/media/l2QDM9Jnim1YVILXa/giphy.gif',
    'https://media.giphy.com/media/od5H3PmEG5EVq/giphy.gif',
    'https://media.giphy.com/media/3oEdv4Y4QQGA6RLRCE/giphy.gif',
    'https://media.giphy.com/media/ZBQhoZC0nqknSviPqT/giphy.gif',
    'https://media.giphy.com/media/lrr9rHuoJOE0w/giphy.gif',
    'https://media.giphy.com/media/wnsgren0j8XC4/giphy.gif',
  ],
  slap: [
    'https://media.giphy.com/media/jLeyZWgtwgr2U/giphy.gif',
    'https://media.giphy.com/media/Gf3AUz3eBNbTW/giphy.gif',
    'https://media.giphy.com/media/mEtSQlxqBtWWA/giphy.gif',
    'https://media.giphy.com/media/xUO4t2gkzNxqjCGpqw/giphy.gif',
    'https://media.giphy.com/media/3XlEk2RxPS1m8/giphy.gif',
  ],
  pat: [
    'https://media.giphy.com/media/109ltuoSQT212w/giphy.gif',
    'https://media.giphy.com/media/L2z7dnOduqEow/giphy.gif',
    'https://media.giphy.com/media/4HP0ddZnNVvKUrqRqS/giphy.gif',
    'https://media.giphy.com/media/ye8VR7GxTxBd2/giphy.gif',
    'https://media.giphy.com/media/ARSp9T7wwxNcs/giphy.gif',
  ],
  bite: [
    'https://media.giphy.com/media/5i5StU2mJD5ny/giphy.gif',
    'https://media.giphy.com/media/E2X4ZNmW4GSBK/giphy.gif',
    'https://media.giphy.com/media/LXTQN3dBOSFgk/giphy.gif',
    'https://media.giphy.com/media/RWFt4DQsqVemc/giphy.gif',
  ],
  cuddle: [
    'https://media.giphy.com/media/lrr9rHuoJOE0w/giphy.gif',
    'https://media.giphy.com/media/ZBQhoZC0nqknSviPqT/giphy.gif',
    'https://media.giphy.com/media/3oEdv4Y4QQGA6RLRCE/giphy.gif',
    'https://media.giphy.com/media/wnsgren0j8XC4/giphy.gif',
    'https://media.giphy.com/media/3oEdv6utxKiMSMoBiE/giphy.gif',
  ],
  poke: [
    'https://media.giphy.com/media/2bYewTk7K2No1NvcuK/giphy.gif',
    'https://media.giphy.com/media/WvVzZ9mCyMjsc/giphy.gif',
    'https://media.giphy.com/media/oF5oUYTOhvFnO/giphy.gif',
    'https://media.giphy.com/media/pWd3gD577gOqs/giphy.gif',
  ],
  wave: [
    'https://media.giphy.com/media/4HP0ddZnNVvKUrqRqS/giphy.gif',
    'https://media.giphy.com/media/Jir9VEhTTCBjK/giphy.gif',
    'https://media.giphy.com/media/l0Exdm9UbTHAFcJi0/giphy.gif',
    'https://media.giphy.com/media/3oEdvdBmtBWhwwjNpu/giphy.gif',
  ],
  cry: [
    'https://media.giphy.com/media/7JvlHfd7C2GDr7zfZF/giphy.gif',
    'https://media.giphy.com/media/fkHCcJaGwg8Wc/giphy.gif',
    'https://media.giphy.com/media/Sby9SLVBLMIS4/giphy.gif',
    'https://media.giphy.com/media/1oDTa5Q9sFjwBKvwjU/giphy.gif',
    'https://media.giphy.com/media/d2lcHJTG5Tscg/giphy.gif',
  ],
  dance: [
    'https://media.giphy.com/media/l0HlNaQ6gWfllcjDO/giphy.gif',
    'https://media.giphy.com/media/6oMKugqovQnjW/giphy.gif',
    'https://media.giphy.com/media/13CoXDiaCcCoyk/giphy.gif',
    'https://media.giphy.com/media/3oEdv6s4bSL5PlBfaw/giphy.gif',
    'https://media.giphy.com/media/rgeJHJDQ6J5rO/giphy.gif',
  ],
  shoot: [
    'https://media.giphy.com/media/3oEdv6utxKiMSMoBiE/giphy.gif',
    'https://media.giphy.com/media/8UGoOaR1lA1uaAN892/giphy.gif',
    'https://media.giphy.com/media/xT1XH3yj7ujmm1PXNK/giphy.gif',
    'https://media.giphy.com/media/rgeJHJDQ6J5rO/giphy.gif',
  ],
  levelup: [
    'https://media.giphy.com/media/26tOZ42Mg6pbTUPHW/giphy.gif',
    'https://media.giphy.com/media/s2qXK8wAvkHTO/giphy.gif',
    'https://media.giphy.com/media/YRuFixSNWFVcXaxpmX/giphy.gif',
    'https://media.giphy.com/media/xT8qBit7Os5RNWJekk/giphy.gif',
    'https://media.giphy.com/media/3o6Zt6ML6BklcajjsA/giphy.gif',
    'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif',
    'https://media.giphy.com/media/5GoVLqeAOo6PK/giphy.gif',
  ],
};

// Pool system — tracks used GIFs per key to avoid repeats until all seen
const gifPools = new Map();

function getPooledGif(key) {
  const pool = ANIME_GIFS[key];
  if (!pool || pool.length === 0) return null;
  const cacheKey = `pool_${key}`;
  if (!gifPools.has(cacheKey) || gifPools.get(cacheKey).length === 0) {
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    gifPools.set(cacheKey, shuffled);
  }
  return gifPools.get(cacheKey).pop();
}

// waifu.pics action mapping
const WAIFU_MAP = {
  punch: 'punch', kiss: 'kiss', hug: 'hug', slap: 'slap',
  pat: 'pat', bite: 'bite', cuddle: 'cuddle', poke: 'poke',
  wave: 'wave', cry: 'cry', dance: 'dance', shoot: 'kill',
};

// Fetch a GIF from waifu.pics API, falling back to local pool
async function fetchAnimeGif(action) {
  const endpoint = WAIFU_MAP[action];
  if (endpoint) {
    try {
      const axios = require('axios');
      const res = await axios.get(`https://api.waifu.pics/sfw/${endpoint}`, { timeout: 3000 });
      if (res.data && res.data.url) return res.data.url;
    } catch (_) {}
  }
  return getPooledGif(action) || 'https://media.giphy.com/media/ScmSKPFIUEoRG/giphy.gif';
}

// Legacy sync getter (fallback only)
function getAnimeGif(action) {
  return getPooledGif(action);
}

module.exports = {
  isAllowedGuild, getAllowedGuilds, getGuildSettings,
  getBalance, getBankBalance, addBalance, removeBalance, addBankBalance, removeBankBalance,
  hasAdminRole, hasModRole, errorEmbed, successEmbed, infoEmbed,
  parseColor, getAnimeGif, fetchAnimeGif, getPooledGif, ANIME_GIFS, COLORS,
};
