const db = require('../database/db');

module.exports = {
  name: 'guildMemberRemove',
  async execute(member, client) {
    const today = new Date().toISOString().split('T')[0];
    db.prepare('INSERT OR IGNORE INTO server_stats (guild_id, date) VALUES (?, ?)').run(member.guild.id, today);
    db.prepare('UPDATE server_stats SET leaves = leaves + 1 WHERE guild_id = ? AND date = ?').run(member.guild.id, today);
  }
};
