const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database/db');
const { getGuildSettings, hasModRole, hasAdminRole, errorEmbed, successEmbed } = require('../utils/helpers');

const DEFAULT_TIERS = [
  { name: 'S', color: '#FF0000', description: 'God Tier' },
  { name: 'A', color: '#FF8800', description: 'Excellent' },
  { name: 'B', color: '#FFFF00', description: 'Good' },
  { name: 'C', color: '#00FF00', description: 'Average' },
  { name: 'D', color: '#0088FF', description: 'Below Average' },
  { name: 'F', color: '#8800FF', description: 'Needs Work' },
];

const TIER_EMOJIS = { S: '🔴', A: '🟠', B: '🟡', C: '🟢', D: '🔵', F: '🟣' };

function getTierEmoji(tierName) {
  return TIER_EMOJIS[tierName.toUpperCase()] || '⚪';
}

function parseTiers(tiersStr) {
  if (!tiersStr) return DEFAULT_TIERS;
  const names = tiersStr.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
  if (names.length === 0) return DEFAULT_TIERS;
  const palette = ['#FF0000', '#FF8800', '#FFFF00', '#00FF00', '#0088FF', '#8800FF', '#FF00FF', '#00FFFF', '#FFFFFF'];
  return names.map((name, i) => ({
    name,
    color: palette[i % palette.length],
    description: `Tier ${name}`,
  }));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tierlist')
    .setDescription('Tier list system for games and gamemodes')
    .addSubcommand(s => s
      .setName('create')
      .setDescription('Create a new tier list')
      .addStringOption(o => o.setName('name').setDescription('Name of the tier list (e.g. "Bedwars Rankings")').setRequired(true))
      .addStringOption(o => o.setName('game_mode').setDescription('Game or gamemode (e.g. "Hypixel Bedwars", "Valorant Ranked")').setRequired(true))
      .addStringOption(o => o.setName('tiers').setDescription('Custom tiers comma-separated (e.g. "S,A,B,C,D,F"). Default: S,A,B,C,D,F').setRequired(false)))
    .addSubcommand(s => s
      .setName('rate')
      .setDescription('[Mod only] Rate/assign a member to a tier')
      .addStringOption(o => o.setName('list_name').setDescription('Name of the tier list').setRequired(true).setAutocomplete(true))
      .addUserOption(o => o.setName('member').setDescription('Member to rate').setRequired(true))
      .addStringOption(o => o.setName('tier').setDescription('Tier to assign (e.g. S, A, B)').setRequired(true).setAutocomplete(true))
      .addIntegerOption(o => o.setName('score').setDescription('Score (0-100)').setRequired(false).setMinValue(0).setMaxValue(100))
      .addStringOption(o => o.setName('notes').setDescription('Notes about this rating (e.g. "Great aim, lacks teamwork")').setRequired(false)))
    .addSubcommand(s => s
      .setName('view')
      .setDescription('View a tier list organised by tier')
      .addStringOption(o => o.setName('list_name').setDescription('Name of the tier list').setRequired(true).setAutocomplete(true)))
    .addSubcommand(s => s
      .setName('sheet')
      .setDescription('View the full result sheet (mark sheet) for a tier list')
      .addStringOption(o => o.setName('list_name').setDescription('Name of the tier list').setRequired(true).setAutocomplete(true)))
    .addSubcommand(s => s
      .setName('list')
      .setDescription('List all tier lists in this server'))
    .addSubcommand(s => s
      .setName('delete')
      .setDescription('[Admin only] Delete a tier list')
      .addStringOption(o => o.setName('list_name').setDescription('Name of the tier list').setRequired(true).setAutocomplete(true)))
    .addSubcommand(s => s
      .setName('unrate')
      .setDescription('[Mod only] Remove a member from a tier list')
      .addStringOption(o => o.setName('list_name').setDescription('Name of the tier list').setRequired(true).setAutocomplete(true))
      .addUserOption(o => o.setName('member').setDescription('Member to remove').setRequired(true)))
    .addSubcommand(s => s
      .setName('myresult')
      .setDescription('Check your own rating in a tier list')
      .addStringOption(o => o.setName('list_name').setDescription('Name of the tier list').setRequired(true).setAutocomplete(true))),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    const guildId = interaction.guild.id;

    if (focused.name === 'list_name') {
      const lists = db.prepare('SELECT name FROM tier_lists WHERE guild_id = ? ORDER BY created_at DESC').all(guildId);
      const value = focused.value.toLowerCase();
      const filtered = lists.filter(l => l.name.toLowerCase().includes(value)).slice(0, 25);
      await interaction.respond(filtered.map(l => ({ name: l.name, value: l.name })));
      return;
    }

    if (focused.name === 'tier') {
      const listName = interaction.options.getString('list_name');
      if (!listName) {
        await interaction.respond(DEFAULT_TIERS.map(t => ({ name: t.name, value: t.name })));
        return;
      }
      const tierList = db.prepare('SELECT * FROM tier_lists WHERE guild_id = ? AND LOWER(name) = LOWER(?)').get(guildId, listName);
      if (!tierList) {
        await interaction.respond([]);
        return;
      }
      let tiers = DEFAULT_TIERS;
      try { tiers = JSON.parse(tierList.tiers); } catch {}
      const value = focused.value.toLowerCase();
      const filtered = tiers.filter(t => t.name.toLowerCase().includes(value)).slice(0, 25);
      await interaction.respond(filtered.map(t => ({ name: t.name, value: t.name })));
      return;
    }
  },

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;
    const settings = getGuildSettings(guildId);

    if (sub === 'create') {
      const name = interaction.options.getString('name').trim();
      const gameMode = interaction.options.getString('game_mode').trim();
      const tiersInput = interaction.options.getString('tiers');
      const tiers = parseTiers(tiersInput);

      const existing = db.prepare('SELECT id FROM tier_lists WHERE guild_id = ? AND LOWER(name) = LOWER(?)').get(guildId, name);
      if (existing) {
        return interaction.reply({ embeds: [errorEmbed(`A tier list named **"${name}"** already exists. Use a different name.`)], ephemeral: true });
      }

      db.prepare('INSERT INTO tier_lists (guild_id, name, game_mode, tiers, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
        guildId, name, gameMode, JSON.stringify(tiers), userId, Date.now()
      );

      const tierDisplay = tiers.map(t => `${getTierEmoji(t.name)} **${t.name}** — ${t.description}`).join('\n');
      const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('📊 Tier List Created!')
        .addFields(
          { name: '📋 Name', value: name, inline: true },
          { name: '🎮 Game/Mode', value: gameMode, inline: true },
          { name: '🏷️ Tiers', value: tierDisplay },
          { name: '📝 How to use', value: `Mods can use \`/tierlist rate\` to assign members to tiers.\nUse \`/tierlist view ${name}\` to see the tier list.\nUse \`/tierlist sheet ${name}\` to see the full result sheet.` }
        )
        .setFooter({ text: `Created by ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    }

    else if (sub === 'rate') {
      if (!hasModRole(interaction.member, settings)) {
        return interaction.reply({ embeds: [errorEmbed('Only moderators and admins can rate members in tier lists.')], ephemeral: true });
      }

      const listName = interaction.options.getString('list_name');
      const member = interaction.options.getUser('member');
      const tierInput = interaction.options.getString('tier').toUpperCase().trim();
      const score = interaction.options.getInteger('score') ?? null;
      const notes = interaction.options.getString('notes') || '';

      if (member.bot) return interaction.reply({ embeds: [errorEmbed('You cannot rate bots.')], ephemeral: true });

      const tierList = db.prepare('SELECT * FROM tier_lists WHERE guild_id = ? AND LOWER(name) = LOWER(?)').get(guildId, listName);
      if (!tierList) return interaction.reply({ embeds: [errorEmbed(`Tier list **"${listName}"** not found. Use \`/tierlist list\` to see all tier lists.`)], ephemeral: true });

      let tiers = DEFAULT_TIERS;
      try { tiers = JSON.parse(tierList.tiers); } catch {}

      const matchedTier = tiers.find(t => t.name.toUpperCase() === tierInput);
      if (!matchedTier) {
        const validTiers = tiers.map(t => t.name).join(', ');
        return interaction.reply({ embeds: [errorEmbed(`Invalid tier **"${tierInput}"**.\nValid tiers: ${validTiers}`)], ephemeral: true });
      }

      const existingResult = db.prepare('SELECT * FROM tier_results WHERE tier_list_id = ? AND user_id = ?').get(tierList.id, member.id);

      if (existingResult) {
        db.prepare('UPDATE tier_results SET tier = ?, score = ?, notes = ?, rated_by = ?, rated_at = ? WHERE tier_list_id = ? AND user_id = ?')
          .run(matchedTier.name, score ?? existingResult.score, notes || existingResult.notes, userId, Date.now(), tierList.id, member.id);
      } else {
        db.prepare('INSERT INTO tier_results (tier_list_id, guild_id, user_id, tier, score, notes, rated_by, rated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
          .run(tierList.id, guildId, member.id, matchedTier.name, score ?? 0, notes, userId, Date.now());
      }

      const emoji = getTierEmoji(matchedTier.name);
      const embed = new EmbedBuilder()
        .setColor(matchedTier.color)
        .setTitle(`${emoji} Tier Rating Assigned`)
        .setThumbnail(member.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: '👤 Member', value: `<@${member.id}>`, inline: true },
          { name: '📋 Tier List', value: tierList.name, inline: true },
          { name: '🎮 Game/Mode', value: tierList.game_mode, inline: true },
          { name: `${emoji} Tier`, value: `**${matchedTier.name}** — ${matchedTier.description}`, inline: true },
          ...(score !== null ? [{ name: '🔢 Score', value: `${score}/100`, inline: true }] : []),
          ...(notes ? [{ name: '📝 Notes', value: notes }] : []),
          { name: '🧑‍⚖️ Rated By', value: `<@${userId}>`, inline: true },
        )
        .setFooter({ text: existingResult ? 'Rating updated' : 'New rating added' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    }

    else if (sub === 'view') {
      const listName = interaction.options.getString('list_name');
      const tierList = db.prepare('SELECT * FROM tier_lists WHERE guild_id = ? AND LOWER(name) = LOWER(?)').get(guildId, listName);
      if (!tierList) return interaction.reply({ embeds: [errorEmbed(`Tier list **"${listName}"** not found.`)], ephemeral: true });

      let tiers = DEFAULT_TIERS;
      try { tiers = JSON.parse(tierList.tiers); } catch {}

      const results = db.prepare('SELECT * FROM tier_results WHERE tier_list_id = ? ORDER BY tier').all(tierList.id);

      const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle(`📊 ${tierList.name}`)
        .setDescription(`🎮 **Game/Mode:** ${tierList.game_mode}\n👥 **Total Rated:** ${results.length} member(s)`);

      for (const tier of tiers) {
        const tierMembers = results.filter(r => r.tier.toUpperCase() === tier.name.toUpperCase());
        const emoji = getTierEmoji(tier.name);
        const memberList = tierMembers.length > 0
          ? tierMembers.map(r => `<@${r.user_id}>${r.score > 0 ? ` *(${r.score}/100)*` : ''}`).join(' · ')
          : '*No members yet*';
        embed.addFields({ name: `${emoji} Tier ${tier.name} — ${tier.description}`, value: memberList });
      }

      embed.setFooter({ text: `Use /tierlist sheet ${tierList.name} to see the full result sheet` }).setTimestamp();
      await interaction.reply({ embeds: [embed] });
    }

    else if (sub === 'sheet') {
      const listName = interaction.options.getString('list_name');
      const tierList = db.prepare('SELECT * FROM tier_lists WHERE guild_id = ? AND LOWER(name) = LOWER(?)').get(guildId, listName);
      if (!tierList) return interaction.reply({ embeds: [errorEmbed(`Tier list **"${listName}"** not found.`)], ephemeral: true });

      let tiers = DEFAULT_TIERS;
      try { tiers = JSON.parse(tierList.tiers); } catch {}

      const results = db.prepare('SELECT * FROM tier_results WHERE tier_list_id = ? ORDER BY tier, score DESC').all(tierList.id);

      if (results.length === 0) {
        return interaction.reply({ embeds: [errorEmbed(`No members have been rated in **"${listName}"** yet. Mods can use \`/tierlist rate\` to add ratings.`)] });
      }

      const embed = new EmbedBuilder()
        .setColor('#9900FF')
        .setTitle(`📋 Result Sheet — ${tierList.name}`)
        .setDescription(`🎮 **Game/Mode:** ${tierList.game_mode}\n📅 **Generated:** ${new Date().toLocaleDateString()}\n👥 **Total Candidates:** ${results.length}`);

      let rank = 1;
      for (const tier of tiers) {
        const tierMembers = results.filter(r => r.tier.toUpperCase() === tier.name.toUpperCase());
        if (tierMembers.length === 0) continue;

        const emoji = getTierEmoji(tier.name);
        let sheetLines = '';
        for (const r of tierMembers) {
          const ratedDate = new Date(r.rated_at).toLocaleDateString();
          const scoreDisplay = r.score > 0 ? r.score.toString().padStart(3, ' ') : ' — ';
          const notesDisplay = r.notes ? r.notes.slice(0, 40) : '—';
          sheetLines += `**#${rank}** <@${r.user_id}>\n`;
          sheetLines += `> Score: \`${scoreDisplay}/100\` | Notes: *${notesDisplay}* | Rated: ${ratedDate} by <@${r.rated_by}>\n`;
          rank++;
        }
        embed.addFields({ name: `${emoji} **Tier ${tier.name}** — ${tier.description} (${tierMembers.length} member${tierMembers.length !== 1 ? 's' : ''})`, value: sheetLines || '*Empty*' });
      }

      const unranked = results.filter(r => !tiers.some(t => t.name.toUpperCase() === r.tier.toUpperCase()));
      if (unranked.length > 0) {
        let lines = '';
        for (const r of unranked) {
          lines += `**#${rank}** <@${r.user_id}> — Tier \`${r.tier}\`\n`;
          rank++;
        }
        embed.addFields({ name: '⚪ Other Tiers', value: lines });
      }

      embed.setFooter({ text: `Tier List ID: ${tierList.id} | Created by <@${tierList.created_by}>` }).setTimestamp();
      await interaction.reply({ embeds: [embed] });
    }

    else if (sub === 'list') {
      const lists = db.prepare('SELECT * FROM tier_lists WHERE guild_id = ? ORDER BY created_at DESC').all(guildId);
      if (lists.length === 0) {
        return interaction.reply({ embeds: [new EmbedBuilder().setColor('#0099ff').setTitle('📊 Tier Lists').setDescription('No tier lists have been created yet.\nUse `/tierlist create` to create one!')] });
      }

      const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle(`📊 Tier Lists — ${interaction.guild.name}`)
        .setDescription(`${lists.length} tier list(s) in this server:`);

      for (const list of lists.slice(0, 25)) {
        let tiers = DEFAULT_TIERS;
        try { tiers = JSON.parse(list.tiers); } catch {}
        const resultCount = db.prepare('SELECT COUNT(*) as c FROM tier_results WHERE tier_list_id = ?').get(list.id);
        const tierNames = tiers.map(t => t.name).join(', ');
        embed.addFields({
          name: `📋 ${list.name}`,
          value: `🎮 ${list.game_mode}\n🏷️ Tiers: ${tierNames}\n👥 Rated: ${resultCount.c} member(s)\n<t:${Math.floor(list.created_at / 1000)}:R>`,
          inline: true
        });
      }

      embed.setFooter({ text: 'Use /tierlist view <name> or /tierlist sheet <name>' });
      await interaction.reply({ embeds: [embed] });
    }

    else if (sub === 'delete') {
      if (!hasAdminRole(interaction.member, settings)) {
        return interaction.reply({ embeds: [errorEmbed('Only admins can delete tier lists.')], ephemeral: true });
      }
      const listName = interaction.options.getString('list_name');
      const tierList = db.prepare('SELECT * FROM tier_lists WHERE guild_id = ? AND LOWER(name) = LOWER(?)').get(guildId, listName);
      if (!tierList) return interaction.reply({ embeds: [errorEmbed(`Tier list **"${listName}"** not found.`)], ephemeral: true });

      db.prepare('DELETE FROM tier_results WHERE tier_list_id = ?').run(tierList.id);
      db.prepare('DELETE FROM tier_lists WHERE id = ?').run(tierList.id);

      await interaction.reply({ embeds: [successEmbed(`Tier list **"${tierList.name}"** and all its results have been deleted.`)] });
    }

    else if (sub === 'unrate') {
      if (!hasModRole(interaction.member, settings)) {
        return interaction.reply({ embeds: [errorEmbed('Only moderators can remove ratings.')], ephemeral: true });
      }
      const listName = interaction.options.getString('list_name');
      const member = interaction.options.getUser('member');
      const tierList = db.prepare('SELECT * FROM tier_lists WHERE guild_id = ? AND LOWER(name) = LOWER(?)').get(guildId, listName);
      if (!tierList) return interaction.reply({ embeds: [errorEmbed(`Tier list **"${listName}"** not found.`)], ephemeral: true });

      const result = db.prepare('SELECT * FROM tier_results WHERE tier_list_id = ? AND user_id = ?').get(tierList.id, member.id);
      if (!result) return interaction.reply({ embeds: [errorEmbed(`<@${member.id}> has no rating in **"${listName}"**.`)], ephemeral: true });

      db.prepare('DELETE FROM tier_results WHERE tier_list_id = ? AND user_id = ?').run(tierList.id, member.id);
      await interaction.reply({ embeds: [successEmbed(`Removed <@${member.id}>'s rating from **"${tierList.name}"**.`)] });
    }

    else if (sub === 'myresult') {
      const listName = interaction.options.getString('list_name');
      const tierList = db.prepare('SELECT * FROM tier_lists WHERE guild_id = ? AND LOWER(name) = LOWER(?)').get(guildId, listName);
      if (!tierList) return interaction.reply({ embeds: [errorEmbed(`Tier list **"${listName}"** not found.`)], ephemeral: true });

      const result = db.prepare('SELECT * FROM tier_results WHERE tier_list_id = ? AND user_id = ?').get(tierList.id, userId);
      if (!result) {
        return interaction.reply({ embeds: [new EmbedBuilder().setColor('#0099ff').setDescription(`You have not been rated in **"${tierList.name}"** yet.`)] });
      }

      let tiers = DEFAULT_TIERS;
      try { tiers = JSON.parse(tierList.tiers); } catch {}
      const tierInfo = tiers.find(t => t.name.toUpperCase() === result.tier.toUpperCase()) || { name: result.tier, color: '#ffffff', description: 'Unknown' };
      const emoji = getTierEmoji(tierInfo.name);

      const embed = new EmbedBuilder()
        .setColor(tierInfo.color)
        .setTitle(`${emoji} Your Tier Result`)
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: '📋 Tier List', value: tierList.name, inline: true },
          { name: '🎮 Game/Mode', value: tierList.game_mode, inline: true },
          { name: `${emoji} Your Tier`, value: `**${tierInfo.name}** — ${tierInfo.description}`, inline: true },
          { name: '🔢 Score', value: result.score > 0 ? `${result.score}/100` : 'Not scored', inline: true },
          { name: '📝 Notes', value: result.notes || 'No notes', inline: false },
          { name: '🧑‍⚖️ Rated By', value: `<@${result.rated_by}>`, inline: true },
          { name: '📅 Rated On', value: new Date(result.rated_at).toLocaleDateString(), inline: true },
        )
        .setTimestamp();
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
};
