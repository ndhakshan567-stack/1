const { ActivityType } = require('discord.js');
const db = require('../database/db');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    console.log(`[READY] Logged in as ${client.user.tag}`);
    client.user.setActivity('your server 👀', { type: ActivityType.Watching });

    // Cache all guild invites
    for (const [, guild] of client.guilds.cache) {
      try {
        const invites = await guild.invites.fetch();
        client.inviteCache.set(guild.id, new Map(invites.map(i => [i.code, i.uses])));
      } catch {}
    }
  }
};
