require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

if (!process.env.BOT_TOKEN) {
  console.error('[DEPLOY] ❌ BOT_TOKEN is not set in environment variables!');
  process.exit(1);
}
if (!process.env.CLIENT_ID) {
  console.error('[DEPLOY] ❌ CLIENT_ID is not set in environment variables!');
  process.exit(1);
}

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

for (const file of commandFiles) {
  const cmd = require(path.join(commandsPath, file));
  if (cmd.data) commands.push(cmd.data.toJSON());
}

const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);

async function deploy() {
  try {
    console.log(`[DEPLOY] Deploying ${commands.length} slash commands...`);

    // Deploy to specific guilds if GUILD_IDS is set (instant update)
    if (process.env.GUILD_IDS) {
      const guildIds = process.env.GUILD_IDS.split(',').map(s => s.trim()).filter(Boolean);
      console.log(`[DEPLOY] Guild-specific deploy to: ${guildIds.join(', ')}`);
      for (const guildId of guildIds) {
        await rest.put(
          Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId),
          { body: commands }
        );
        console.log(`[DEPLOY] ✅ Deployed to guild ${guildId}`);
      }
    } else {
      // Global deploy (takes up to 1 hour to propagate)
      console.log('[DEPLOY] Global deploy (takes up to 1 hour to appear in all servers)...');
      await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: commands }
      );
      console.log('[DEPLOY] ✅ Global commands deployed!');
    }

    console.log('[DEPLOY] All commands deployed successfully!');
  } catch (error) {
    console.error('[DEPLOY] Error:', error);
    process.exit(1);
  }
}

deploy();
