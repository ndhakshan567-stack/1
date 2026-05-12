const db = require('../database/db');
const { isAllowedGuild } = require('../utils/helpers');

module.exports = {
  name: 'messageReactionAdd',
  async execute(reaction, user, client) {
    if (user.bot) return;
    if (reaction.partial) {
      try { await reaction.fetch(); } catch { return; }
    }
    if (!reaction.message.guild) return;
    if (!isAllowedGuild(reaction.message.guild.id)) return;

    const emoji = reaction.emoji.name;
    const messageId = reaction.message.id;
    const guildId = reaction.message.guild.id;

    const rr = db.prepare('SELECT * FROM reaction_roles WHERE guild_id = ? AND message_id = ? AND emoji = ?').get(guildId, messageId, emoji);
    if (!rr) return;

    const guild = reaction.message.guild;
    const member = await guild.members.fetch(user.id).catch(() => null);
    if (!member) return;

    const role = guild.roles.cache.get(rr.role_id);
    if (role) member.roles.add(role).catch(() => {});
  }
};
