const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const db = require('../database/db');
const { getGuildSettings, hasAdminRole, hasModRole, errorEmbed, successEmbed } = require('../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Giveaway commands')
    .addSubcommand(s => s.setName('start').setDescription('Start a giveaway')
      .addStringOption(o => o.setName('prize').setDescription('Prize name').setRequired(true))
      .addIntegerOption(o => o.setName('minutes').setDescription('Duration in minutes').setRequired(true).setMinValue(1))
      .addIntegerOption(o => o.setName('winners').setDescription('Number of winners').setRequired(false).setMinValue(1).setMaxValue(10)))
    .addSubcommand(s => s.setName('end').setDescription('End a giveaway early').addIntegerOption(o => o.setName('id').setDescription('Giveaway ID').setRequired(true)))
    .addSubcommand(s => s.setName('list').setDescription('List active giveaways'))
    .addSubcommand(s => s.setName('reroll').setDescription('Reroll a giveaway winner').addIntegerOption(o => o.setName('id').setDescription('Giveaway ID').setRequired(true))),

  async execute(interaction) {
    const settings = getGuildSettings(interaction.guild.id);
    const sub = interaction.options.getSubcommand();

    if (['start', 'end', 'reroll'].includes(sub) && !hasModRole(interaction.member, settings)) {
      return interaction.reply({ embeds: [errorEmbed('You need mod or admin role to manage giveaways.')], ephemeral: true });
    }

    if (sub === 'start') {
      const prize = interaction.options.getString('prize');
      const minutes = interaction.options.getInteger('minutes');
      const winners = interaction.options.getInteger('winners') || 1;
      const endTime = Date.now() + minutes * 60 * 1000;

      const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🎉 GIVEAWAY!')
        .setDescription(`**Prize:** ${prize}\n\nClick the button below to enter!`)
        .addFields(
          { name: '🏆 Winners', value: `${winners}`, inline: true },
          { name: '⏰ Ends In', value: `${minutes} minutes`, inline: true },
          { name: '🎟️ Entries', value: '0', inline: true },
          { name: '🎁 Hosted by', value: interaction.user.tag, inline: true }
        )
        .setFooter({ text: `Ends at` })
        .setTimestamp(endTime);

      const result = db.prepare('INSERT INTO giveaways (guild_id, channel_id, prize, winners, host_id, end_time) VALUES (?, ?, ?, ?, ?, ?)').run(interaction.guild.id, interaction.channel.id, prize, winners, interaction.user.id, endTime);
      const gId = result.lastInsertRowid;

      const joinBtn = new ButtonBuilder().setCustomId(`joingiveaway_${gId}`).setLabel('🎉 Enter Giveaway').setStyle(ButtonStyle.Primary);
      const row = new ActionRowBuilder().addComponents(joinBtn);

      const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
      db.prepare('UPDATE giveaways SET message_id = ? WHERE id = ?').run(msg.id, gId);
    }

    else if (sub === 'end') {
      const id = interaction.options.getInteger('id');
      const giveaway = db.prepare('SELECT * FROM giveaways WHERE id = ? AND guild_id = ?').get(id, interaction.guild.id);
      if (!giveaway) return interaction.reply({ embeds: [errorEmbed(`Giveaway #${id} not found.`)], ephemeral: true });
      if (!giveaway.active) return interaction.reply({ embeds: [errorEmbed(`Giveaway #${id} has already ended.`)], ephemeral: true });

      db.prepare('UPDATE giveaways SET active = 0, end_time = ? WHERE id = ?').run(Date.now(), id);
      let entries = [];
      try { entries = JSON.parse(giveaway.entries); } catch {}
      if (entries.length === 0) return interaction.reply({ embeds: [successEmbed(`Giveaway #${id} ended. No entries — no winner.`)] });

      const pool = [...entries];
      const winners = [];
      for (let i = 0; i < Math.min(giveaway.winners, pool.length); i++) {
        const idx = Math.floor(Math.random() * pool.length);
        winners.push(pool.splice(idx, 1)[0]);
      }

      const embed = new EmbedBuilder().setColor('#00ff00').setTitle('🎉 Giveaway Ended!')
        .setDescription(`**Prize:** ${giveaway.prize}\n**Winner(s):** ${winners.map(w => `<@${w}>`).join(', ')}`).setTimestamp();
      await interaction.reply({ content: winners.map(w => `<@${w}>`).join(', '), embeds: [embed] });
    }

    else if (sub === 'list') {
      const list = db.prepare('SELECT * FROM giveaways WHERE guild_id = ? AND active = 1').all(interaction.guild.id);
      if (list.length === 0) return interaction.reply({ embeds: [new EmbedBuilder().setColor('#ffaa00').setDescription('No active giveaways.')] });
      const embed = new EmbedBuilder().setColor('#FFD700').setTitle('🎉 Active Giveaways');
      list.forEach(g => {
        const timeLeft = Math.max(0, Math.floor((g.end_time - Date.now()) / 60000));
        embed.addFields({ name: `#${g.id} — ${g.prize}`, value: `Winners: ${g.winners} | Ends in: ${timeLeft}m`, inline: false });
      });
      await interaction.reply({ embeds: [embed] });
    }

    else if (sub === 'reroll') {
      const id = interaction.options.getInteger('id');
      const giveaway = db.prepare('SELECT * FROM giveaways WHERE id = ? AND guild_id = ?').get(id, interaction.guild.id);
      if (!giveaway) return interaction.reply({ embeds: [errorEmbed(`Giveaway #${id} not found.`)], ephemeral: true });
      let entries = [];
      try { entries = JSON.parse(giveaway.entries); } catch {}
      if (entries.length === 0) return interaction.reply({ embeds: [errorEmbed('No entries to reroll.')] });
      const winner = entries[Math.floor(Math.random() * entries.length)];
      await interaction.reply({ embeds: [new EmbedBuilder().setColor('#FFD700').setTitle('🔄 Giveaway Rerolled!').setDescription(`New winner: <@${winner}>! Congratulations! 🎊`)], content: `<@${winner}>` });
    }
  }
};
