const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database/db');
const { hasModRole, getGuildSettings, errorEmbed, successEmbed } = require('../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('poll')
    .setDescription('Poll commands')
    .addSubcommand(s => s.setName('create').setDescription('Create a poll')
      .addStringOption(o => o.setName('question').setDescription('Poll question').setRequired(true))
      .addStringOption(o => o.setName('options').setDescription('Options separated by | (e.g. Yes|No|Maybe)').setRequired(true))
      .addIntegerOption(o => o.setName('minutes').setDescription('Poll duration in minutes (0 = no expiry)').setRequired(false)))
    .addSubcommand(s => s.setName('end').setDescription('End a poll and show results').addIntegerOption(o => o.setName('id').setDescription('Poll ID').setRequired(true))),

  async execute(interaction) {
    const settings = getGuildSettings(interaction.guild.id);
    const sub = interaction.options.getSubcommand();

    if (sub === 'create') {
      if (!hasModRole(interaction.member, settings)) return interaction.reply({ embeds: [errorEmbed('You need mod role to create polls.')], ephemeral: true });
      const question = interaction.options.getString('question');
      const optionsRaw = interaction.options.getString('options');
      const minutes = interaction.options.getInteger('minutes') || 0;
      const options = optionsRaw.split('|').map(o => o.trim()).filter(o => o.length > 0);
      if (options.length < 2) return interaction.reply({ embeds: [errorEmbed('You need at least 2 options separated by |')], ephemeral: true });
      if (options.length > 10) return interaction.reply({ embeds: [errorEmbed('Maximum 10 options allowed.')], ephemeral: true });

      const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
      const endTime = minutes > 0 ? Date.now() + minutes * 60 * 1000 : null;

      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle(`📊 Poll: ${question}`)
        .setDescription(options.map((o, i) => `${emojis[i]} **${o}**`).join('\n'))
        .setFooter({ text: `Poll by ${interaction.user.tag}${minutes > 0 ? ` | Ends in ${minutes}m` : ' | No expiry'}` })
        .setTimestamp();

      const result = db.prepare('INSERT INTO polls (guild_id, channel_id, question, options, end_time) VALUES (?, ?, ?, ?, ?)').run(interaction.guild.id, interaction.channel.id, question, JSON.stringify(options), endTime);
      const pollId = result.lastInsertRowid;
      embed.setTitle(`📊 Poll #${pollId}: ${question}`);

      const msg = await interaction.reply({ embeds: [embed], fetchReply: true });
      db.prepare('UPDATE polls SET message_id = ? WHERE id = ?').run(msg.id, pollId);

      // Add reactions
      for (let i = 0; i < options.length; i++) {
        await msg.react(emojis[i]).catch(() => {});
      }
    }

    else if (sub === 'end') {
      if (!hasModRole(interaction.member, settings)) return interaction.reply({ embeds: [errorEmbed('You need mod role to end polls.')], ephemeral: true });
      const id = interaction.options.getInteger('id');
      const poll = db.prepare('SELECT * FROM polls WHERE id = ? AND guild_id = ?').get(id, interaction.guild.id);
      if (!poll) return interaction.reply({ embeds: [errorEmbed(`Poll #${id} not found.`)], ephemeral: true });
      if (!poll.active) return interaction.reply({ embeds: [errorEmbed(`Poll #${id} has already ended.`)], ephemeral: true });

      db.prepare('UPDATE polls SET active = 0 WHERE id = ?').run(id);

      let options = [];
      try { options = JSON.parse(poll.options); } catch {}

      // Fetch reaction counts from the message
      const channel = interaction.guild.channels.cache.get(poll.channel_id);
      let results = options.map(o => ({ option: o, votes: 0 }));
      if (channel && poll.message_id) {
        try {
          const msg = await channel.messages.fetch(poll.message_id);
          const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
          results = options.map((o, i) => {
            const reaction = msg.reactions.cache.get(emojis[i]);
            return { option: o, votes: reaction ? reaction.count - 1 : 0 }; // -1 for bot reaction
          });
        } catch {}
      }

      const total = results.reduce((a, r) => a + r.votes, 0);
      const winner = results.reduce((a, b) => a.votes >= b.votes ? a : b);

      const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle(`📊 Poll #${id} Results: ${poll.question}`)
        .setDescription(results.map(r => {
          const pct = total > 0 ? Math.round((r.votes / total) * 100) : 0;
          const bar = '█'.repeat(Math.floor(pct / 5)) + '░'.repeat(20 - Math.floor(pct / 5));
          return `**${r.option}**\n${bar} **${pct}%** (${r.votes} votes)`;
        }).join('\n\n'))
        .addFields({ name: '🏆 Winner', value: `**${winner.option}** with ${winner.votes} votes!` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    }
  }
};
