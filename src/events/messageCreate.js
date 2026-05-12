const { EmbedBuilder } = require('discord.js');
const db = require('../database/db');
const { isAllowedGuild, getGuildSettings, addBalance, getPooledGif } = require('../utils/helpers');

const LEVELUP_GIFS = [
  'https://media.giphy.com/media/26tOZ42Mg6pbTUPHW/giphy.gif',
  'https://media.giphy.com/media/s2qXK8wAvkHTO/giphy.gif',
  'https://media.giphy.com/media/YRuFixSNWFVcXaxpmX/giphy.gif',
  'https://media.giphy.com/media/xT8qBit7Os5RNWJekk/giphy.gif',
  'https://media.giphy.com/media/3o6Zt6ML6BklcajjsA/giphy.gif',
  'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif',
  'https://media.giphy.com/media/5GoVLqeAOo6PK/giphy.gif',
  'https://media.giphy.com/media/kaBU6pgv0OsPHz2yxy/giphy.gif',
  'https://media.giphy.com/media/3oEjI789af0AVurF60/giphy.gif',
  'https://media.giphy.com/media/BPJmthQ3YRwD6QqcVD/giphy.gif',
];

// In-memory shuffle pool for level up GIFs
const levelupPool = [];
function getLevelupGif() {
  if (levelupPool.length === 0) {
    levelupPool.push(...[...LEVELUP_GIFS].sort(() => Math.random() - 0.5));
  }
  return levelupPool.pop();
}

