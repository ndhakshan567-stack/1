const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const db = require('../database/db');
const { getGuildSettings, hasAdminRole, getBalance, addBalance, removeBalance, errorEmbed, successEmbed } = require('../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('auction')
    .setDescription('Auction commands')
    .addSubcommand(s => s.setName('start').setDescription('Start a role auction')
      .addRoleOption(o => o.setName('role').setDescription('Role to auction').setRequired(true))
      .addIntegerOption(o => o.setName('startprice').setDescription('Starting bid price in Minecoins').setRequired(true).setMinValue(1)))
    .addSubcommand(s => s.setName('end').setDescription('End an auction and select the winner')
      .addIntegerOption(o => o.setName('id').setDescription('Auction ID').setRequired(true)))
    .addSubcommand(s => s.setName('list').setDescription('List all active auctions'))
    .addSubcommand(s => s.setName('info').setDescription('View details of an auction')
      .addIntegerOption(o => o.setName('id').setDescription('Auction ID').setRequired(true))),

  async execute(interaction) {
    const settings = getGuildSettings(interaction.guild.id);
    const sub = interaction.options.getSubcommand();

    if (sub === 'start') {
      if (!hasAdminRole(interaction.member, settings)) return interaction.reply({ embeds: [errorEmbed('Only admins can start auctions.')], ephemeral: true });
      const role = interaction.options.getRole('role');
      const startPrice = interaction.options.getInteger('startprice');

      const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🔨 Auction Started!')
        .setDescription(`A new auction has been listed! Bid to win **${role.name}**!`)
        .addFields(
          { name: '🎭 Role', value: `<@&${role.id}>`, inline: true },
          { name: '💰 Starting Price', value: `${startPrice} Minecoins`, inline: true },
          { name: '🏆 Current Bid', value: '0 Minecoins', inline: true },
          { name: '👑 Highest Bidder', value: 'None yet', inline: true },
          { name: '📌 Host', value: `${interaction.user.tag}`, inline: true }
        )
        .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
        .setFooter({ text: 'Click the button below to place your bid!' })
        .setTimestamp();

      const result = db.prepare('INSERT INTO auctions (guild_id, role_id, role_name, start_price, seller_id) VALUES (?, ?, ?, ?, ?)').run(interaction.guild.id, role.id, role.name, startPrice, interaction.user.id);
      const auctionId = result.lastInsertRowid;
      embed.setTitle(`🔨 Auction #${auctionId} Started!`);

      const bidBtn = new ButtonBuilder().setCustomId(`bid_${auctionId}`).setLabel('💎 Place Bid').setStyle(ButtonStyle.Primary);
      const row = new ActionRowBuilder().addComponents(bidBtn);

      const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
      db.prepare('UPDATE auctions SET message_id = ?, channel_id = ? WHERE id = ?').run(msg.id, interaction.channel.id, auctionId);

      const logCh = settings.log_channel ? interaction.guild.channels.cache.get(settings.log_channel) : null;
      if (logCh) logCh.send({ embeds: [new EmbedBuilder().setColor('#FFD700').setTitle('🔨 Auction Started').setDescription(`Auction #${auctionId} for **${role.name}** started by ${interaction.user.tag}`).setTimestamp()] }).catch(() => {});
    }

    else if (sub === 'end') {
      if (!hasAdminRole(interaction.member, settings) && interaction.guild.ownerId !== interaction.user.id) {
        return interaction.reply({ embeds: [errorEmbed('Only the server owner or admins can end auctions.')], ephemeral: true });
      }
      const id = interaction.options.getInteger('id');
      const auction = db.prepare('SELECT * FROM auctions WHERE id = ? AND guild_id = ?').get(id, interaction.guild.id);
      if (!auction) return interaction.reply({ embeds: [errorEmbed(`Auction #${id} not found.`)], ephemeral: true });
      if (!auction.active) return interaction.reply({ embeds: [errorEmbed(`Auction #${id} has already ended.`)], ephemeral: true });
      if (!auction.highest_bidder) return interaction.reply({ embeds: [errorEmbed('No bids placed yet. End anyway with force.')], ephemeral: true });

      db.prepare('UPDATE auctions SET active = 0 WHERE id = ?').run(id);
      const winner = await interaction.guild.members.fetch(auction.highest_bidder).catch(() => null);
      const role = interaction.guild.roles.cache.get(auction.role_id);

      if (winner && role) {
        await winner.roles.add(role).catch(() => {});
        removeBalance(auction.highest_bidder, interaction.guild.id, auction.current_bid);
        addBalance(auction.seller_id, interaction.guild.id, auction.current_bid);
      }

      const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle(`🎉 Auction #${id} Ended!`)
        .setDescription(`The auction for **${auction.role_name}** has concluded!`)
        .addFields(
          { name: '🏆 Winner', value: winner ? `${winner.user.tag}` : 'Unknown', inline: true },
          { name: '💰 Winning Bid', value: `${auction.current_bid} Minecoins`, inline: true },
          { name: '💸 Seller Received', value: `${auction.current_bid} Minecoins`, inline: true }
        ).setTimestamp();

      await interaction.reply({ embeds: [embed] });
      const logCh = settings.log_channel ? interaction.guild.channels.cache.get(settings.log_channel) : null;
      if (logCh) logCh.send({ embeds: [embed] }).catch(() => {});
    }

    else if (sub === 'list') {
      const auctions = db.prepare('SELECT * FROM auctions WHERE guild_id = ? AND active = 1').all(interaction.guild.id);
      if (auctions.length === 0) return interaction.reply({ embeds: [new EmbedBuilder().setColor('#ffaa00').setDescription('No active auctions at the moment.')] });
      const embed = new EmbedBuilder().setColor('#FFD700').setTitle('🔨 Active Auctions');
      auctions.forEach(a => {
        embed.addFields({ name: `Auction #${a.id} — ${a.role_name}`, value: `💰 Starting: **${a.start_price}** | 🏆 Current: **${a.current_bid}**\n👑 Highest: ${a.highest_bidder ? `<@${a.highest_bidder}>` : 'None'}`, inline: false });
      });
      await interaction.reply({ embeds: [embed] });
    }

    else if (sub === 'info') {
      const id = interaction.options.getInteger('id');
      const auction = db.prepare('SELECT * FROM auctions WHERE id = ? AND guild_id = ?').get(id, interaction.guild.id);
      if (!auction) return interaction.reply({ embeds: [errorEmbed(`Auction #${id} not found.`)], ephemeral: true });
      const embed = new EmbedBuilder()
        .setColor(auction.active ? '#FFD700' : '#888888')
        .setTitle(`🔨 Auction #${id} Info`)
        .addFields(
          { name: '🎭 Role', value: `<@&${auction.role_id}>`, inline: true },
          { name: '📌 Status', value: auction.active ? '🟢 Active' : '🔴 Ended', inline: true },
          { name: '💰 Starting Price', value: `${auction.start_price} Minecoins`, inline: true },
          { name: '🏆 Current Bid', value: `${auction.current_bid} Minecoins`, inline: true },
          { name: '👑 Highest Bidder', value: auction.highest_bidder ? `<@${auction.highest_bidder}>` : 'None', inline: true },
          { name: '📌 Seller', value: `<@${auction.seller_id}>`, inline: true }
        ).setTimestamp();
      const row = auction.active ? new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`bid_${id}`).setLabel('💎 Place Bid').setStyle(ButtonStyle.Primary)) : null;
      await interaction.reply({ embeds: [embed], components: row ? [row] : [] });
    }
  }
};
