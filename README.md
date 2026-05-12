# PokeFanIconZ Discord Bot

A feature-rich Discord bot with economy, tier lists, moderation, Minecraft lookups, YouTube notifications, suggestions, rules management, and much more.

---

## 🚀 Deploy to Railway

### Step 1 — Upload to GitHub

Extract this ZIP, then push the contents to a new GitHub repository:

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

### Step 2 — Create a Railway project

1. Go to [railway.app](https://railway.app) and sign in
2. Click **New Project → Deploy from GitHub Repo**
3. Select the repo you just pushed
4. Railway will auto-detect the config from `railway.json` and `nixpacks.toml`

### Step 3 — Add environment variables

In Railway → your service → **Variables**, add:

| Variable | Required | Description |
|---|---|---|
| `BOT_TOKEN` | ✅ Yes | Your Discord bot token |
| `CLIENT_ID` | ✅ Yes | Your Discord application/client ID |
| `GUILD_IDS` | Optional | Comma-separated guild IDs for instant slash command deploy |
| `ALLOWED_GUILD_IDS` | Optional | Restrict bot to specific servers (empty = all servers) |
| `DB_PATH` | Optional | Set to `/data/bot.db` if using a persistent volume |
| `DASHBOARD_API_KEY` | Optional | Enables the dashboard REST API |

### Step 4 — Add a persistent volume (recommended)

Without a volume, the SQLite database resets on every redeploy.

1. Railway → your service → **Settings** → **Volumes**
2. Click **Add Volume**, set mount path: `/data`
3. Add variable `DB_PATH=/data/bot.db`

### Step 5 — Deploy

Railway will build and start the bot automatically. The start command (`node src/deploy-commands.js && node src/index.js`) deploys slash commands then starts the bot in one step.

---

## 🏠 Local Development

```bash
# 1. Install dependencies
npm install

# 2. Copy and fill in your .env file
cp .env.example .env
# Edit .env — set BOT_TOKEN and CLIENT_ID at minimum

# 3. Start the bot (deploys commands + starts)
npm run deploy-and-start

# Or separately:
npm run deploy-commands   # register slash commands
npm start                 # start the bot
npm run dev               # start with auto-reload (nodemon)
```

---

## 🔑 Getting your Bot Token & Client ID

1. Go to [discord.com/developers/applications](https://discord.com/developers/applications)
2. Select your application (or create one)
3. **Client ID**: Found on the **General Information** page
4. **Bot Token**: Go to **Bot** → **Reset Token**
5. Enable these **Privileged Gateway Intents** under **Bot**:
   - ✅ Server Members Intent
   - ✅ Message Content Intent
   - ✅ Presence Intent

---

## 📋 Commands

### ⚙️ Admin (`/admin`)
| Subcommand | Description |
|---|---|
| `setwelcome` | Set welcome channel |
| `setlog` | Set log channel |
| `setreport` | Set report channel |
| `setadminrole` | Set admin role |
| `setmodrole` | Set moderator role |
| `setverifyrole` | Set captcha verification role |
| `setdmstyle/setdmmessage/setdmcolor` | Configure mass-DM style |
| `autorole` | Add/remove auto-assign role for new members |
| `addshoprole` | Add a role to the economy shop |
| `wordfilter` | Add/remove filtered words |
| `customcmd` | Add/remove custom prefix commands |
| `sticky` | Set/remove a sticky message in a channel |
| `levelupchannel` | Set level-up announcement channel |
| `setyoutubechannel` | Set YouTube channel ID to monitor for new uploads |
| `setuploadchannel` | Set Discord channel for YouTube upload notifications |
| `setruleschannel` | Set default channel for `/rules post` |
| `setsuggestionchannel` | Set channel for `/suggest` submissions |
| `serverinfo` | View all current bot settings |
| `colorlist` | List available embed colors |

### 📊 Tier List (`/tierlist`)
| Subcommand | Description |
|---|---|
| `create` | Create a tier list with custom tiers (e.g. `S,A,B,C,D` or `Pro,Amateur,Beginner`) |
| `rate` | (Mod) Assign a member to a tier with score & notes |
| `view` | View tier list grouped by tier |
| `sheet` | Full result sheet sorted by score |
| `list` | List all tier lists in the server |
| `myresult` | Check your own rating |
| `unrate` | (Mod) Remove a member's rating |
| `delete` | (Admin) Delete a tier list |

### 💰 Economy (`/economy`)
`balance`, `daily`, `work`, `transfer`, `deposit`, `withdraw`, `rob`, `slots`, `bet`, `shop`, `buy`, `loan`, `repay`, `leaderboard`

### 🛡️ Moderation (`/mod`)
`warn`, `kick`, `ban`, `unban`, `mute`, `unmute`, `purge`, `slowmode`, `lock`, `unlock`, `nickname`, `warnings`, `clearwarnings`

### ⛏️ Minecraft (`/mc`)
| Subcommand | Description |
|---|---|
| `java <username>` | Look up a Java Edition player — UUID, 3D render, skin download, NameMC link |
| `bedrock <username>` | Look up a Bedrock Edition player via GeyserMC — XUID, gamertag |

### 📜 Rules (`/rules`)
| Subcommand | Description |
|---|---|
| `add <number> <title> <description>` | Add a rule |
| `remove <number>` | Remove a rule |
| `list` | Preview all rules (admin only) |
| `post [channel]` | Post a formatted rules embed to a channel |
| `clear` | Delete all rules |

### 👤 Profile (`/profile`)
| Subcommand | Description |
|---|---|
| `user <id>` | Look up any Discord user by ID (badges, account age, avatar, banner) |
| `server <id>` | Look up a server the bot is in by ID |

### 💡 Suggestions (`/suggest`)
| Subcommand | Description |
|---|---|
| `submit <text>` | Submit a suggestion (posted to suggestion channel with 👍/👎) |
| `accept <id> [reason]` | (Mod) Accept a suggestion — updates embed + DMs author |
| `deny <id> [reason]` | (Mod) Deny a suggestion — updates embed + DMs author |
| `list` | (Mod) View pending suggestions |

### 🔧 Utility (`/utility`)
`userinfo`, `serverinfo`, `roleinfo`, `avatar`, `ping`, `help`, `remind`, `level`, `leaderboard`, `invites`, `birthday`, `stats`

### 🎮 Fun (`/fun`)
`meme`, `punch`, `kiss`, `hug`, `slap`, `pat`, `bite`, `cuddle`, `poke`, `wave`, `cry`, `dance`, `shoot`, `8ball`, `coinflip`, `dice`, `rps`, `joke`, `fact`, `ship`, `roast`, `compliment`, `rate`, `trivia`

> Anime action GIFs are powered by **waifu.pics** for infinite variety with automatic fallback.

### Other Commands
| Command | Description |
|---|---|
| `/weather <city>` | Live weather with rotating HD photos (Open-Meteo, no API key needed) |
| `/time` | World clock with timezone selector |
| `/afk [reason]` | Set AFK status |
| `/report` | Report a user to moderators |
| `/giveaway` | Start/end/list giveaways |
| `/poll` | Create/end polls |
| `/ticket` | Support ticket system |
| `/reactionrole` | Reaction role management |
| `/verify` | Post captcha verification panel |
| `/auction` | Role auction system |
| `/dm everyone/user/role` | Mass DM system |
| `/message send` | Send a message as the bot |

### Prefix Commands (`$`)
`$afk`, `$time`, `$weather`, `$meme`, `$8ball`, `$coinflip`

---

## 🤖 Automated Features (Crons)

| Feature | Schedule | Description |
|---|---|---|
| YouTube Notifier | Every 10 min | Posts new uploads to Discord with @everyone ping |
| Birthday Wishes | Daily 8am UTC | Wishes members happy birthday in log channel |
| Giveaway Checker | Every minute | Ends giveaways and picks winners automatically |
| Reminder Checker | Every minute | Sends due reminders to users |
| Loan Interest | Weekly (Sunday) | Applies 5% weekly interest to outstanding loans |

---

## 📁 Project Structure

```
discord-bot/
├── src/
│   ├── index.js                  — Entry point + cron jobs
│   ├── deploy-commands.js        — Slash command registration
│   ├── commands/
│   │   ├── admin.js              — Admin configuration
│   │   ├── economy.js            — Economy & currency
│   │   ├── tierlist.js           — Tier list system
│   │   ├── moderation.js         — Moderation tools
│   │   ├── minecraft.js          — Java & Bedrock lookups
│   │   ├── rules.js              — Rules management & posting
│   │   ├── profile.js            — Discord user/server lookup by ID
│   │   ├── suggest.js            — Suggestion box
│   │   ├── weather.js            — Live weather + rotating HD photos
│   │   ├── fun.js                — Anime GIFs, games, jokes, trivia
│   │   └── ...                   — Other commands
│   ├── events/
│   │   ├── interactionCreate.js  — Slash command + button handler
│   │   ├── messageCreate.js      — XP, rewards, sticky, word filter
│   │   └── ...
│   ├── database/
│   │   └── db.js                 — SQLite schema + migrations
│   └── utils/
│       └── helpers.js            — Shared utilities + GIF fetcher
├── data/                         — SQLite DB (auto-created, add to volume)
├── .env.example                  — Environment variable template
├── railway.json                  — Railway deployment config
├── nixpacks.toml                 — Railway build config (Node 20)
├── Procfile                      — Fallback process definition
└── package.json
```