module.exports = {
  name: 'messageCreate',
  async execute(message, client) {
    if (message.author.bot || !message.guild) return;
    if (!isAllowedGuild(message.guild.id)) return;

    const settings = getGuildSettings(message.guild.id);
    const prefix = '$';

    // Word filter
    const words = db.prepare('SELECT word FROM word_filter WHERE guild_id = ?').all(message.guild.id);
    for (const w of words) {
      if (message.content.toLowerCase().includes(w.word.toLowerCase())) {
        message.delete().catch(() => {});
        const warn = await message.channel.send({ embeds: [new EmbedBuilder().setColor('#ff0000').setDescription(`⚠️ ${message.author}, your message contained a filtered word.`)] });
        setTimeout(() => warn.delete().catch(() => {}), 5000);
        return;
      }
    }

    // AFK check — if someone mentions an AFK user
    if (message.mentions.users.size > 0) {
      for (const [, user] of message.mentions.users) {
        const afk = db.prepare('SELECT * FROM afk_status WHERE user_id = ? AND guild_id = ?').get(user.id, message.guild.id);
        if (afk) {
          const ago = Math.floor((Date.now() - afk.timestamp) / 60000);
          message.channel.send({ embeds: [new EmbedBuilder().setColor('#ffaa00').setDescription(`💤 **${user.username}** is AFK: ${afk.reason || 'No reason'} (${ago}m ago)`)] }).catch(() => {});
        }
      }
    }

    // Remove AFK if user sends a message
    const userAfk = db.prepare('SELECT * FROM afk_status WHERE user_id = ? AND guild_id = ?').get(message.author.id, message.guild.id);
    if (userAfk) {
      db.prepare('DELETE FROM afk_status WHERE user_id = ? AND guild_id = ?').run(message.author.id, message.guild.id);
      const embed = new EmbedBuilder().setColor('#00ff00').setDescription(`✅ Welcome back, ${message.author}! Your AFK has been removed.`);
      const m = await message.channel.send({ embeds: [embed] }).catch(() => {});
      if (m) setTimeout(() => m.delete().catch(() => {}), 5000);
    }

    // Message reward (1 minecoin per message, 60s cooldown)
    const now = Date.now();
    const reward = db.prepare('SELECT last_reward FROM message_rewards WHERE user_id = ? AND guild_id = ?').get(message.author.id, message.guild.id);
    if (!reward || now - reward.last_reward >= 60000) {
      addBalance(message.author.id, message.guild.id, 1);
      db.prepare('INSERT OR REPLACE INTO message_rewards (user_id, guild_id, last_reward) VALUES (?, ?, ?)').run(message.author.id, message.guild.id, now);
      db.prepare('INSERT OR IGNORE INTO user_balances (user_id, guild_id) VALUES (?, ?)').run(message.author.id, message.guild.id);
      db.prepare('UPDATE user_balances SET total_messages = total_messages + 1 WHERE user_id = ? AND guild_id = ?').run(message.author.id, message.guild.id);
    }

    // XP / leveling
    db.prepare('INSERT OR IGNORE INTO user_levels (user_id, guild_id) VALUES (?, ?)').run(message.author.id, message.guild.id);
    const xpGain = Math.floor(Math.random() * 10) + 15;
    db.prepare('UPDATE user_levels SET xp = xp + ? WHERE user_id = ? AND guild_id = ?').run(xpGain, message.author.id, message.guild.id);
    const updated = db.prepare('SELECT * FROM user_levels WHERE user_id = ? AND guild_id = ?').get(message.author.id, message.guild.id);
    if (updated) {
      const newLevel = Math.floor(0.1 * Math.sqrt(updated.xp));
      if (newLevel > updated.level) {
        db.prepare('UPDATE user_levels SET level = ? WHERE user_id = ? AND guild_id = ?').run(newLevel, message.author.id, message.guild.id);
        const lvlSettings = db.prepare('SELECT * FROM level_settings WHERE guild_id = ?').get(message.guild.id);
        const lvlCh = lvlSettings?.level_up_channel
          ? message.guild.channels.cache.get(lvlSettings.level_up_channel)
          : message.channel;
        if (lvlCh) {
          const gif = getLevelupGif();
          const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('🎉 Level Up!')
            .setDescription(`${message.author} just leveled up to **Level ${newLevel}**! 🎊`)
            .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
            .setImage(gif)
            .setTimestamp();
          lvlCh.send({ content: `${message.author}`, embeds: [embed] }).catch(() => {});
        }
      }
    }

    // Server stats
    const today = new Date().toISOString().split('T')[0];
    db.prepare('INSERT OR IGNORE INTO server_stats (guild_id, date) VALUES (?, ?)').run(message.guild.id, today);
    db.prepare('UPDATE server_stats SET messages = messages + 1 WHERE guild_id = ? AND date = ?').run(message.guild.id, today);

    // Sticky messages
    const sticky = db.prepare('SELECT * FROM sticky_messages WHERE guild_id = ? AND channel_id = ?').get(message.guild.id, message.channel.id);
    if (sticky) {
      try {
        if (sticky.message_id) {
          const old = await message.channel.messages.fetch(sticky.message_id).catch(() => null);
          if (old) old.delete().catch(() => {});
        }
        const sent = await message.channel.send(`📌 **Sticky:** ${sticky.message}`);
        db.prepare('UPDATE sticky_messages SET message_id = ? WHERE guild_id = ? AND channel_id = ?').run(sent.id, message.guild.id, message.channel.id);
      } catch {}
    }

    // Prefix commands
    if (message.content.startsWith(prefix)) {
      const args = message.content.slice(prefix.length).trim().split(/\s+/);
      const commandName = args.shift().toLowerCase();
      const custom = db.prepare('SELECT * FROM custom_commands WHERE guild_id = ? AND trigger = ?').get(message.guild.id, commandName);
      if (custom) {
        message.channel.send(custom.response).catch(() => {});
        return;
      }
      const cmd = client.prefixCommands.get(commandName);
      if (cmd) {
        try {
          await cmd.executePrefixed(message, args, client);
        } catch (e) {
          console.error(e);
          message.channel.send({ embeds: [new EmbedBuilder().setColor('#ff0000').setDescription(`❌ Error: ${e.message}`)] }).catch(() => {});
        }
      }
    }
  }
};
