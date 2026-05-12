const { EmbedBuilder } = require('discord.js');
const db = require('../database/db');
const { getGuildSettings } = require('../utils/helpers');

module.exports = {
  name: 'guildMemberAdd',
  async execute(member, client) {
    const settings = getGuildSettings(member.guild.id);

    // Auto roles
    const autoRoles = db.prepare('SELECT role_id FROM auto_roles WHERE guild_id = ?').all(member.guild.id);
    for (const r of autoRoles) {
      const role = member.guild.roles.cache.get(r.role_id);
      if (role) member.roles.add(role).catch(() => {});
    }

    // Server stats
    const today = new Date().toISOString().split('T')[0];
    db.prepare('INSERT OR IGNORE INTO server_stats (guild_id, date) VALUES (?, ?)').run(member.guild.id, today);
    db.prepare('UPDATE server_stats SET joins = joins + 1 WHERE guild_id = ? AND date = ?').run(member.guild.id, today);

    // Welcome message
    if (!settings.welcome_channel) return;
    const channel = member.guild.channels.cache.get(settings.welcome_channel);
    if (!channel) return;

    // Find who invited
    let inviterTag = 'Unknown';
    try {
      const newInvites = await member.guild.invites.fetch();
      const oldInvites = client.inviteCache.get(member.guild.id) || new Map();
      const usedInvite = newInvites.find(inv => {
        const old = oldInvites.get(inv.code);
        return old !== undefined && inv.uses > old;
      });
      if (usedInvite && usedInvite.inviter) inviterTag = usedInvite.inviter.tag;
      client.inviteCache.set(member.guild.id, new Map(newInvites.map(i => [i.code, i.uses])));
    } catch {}

    // Account age
    const created = member.user.createdAt;
    const now = new Date();
    const diffDays = Math.floor((now - created) / (1000 * 60 * 60 * 24));
    const years = Math.floor(diffDays / 365);
    const months = Math.floor((diffDays % 365) / 30);
    const days = diffDays % 30;
    let ageStr = '';
    if (years > 0) ageStr += `${years}y `;
    if (months > 0) ageStr += `${months}mo `;
    ageStr += `${days}d`;

    const embed = new EmbedBuilder()
      .setColor('#90EE90')
      .setTitle(`Welcome to ${member.guild.name}!`)
      .setDescription(`Hey ${member}, welcome to the server! 🎉`)
      .addFields(
        { name: '👤 Member', value: `${member.user.tag}`, inline: true },
        { name: '🎟️ Invited by', value: inviterTag, inline: true },
        { name: '📅 Account Age', value: ageStr.trim(), inline: true },
        { name: '👥 Member Count', value: `${member.guild.memberCount}`, inline: true }
      )
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .setImage('https://media.discordapp.net/attachments/1474421112686514247/1494698607859732642/welcome.gif?ex=6a01e08e&is=6a008f0e&hm=7e96e9bc1fee2a7f398923743bb76eb7d21606519a849355e1aa0ceee52aed13&=&width=936&height=120')
      .setTimestamp();

    channel.send({ embeds: [embed] }).catch(() => {});
  }
};
