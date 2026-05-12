const { isAllowedGuild } = require('../utils/helpers');

module.exports = {
  name: 'guildCreate',
  async execute(guild, client) {
    if (!isAllowedGuild(guild.id)) {
      console.log(`[SECURITY] Joined unauthorized guild ${guild.name} (${guild.id}). Leaving.`);
      await guild.leave();
      return;
    }
    console.log(`[GUILD] Joined authorized guild: ${guild.name} (${guild.id})`);
    // Cache invites for new guild
    try {
      const invites = await guild.invites.fetch();
      client.inviteCache.set(guild.id, new Map(invites.map(i => [i.code, i.uses])));
    } catch {}
  }
};
