const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const db = require('../database/db');
const { isAllowedGuild, getGuildSettings, getBalance, addBalance, removeBalance, successEmbed, errorEmbed } = require('../utils/helpers');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    if (!interaction.guild) return;
    if (!isAllowedGuild(interaction.guild.id)) {
      if (interaction.isRepliable()) interaction.reply({ content: '❌ This bot is not authorized in this server. Contact the bot owner.', ephemeral: true });
      return;
    }

    // Autocomplete interactions
    if (interaction.isAutocomplete()) {
      const command = client.commands.get(interaction.commandName);
      if (!command || !command.autocomplete) return;
      try {
        await command.autocomplete(interaction);
      } catch (error) {
        console.error(`[AUTOCOMPLETE ERROR] ${interaction.commandName}:`, error);
      }
      return;
    }

    // Slash commands
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      try {
        await command.execute(interaction, client);
      } catch (error) {
        console.error(`[CMD ERROR] ${interaction.commandName}:`, error);
        const reply = { embeds: [errorEmbed(`An error occurred: ${error.message}`)], ephemeral: false };
        if (interaction.replied || interaction.deferred) interaction.followUp(reply).catch(() => {});
        else interaction.reply(reply).catch(() => {});
      }
      return;
    }

    // Button interactions
    if (interaction.isButton()) {
      const [action, ...parts] = interaction.customId.split('_');

      // Verification captcha
      if (action === 'verify') {
        const settings = getGuildSettings(interaction.guild.id);
        if (!settings.verify_role) {
          return interaction.reply({ embeds: [errorEmbed('Verification role not configured. Ask an admin to set it with /admin setverifyrole.')], ephemeral: true });
        }
        const session = db.prepare('SELECT * FROM captcha_sessions WHERE user_id = ? AND guild_id = ?').get(interaction.user.id, interaction.guild.id);
        if (session) {
          return interaction.reply({ embeds: [new EmbedBuilder().setColor('#00ffff').setDescription('You already have an active captcha. Check your DMs!')], ephemeral: true });
        }
        const num1 = Math.floor(Math.random() * 20) + 1;
        const num2 = Math.floor(Math.random() * 10) + 1;
        const answer = String(num1 + num2);
        db.prepare('INSERT OR REPLACE INTO captcha_sessions (user_id, guild_id, answer, timestamp) VALUES (?, ?, ?, ?)').run(interaction.user.id, interaction.guild.id, answer, Date.now());
        try {
          const dmEmbed = new EmbedBuilder()
            .setColor('#00ffff')
            .setTitle('🔐 Server Verification')
            .setDescription(`Welcome to **${interaction.guild.name}**!\n\nTo verify, solve this math problem:\n\n**What is ${num1} + ${num2}?**\n\nReply with just the number in this DM within 2 minutes.`)
            .setFooter({ text: 'This captcha expires in 2 minutes' });
          const dm = await interaction.user.createDM();
          await dm.send({ embeds: [dmEmbed] });

          const filter = m => m.author.id === interaction.user.id;
          const collector = dm.createMessageCollector({ filter, time: 120000, max: 3 });
          collector.on('collect', async m => {
            const sess = db.prepare('SELECT * FROM captcha_sessions WHERE user_id = ? AND guild_id = ?').get(interaction.user.id, interaction.guild.id);
            if (!sess) { collector.stop(); return; }
            if (m.content.trim() === sess.answer) {
              db.prepare('DELETE FROM captcha_sessions WHERE user_id = ? AND guild_id = ?').run(interaction.user.id, interaction.guild.id);
              const role = interaction.guild.roles.cache.get(settings.verify_role);
              const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
              if (member && role) {
                await member.roles.add(role).catch(() => {});
                dm.send({ embeds: [new EmbedBuilder().setColor('#00ff00').setDescription(`✅ You are now verified in **${interaction.guild.name}**!`)] });
              }
              collector.stop();
            } else {
              db.prepare('UPDATE captcha_sessions SET attempts = attempts + 1 WHERE user_id = ? AND guild_id = ?').run(interaction.user.id, interaction.guild.id);
              const updated = db.prepare('SELECT * FROM captcha_sessions WHERE user_id = ? AND guild_id = ?').get(interaction.user.id, interaction.guild.id);
              if (updated.attempts >= 3) {
                db.prepare('DELETE FROM captcha_sessions WHERE user_id = ? AND guild_id = ?').run(interaction.user.id, interaction.guild.id);
                dm.send({ embeds: [errorEmbed('Too many wrong answers. Please click Verify again.')] });
                collector.stop();
              } else {
                dm.send({ embeds: [errorEmbed(`Incorrect! ${3 - updated.attempts} attempts remaining.`)] });
              }
            }
          });
          collector.on('end', (_, reason) => {
            if (reason === 'time') {
              db.prepare('DELETE FROM captcha_sessions WHERE user_id = ? AND guild_id = ?').run(interaction.user.id, interaction.guild.id);
              dm.send({ embeds: [errorEmbed('Captcha expired. Please click Verify again.')] }).catch(() => {});
            }
          });
          await interaction.reply({ embeds: [new EmbedBuilder().setColor('#00ffff').setDescription('📩 Check your DMs for the captcha!')], ephemeral: true });
        } catch {
          await interaction.reply({ embeds: [errorEmbed('I could not DM you. Please enable DMs from server members.')], ephemeral: true });
        }
        return;
      }

      // Auction bid
      if (action === 'bid') {
        const auctionId = parts[0];
        const auction = db.prepare('SELECT * FROM auctions WHERE id = ? AND active = 1').get(auctionId);
        if (!auction) return interaction.reply({ embeds: [errorEmbed('This auction has ended.')], ephemeral: true });
        const bal = getBalance(interaction.user.id, interaction.guild.id);
        const minBid = auction.current_bid > 0 ? auction.current_bid + 1 : auction.start_price;
        if (bal < minBid) return interaction.reply({ embeds: [errorEmbed(`You need at least **${minBid} Minecoins** to bid. Your balance: **${bal}**`)], ephemeral: true });

        const { ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
        const modal = new ModalBuilder().setCustomId(`bidmodal_${auctionId}`).setTitle('Place Your Bid');
        const input = new TextInputBuilder().setCustomId('bidamount').setLabel(`Min bid: ${minBid} Minecoins (Bal: ${bal})`).setStyle(TextInputStyle.Short).setPlaceholder(`Enter amount (min ${minBid})`).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
        return;
      }

      // Report buttons
      if (action === 'claimreport') {
        const reportId = parts[0];
        const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(reportId);
        if (!report) return interaction.reply({ embeds: [errorEmbed('Report not found.')], ephemeral: true });
        db.prepare('UPDATE reports SET status = ?, claimer = ? WHERE id = ?').run('claimed', interaction.user.id, reportId);
        const embed = EmbedBuilder.from(interaction.message.embeds[0]).setColor('#ffaa00').setFooter({ text: `Claimed by ${interaction.user.tag}` });
        await interaction.update({ embeds: [embed] });
        return;
      }

      if (action === 'closereport') {
        const reportId = parts[0];
        db.prepare('UPDATE reports SET status = ? WHERE id = ?').run('closed', reportId);
        const embed = EmbedBuilder.from(interaction.message.embeds[0]).setColor('#00ff00').setFooter({ text: `Closed by ${interaction.user.tag}` });
        await interaction.update({ embeds: [embed] });
        return;
      }

      if (action === 'priorityreport') {
        const reportId = parts[0];
        const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(reportId);
        if (!report) return;
        const newPrio = report.priority ? 0 : 1;
        db.prepare('UPDATE reports SET priority = ? WHERE id = ?').run(newPrio, reportId);
        const embed = EmbedBuilder.from(interaction.message.embeds[0]).setColor(newPrio ? '#ff0000' : '#ffff00').setFooter({ text: newPrio ? '🔴 High Priority' : '🟡 Normal Priority' });
        await interaction.update({ embeds: [embed] });
        return;
      }

      // Giveaway join
      if (action === 'joingiveaway') {
        const gId = parts[0];
        const giveaway = db.prepare('SELECT * FROM giveaways WHERE id = ? AND active = 1').get(gId);
        if (!giveaway) return interaction.reply({ embeds: [errorEmbed('This giveaway has ended.')], ephemeral: true });
        let entries = [];
        try { entries = JSON.parse(giveaway.entries); } catch {}
        if (entries.includes(interaction.user.id)) return interaction.reply({ embeds: [errorEmbed('You already joined this giveaway!')], ephemeral: true });
        entries.push(interaction.user.id);
        db.prepare('UPDATE giveaways SET entries = ? WHERE id = ?').run(JSON.stringify(entries), gId);
        await interaction.reply({ embeds: [successEmbed(`You joined the giveaway! Total entries: **${entries.length}**`)], ephemeral: true });
        return;
      }
    }

    // Modal submissions
    if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith('bidmodal_')) {
        const auctionId = interaction.customId.split('_')[1];
        const amtStr = interaction.fields.getTextInputValue('bidamount');
        const amount = parseInt(amtStr);
        if (isNaN(amount) || amount <= 0) return interaction.reply({ embeds: [errorEmbed('Invalid bid amount.')], ephemeral: true });
        const auction = db.prepare('SELECT * FROM auctions WHERE id = ? AND active = 1').get(auctionId);
        if (!auction) return interaction.reply({ embeds: [errorEmbed('Auction no longer active.')], ephemeral: true });
        const minBid = auction.current_bid > 0 ? auction.current_bid + 1 : auction.start_price;
        if (amount < minBid) return interaction.reply({ embeds: [errorEmbed(`Bid must be at least **${minBid} Minecoins**.`)], ephemeral: true });
        const bal = getBalance(interaction.user.id, interaction.guild.id);
        if (bal < amount) return interaction.reply({ embeds: [errorEmbed(`Insufficient balance. You have **${bal} Minecoins**.`)], ephemeral: true });
        db.prepare('UPDATE auctions SET current_bid = ?, highest_bidder = ? WHERE id = ?').run(amount, interaction.user.id, auctionId);
        try {
          const ch = interaction.guild.channels.cache.get(auction.channel_id);
          if (ch && auction.message_id) {
            const msg = await ch.messages.fetch(auction.message_id).catch(() => null);
            if (msg) {
              const updAuction = db.prepare('SELECT * FROM auctions WHERE id = ?').get(auctionId);
              const embed = EmbedBuilder.from(msg.embeds[0]).setFields(
                { name: '🎭 Role', value: `<@&${updAuction.role_id}>`, inline: true },
                { name: '💰 Starting Price', value: `${updAuction.start_price} Minecoins`, inline: true },
                { name: '🏆 Current Bid', value: `${updAuction.current_bid} Minecoins`, inline: true },
                { name: '👑 Highest Bidder', value: `<@${updAuction.highest_bidder}>`, inline: true },
              );
              msg.edit({ embeds: [embed] }).catch(() => {});
            }
          }
        } catch {}
        await interaction.reply({ embeds: [successEmbed(`Bid of **${amount} Minecoins** placed!`)], ephemeral: true });
        return;
      }
    }

    // Select menus
    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === 'timezone_select') {
        const { getTimeForTimezone } = require('./timezoneHelper');
        const tz = interaction.values[0];
        const time = getTimeForTimezone(tz);
        const embed = new EmbedBuilder().setColor('#00ffff').setTitle('🕐 Current Time').setDescription(`**Timezone:** ${tz}\n**Current Time:** ${time}`).setTimestamp();
        await interaction.reply({ embeds: [embed] });
        return;
      }
    }
  }
};
