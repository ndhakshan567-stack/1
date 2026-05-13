const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/bot.db');
const dataDir = path.dirname(dbPath);

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS guild_settings (
    guild_id TEXT PRIMARY KEY,
    welcome_channel TEXT,
    log_channel TEXT,
    report_channel TEXT,
    auction_channel TEXT,
    dm_embed INTEGER DEFAULT 1,
    dm_color TEXT DEFAULT '#00ff00',
    dm_message TEXT DEFAULT 'Hello from the server!',
    admin_role TEXT,
    mod_role TEXT,
    verify_role TEXT,
    invite_tracking INTEGER DEFAULT 1,
    yt_channel_id TEXT,
    yt_notify_channel TEXT,
    rules_channel TEXT,
    suggestion_channel TEXT
  );

  CREATE TABLE IF NOT EXISTS user_balances (
    user_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    balance INTEGER DEFAULT 0,
    bank INTEGER DEFAULT 0,
    total_messages INTEGER DEFAULT 0,
    PRIMARY KEY (user_id, guild_id)
  );

  CREATE TABLE IF NOT EXISTS loans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    interest INTEGER NOT NULL,
    due_date INTEGER NOT NULL,
    active INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS auctions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    role_id TEXT NOT NULL,
    role_name TEXT NOT NULL,
    start_price INTEGER NOT NULL,
    current_bid INTEGER DEFAULT 0,
    highest_bidder TEXT,
    seller_id TEXT NOT NULL,
    message_id TEXT,
    channel_id TEXT,
    active INTEGER DEFAULT 1,
    end_time INTEGER
  );

  CREATE TABLE IF NOT EXISTS warnings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    moderator_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    timestamp INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS afk_status (
    user_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    reason TEXT,
    image_url TEXT,
    timestamp INTEGER NOT NULL,
    PRIMARY KEY (user_id, guild_id)
  );

  CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    reporter_id TEXT NOT NULL,
    reported_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    proof TEXT,
    message_id TEXT,
    channel_id TEXT,
    status TEXT DEFAULT 'open',
    priority INTEGER DEFAULT 0,
    claimer TEXT,
    timestamp INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS shop_roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    role_id TEXT NOT NULL,
    role_name TEXT NOT NULL,
    price INTEGER NOT NULL,
    active INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS invite_tracker (
    invite_code TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    inviter_id TEXT NOT NULL,
    uses INTEGER DEFAULT 0,
    PRIMARY KEY (invite_code, guild_id)
  );

  CREATE TABLE IF NOT EXISTS captcha_sessions (
    user_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    answer TEXT NOT NULL,
    attempts INTEGER DEFAULT 0,
    timestamp INTEGER NOT NULL,
    PRIMARY KEY (user_id, guild_id)
  );

  CREATE TABLE IF NOT EXISTS message_rewards (
    user_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    last_reward INTEGER DEFAULT 0,
    PRIMARY KEY (user_id, guild_id)
  );

  CREATE TABLE IF NOT EXISTS reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    message TEXT NOT NULL,
    remind_at INTEGER NOT NULL,
    done INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS polls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    message_id TEXT,
    question TEXT NOT NULL,
    options TEXT NOT NULL,
    votes TEXT DEFAULT '{}',
    active INTEGER DEFAULT 1,
    end_time INTEGER
  );

  CREATE TABLE IF NOT EXISTS giveaways (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    message_id TEXT,
    prize TEXT NOT NULL,
    winners INTEGER DEFAULT 1,
    entries TEXT DEFAULT '[]',
    host_id TEXT NOT NULL,
    active INTEGER DEFAULT 1,
    end_time INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sticky_messages (
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    message TEXT NOT NULL,
    message_id TEXT,
    PRIMARY KEY (guild_id, channel_id)
  );

  CREATE TABLE IF NOT EXISTS auto_roles (
    guild_id TEXT NOT NULL,
    role_id TEXT NOT NULL,
    PRIMARY KEY (guild_id, role_id)
  );

  CREATE TABLE IF NOT EXISTS reaction_roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    emoji TEXT NOT NULL,
    role_id TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS ticket_settings (
    guild_id TEXT PRIMARY KEY,
    support_channel TEXT,
    log_channel TEXT,
    support_role TEXT,
    category_id TEXT
  );

  CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    status TEXT DEFAULT 'open',
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS level_settings (
    guild_id TEXT PRIMARY KEY,
    xp_per_message INTEGER DEFAULT 15,
    level_up_channel TEXT,
    level_roles TEXT DEFAULT '{}'
  );

  CREATE TABLE IF NOT EXISTS user_levels (
    user_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 0,
    PRIMARY KEY (user_id, guild_id)
  );

  CREATE TABLE IF NOT EXISTS custom_commands (
    guild_id TEXT NOT NULL,
    trigger TEXT NOT NULL,
    response TEXT NOT NULL,
    PRIMARY KEY (guild_id, trigger)
  );

  CREATE TABLE IF NOT EXISTS word_filter (
    guild_id TEXT NOT NULL,
    word TEXT NOT NULL,
    PRIMARY KEY (guild_id, word)
  );

  CREATE TABLE IF NOT EXISTS anti_raid (
    guild_id TEXT PRIMARY KEY,
    enabled INTEGER DEFAULT 0,
    join_threshold INTEGER DEFAULT 10,
    join_window INTEGER DEFAULT 10
  );

  CREATE TABLE IF NOT EXISTS birthday (
    user_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    birthday TEXT NOT NULL,
    PRIMARY KEY (user_id, guild_id)
  );

  CREATE TABLE IF NOT EXISTS server_stats (
    guild_id TEXT NOT NULL,
    date TEXT NOT NULL,
    messages INTEGER DEFAULT 0,
    joins INTEGER DEFAULT 0,
    leaves INTEGER DEFAULT 0,
    PRIMARY KEY (guild_id, date)
  );

  CREATE TABLE IF NOT EXISTS daily_rewards (
    user_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    last_daily INTEGER DEFAULT 0,
    streak INTEGER DEFAULT 0,
    PRIMARY KEY (user_id, guild_id)
  );

  CREATE TABLE IF NOT EXISTS work_cooldowns (
    user_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    last_work INTEGER DEFAULT 0,
    PRIMARY KEY (user_id, guild_id)
  );

  CREATE TABLE IF NOT EXISTS rob_cooldowns (
    user_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    last_rob INTEGER DEFAULT 0,
    PRIMARY KEY (user_id, guild_id)
  );

  CREATE TABLE IF NOT EXISTS economy_inventory (
    user_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    item_name TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    PRIMARY KEY (user_id, guild_id, item_name)
  );

  CREATE TABLE IF NOT EXISTS tier_lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    name TEXT NOT NULL,
    game_mode TEXT NOT NULL,
    tiers TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    UNIQUE(guild_id, name)
  );

  CREATE TABLE IF NOT EXISTS tier_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tier_list_id INTEGER NOT NULL,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    tier TEXT NOT NULL,
    score INTEGER DEFAULT 0,
    notes TEXT DEFAULT '',
    rated_by TEXT NOT NULL,
    rated_at INTEGER NOT NULL,
    UNIQUE(tier_list_id, user_id),
    FOREIGN KEY(tier_list_id) REFERENCES tier_lists(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS guild_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    rule_number INTEGER NOT NULL,
    emoji TEXT DEFAULT '📌',
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    UNIQUE(guild_id, rule_number)
  );

  CREATE TABLE IF NOT EXISTS yt_last_video (
    guild_id TEXT PRIMARY KEY,
    video_id TEXT,
    video_title TEXT,
    checked_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS suggestions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    suggestion TEXT NOT NULL,
    message_id TEXT,
    status TEXT DEFAULT 'pending',
    response TEXT,
    timestamp INTEGER NOT NULL
  );
`);

// Safely migrate existing DB with new columns (no-op if already exist)
const migrations = [
  'ALTER TABLE guild_settings ADD COLUMN yt_channel_id TEXT',
  'ALTER TABLE guild_settings ADD COLUMN yt_notify_channel TEXT',
  'ALTER TABLE guild_settings ADD COLUMN rules_channel TEXT',
  'ALTER TABLE guild_settings ADD COLUMN suggestion_channel TEXT',
];
for (const sql of migrations) {
  try { db.exec(sql); } catch (_) {}
}

module.exports = db;
