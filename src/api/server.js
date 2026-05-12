const express = require('express');
const cors = require('cors');
const db = require('../database/db');
const { getGuildSettings } = require('../utils/helpers');

const ALLOWED_GUILDS = ['1454829065466020028', '1483121399127347762'];

function createApiServer(client) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Simple API key auth middleware
  const auth = (req, res, next) => {
    const key = req.headers['x-api-key'] || req.query.key;
    if (!key || key !== process.env.DASHBOARD_API_KEY) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  };

  // Health check (no auth)
  app.get('/health', (req, res) => res.json({ status: 'ok', guilds: ALLOWED_GUILDS }));

  // --- Guild summary ---
  app.get('/api/guilds', auth, (req, res) => {
    const guilds = ALLOWED_GUILDS.map(id => {
      const guild = client.guilds.cache.get(id);
      const settings = getGuildSettings(id);
      const memberCount = guild?.memberCount || 0;
      const totalBalance = db.prepare('SELECT SUM(balance) as total FROM user_balances WHERE guild_id = ?').get(id)?.total || 0;
      const totalWarnings = db.prepare('SELECT COUNT(*) as c FROM warnings WHERE guild_id = ?').get(id)?.c || 0;
      const openReports = db.prepare('SELECT COUNT(*) as c FROM reports WHERE guild_id = ? AND status = ?').get(id, 'open')?.c || 0;
      const activeAuctions = db.prepare('SELECT COUNT(*) as c FROM auctions WHERE guild_id = ? AND active = 1').get(id)?.c || 0;
      const today = new Date().toISOString().split('T')[0];
      const todayStats = db.prepare('SELECT * FROM server_stats WHERE guild_id = ? AND date = ?').get(id, today);
      return {
        id,
        name: guild?.name || 'Unknown Server',
        icon: guild?.iconURL({ dynamic: true }) || null,
        memberCount,
        settings,
        stats: {
          totalBalance,
          totalWarnings,
          openReports,
          activeAuctions,
          todayMessages: todayStats?.messages || 0,
          todayJoins: todayStats?.joins || 0,
          todayLeaves: todayStats?.leaves || 0,
        }
      };
    });
    res.json(guilds);
  });

  // --- Guild settings ---
  app.get('/api/guilds/:id/settings', auth, (req, res) => {
    if (!ALLOWED_GUILDS.includes(req.params.id)) return res.status(403).json({ error: 'Forbidden' });
    const settings = getGuildSettings(req.params.id);
    res.json(settings);
  });

  app.patch('/api/guilds/:id/settings', auth, (req, res) => {
    const { id } = req.params;
    if (!ALLOWED_GUILDS.includes(id)) return res.status(403).json({ error: 'Forbidden' });
    const allowed = ['welcome_channel', 'log_channel', 'report_channel', 'dm_embed', 'dm_color', 'dm_message', 'admin_role', 'mod_role', 'verify_role'];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    for (const [key, val] of Object.entries(updates)) {
      db.prepare(`UPDATE guild_settings SET ${key} = ? WHERE guild_id = ?`).run(val, id);
    }
    res.json(getGuildSettings(id));
  });

  // --- Economy leaderboard ---
  app.get('/api/guilds/:id/economy', auth, (req, res) => {
    const { id } = req.params;
    if (!ALLOWED_GUILDS.includes(id)) return res.status(403).json({ error: 'Forbidden' });
    const top = db.prepare('SELECT user_id, balance, total_messages FROM user_balances WHERE guild_id = ? ORDER BY balance DESC LIMIT 20').all(id);
    const guild = client.guilds.cache.get(id);
    const enriched = top.map(u => {
      const member = guild?.members.cache.get(u.user_id);
      return { ...u, username: member?.user.username || u.user_id, avatar: member?.user.displayAvatarURL({ dynamic: true }) || null };
    });
    res.json(enriched);
  });

  // --- Warnings ---
  app.get('/api/guilds/:id/warnings', auth, (req, res) => {
    const { id } = req.params;
    if (!ALLOWED_GUILDS.includes(id)) return res.status(403).json({ error: 'Forbidden' });
    const warnings = db.prepare('SELECT * FROM warnings WHERE guild_id = ? ORDER BY timestamp DESC LIMIT 50').all(id);
    const guild = client.guilds.cache.get(id);
    const enriched = warnings.map(w => {
      const target = guild?.members.cache.get(w.user_id);
      const mod = guild?.members.cache.get(w.moderator_id);
      return {
        ...w,
        username: target?.user.username || w.user_id,
        moderator: mod?.user.username || w.moderator_id,
      };
    });
    res.json(enriched);
  });

  // --- Reports ---
  app.get('/api/guilds/:id/reports', auth, (req, res) => {
    const { id } = req.params;
    if (!ALLOWED_GUILDS.includes(id)) return res.status(403).json({ error: 'Forbidden' });
    const status = req.query.status || null;
    const reports = status
      ? db.prepare('SELECT * FROM reports WHERE guild_id = ? AND status = ? ORDER BY timestamp DESC LIMIT 50').all(id, status)
      : db.prepare('SELECT * FROM reports WHERE guild_id = ? ORDER BY timestamp DESC LIMIT 50').all(id);
    const guild = client.guilds.cache.get(id);
    const enriched = reports.map(r => {
      const reported = guild?.members.cache.get(r.reported_id);
      const reporter = guild?.members.cache.get(r.reporter_id);
      return {
        ...r,
        reportedUsername: reported?.user.username || r.reported_id,
        reporterUsername: reporter?.user.username || r.reporter_id,
      };
    });
    res.json(enriched);
  });

  // --- Auctions ---
  app.get('/api/guilds/:id/auctions', auth, (req, res) => {
    const { id } = req.params;
    if (!ALLOWED_GUILDS.includes(id)) return res.status(403).json({ error: 'Forbidden' });
    const auctions = db.prepare('SELECT * FROM auctions WHERE guild_id = ? ORDER BY id DESC LIMIT 30').all(id);
    res.json(auctions);
  });

  // --- Activity stats (last 7 days) ---
  app.get('/api/guilds/:id/stats', auth, (req, res) => {
    const { id } = req.params;
    if (!ALLOWED_GUILDS.includes(id)) return res.status(403).json({ error: 'Forbidden' });
    const stats = db.prepare("SELECT * FROM server_stats WHERE guild_id = ? AND date >= date('now', '-7 days') ORDER BY date ASC").all(id);
    res.json(stats);
  });

  // --- Members ---
  app.get('/api/guilds/:id/members', auth, async (req, res) => {
    const { id } = req.params;
    if (!ALLOWED_GUILDS.includes(id)) return res.status(403).json({ error: 'Forbidden' });
    const guild = client.guilds.cache.get(id);
    if (!guild) return res.json([]);
    try {
      const members = await guild.members.fetch({ limit: 100 });
      const list = members.map(m => ({
        id: m.id,
        username: m.user.username,
        avatar: m.user.displayAvatarURL({ dynamic: true }),
        joinedAt: m.joinedAt,
        roles: m.roles.cache.filter(r => r.id !== guild.id).map(r => ({ id: r.id, name: r.name, color: r.hexColor })),
        balance: db.prepare('SELECT balance FROM user_balances WHERE user_id = ? AND guild_id = ?').get(m.id, id)?.balance || 0,
        warnings: db.prepare('SELECT COUNT(*) as c FROM warnings WHERE user_id = ? AND guild_id = ?').get(m.id, id)?.c || 0,
      }));
      res.json(list);
    } catch (e) {
      res.json([]);
    }
  });

  // --- Loans ---
  app.get('/api/guilds/:id/loans', auth, (req, res) => {
    const { id } = req.params;
    if (!ALLOWED_GUILDS.includes(id)) return res.status(403).json({ error: 'Forbidden' });
    const loans = db.prepare('SELECT * FROM loans WHERE guild_id = ? AND active = 1').all(id);
    const guild = client.guilds.cache.get(id);
    const enriched = loans.map(l => {
      const member = guild?.members.cache.get(l.user_id);
      return { ...l, username: member?.user.username || l.user_id };
    });
    res.json(enriched);
  });

  // --- Levels ---
  app.get('/api/guilds/:id/levels', auth, (req, res) => {
    const { id } = req.params;
    if (!ALLOWED_GUILDS.includes(id)) return res.status(403).json({ error: 'Forbidden' });
    const levels = db.prepare('SELECT * FROM user_levels WHERE guild_id = ? ORDER BY level DESC, xp DESC LIMIT 20').all(id);
    const guild = client.guilds.cache.get(id);
    const enriched = levels.map(l => {
      const member = guild?.members.cache.get(l.user_id);
      return { ...l, username: member?.user.username || l.user_id, avatar: member?.user.displayAvatarURL({ dynamic: true }) || null };
    });
    res.json(enriched);
  });

  const PORT = process.env.DASHBOARD_PORT || 3001;
  app.listen(PORT, () => console.log(`[API] Dashboard API running on port ${PORT}`));
  return app;
}

module.exports = { createApiServer };
