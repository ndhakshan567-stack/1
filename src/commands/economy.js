const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database/db');
const { getBalance, getBankBalance, addBalance, removeBalance, addBankBalance, removeBankBalance, getGuildSettings, hasAdminRole, errorEmbed, successEmbed } = require('../utils/helpers');

const WORK_JOBS = [
  { job: 'Software Developer', action: 'wrote some code', min: 80, max: 200 },
  { job: 'Pizza Delivery', action: 'delivered pizzas', min: 40, max: 120 },
  { job: 'Streamer', action: 'streamed for your viewers', min: 50, max: 250 },
  { job: 'Mercenary', action: 'completed a contract', min: 100, max: 300 },
  { job: 'Fisherman', action: 'caught a big haul', min: 30, max: 150 },
  { job: 'Miner', action: 'mined some ores', min: 60, max: 180 },
  { job: 'Trader', action: 'made some trades', min: 50, max: 200 },
  { job: 'Builder', action: 'finished a construction job', min: 70, max: 160 },
  { job: 'Chef', action: 'served many customers', min: 45, max: 130 },
  { job: 'Hacker', action: 'completed a hack job', min: 90, max: 280 },
];

const SLOT_SYMBOLS = ['🍒', '🍋', '🍊', '🍇', '⭐', '💎', '🔔', '7️⃣'];
const SLOT_WEIGHTS = [30, 25, 20, 15, 5, 3, 1.5, 0.5];

function spinSlots() {
  const spin = () => {
    const total = SLOT_WEIGHTS.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < SLOT_SYMBOLS.length; i++) {
      r -= SLOT_WEIGHTS[i];
      if (r <= 0) return SLOT_SYMBOLS[i];
    }
    return SLOT_SYMBOLS[0];
  };
  return [spin(), spin(), spin()];
}

function calcSlotMultiplier(reels) {
  const [a, b, c] = reels;
  if (a === b && b === c) {
    if (a === '7️⃣') return 50;
    if (a === '💎') return 25;
    if (a === '⭐') return 15;
    if (a === '🔔') return 10;
    if (a === '🍇') return 7;
    return 5;
  }
  if (a === b || b === c || a === c) {
    if (a === '7️⃣' || b === '7️⃣' || c === '7️⃣') return 2;
    return 1.5;
  }
  return 0;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('economy')
    .setDescription('Economy commands')
    .addSubcommand(s => s.setName('balance').setDescription('Check your wallet and bank balance')
      .addUserOption(o => o.setName('user').setDescription('Check another user').setRequired(false)))
    .addSubcommand(s => s.setName('daily').setDescription('Claim your daily Minecoins (resets every 24h, streaks give bonuses!)'))
    .addSubcommand(s => s.setName('work').setDescription('Work to earn Minecoins (30 minute cooldown)'))
    .addSubcommand(s => s.setName('transfer').setDescription('Transfer Minecoins to another user')
      .addUserOption(o => o.setName('user').setDescription('Recipient').setRequired(true))
      .addIntegerOption(o => o.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1)))
    .addSubcommand(s => s.setName('leaderboard').setDescription('Top Minecoin holders in this server'))
    .addSubcommand(s => s.setName('shop').setDescription('View the role shop'))
    .addSubcommand(s => s.setName('buy').setDescription('Buy a role from the shop')
      .addStringOption(o => o.setName('rolename').setDescription('Role name to buy').setRequired(true)))
    .addSubcommand(s => s.setName('loan').setDescription('Request a Minecoin loan from the bank')
      .addIntegerOption(o => o.setName('amount').setDescription('Amount (max based on activity)').setRequired(true).setMinValue(10)))
    .addSubcommand(s => s.setName('repay').setDescription('Repay your active loan')
      .addIntegerOption(o => o.setName('amount').setDescription('Amount to repay').setRequired(true).setMinValue(1)))
    .addSubcommand(s => s.setName('deposit').setDescription('Deposit Minecoins into your bank (safe from robbery)')
      .addIntegerOption(o => o.setName('amount').setDescription('Amount to deposit (or "all")').setRequired(true).setMinValue(1)))
    .addSubcommand(s => s.setName('withdraw').setDescription('Withdraw Minecoins from your bank')
      .addIntegerOption(o => o.setName('amount').setDescription('Amount to withdraw').setRequired(true).setMinValue(1)))
    .addSubcommand(s => s.setName('rob').setDescription('Try to rob another user\'s wallet (risky!)')
      .addUserOption(o => o.setName('user').setDescription('User to rob').setRequired(true)))
    .addSubcommand(s => s.setName('slots').setDescription('Play the slot machine (gamble Minecoins)')
      .addIntegerOption(o => o.setName('bet').setDescription('Amount to bet').setRequired(true).setMinValue(10)))
    .addSubcommand(s => s.setName('bet').setDescription('Bet Minecoins on a coin flip')
      .addIntegerOption(o => o.setName('amount').setDescription('Amount to bet').setRequired(true).setMinValue(10))
      .addStringOption(o => o.setName('choice').setDescription('Heads or Tails').setRequired(true).addChoices({ name: 'Heads', value: 'heads' }, { name: 'Tails', value: 'tails' })))
    .addSubcommand(s => s.setName('adminadd').setDescription('[Admin] Add Minecoins to a user')
      .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
      .addIntegerOption(o => o.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1)))
    .addSubcommand(s => s.setName('adminremove').setDescription('[Admin] Remove Minecoins from a user')
      .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
      .addIntegerOption(o => o.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1))),

  async execute(interaction) {
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;
    const sub = interaction.options.getSubcommand();
    const settings = getGuildSettings(guildId);

    if (sub === 'balance') {
      const target = interaction.options.getUser('user') || interaction.user;
      const wallet = getBalance(target.id, guildId);
      const bank = getBankBalance(target.id, guildId);
      const userData = db.prepare('SELECT total_messages FROM user_balances WHERE user_id = ? AND guild_id = ?').get(target.id, guildId);
      const msgs = userData?.total_messages || 0;
      const dailyData = db.prepare('SELECT streak FROM daily_rewards WHERE user_id = ? AND guild_id = ?').get(target.id, guildId);
      const streak = dailyData?.streak || 0;
      const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle(`💰 ${target.username}'s Economy`)
        .setThumbnail(target.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: '👛 Wallet', value: `**${wallet.toLocaleString()}** Minecoins`, inline: true },
          { name: '🏦 Bank', value: `**${bank.toLocaleString()}** Minecoins`, inline: true },
          { name: '💼 Total Net Worth', value: `**${(wallet + bank).toLocaleString()}** Minecoins`, inline: true },
          { name: '💬 Messages', value: `${msgs.toLocaleString()}`, inline: true },
          { name: '🔥 Daily Streak', value: `${streak} day(s)`, inline: true },
        )
        .setFooter({ text: 'Bank is safe from robbery • Wallet can be robbed' })
        .setTimestamp();
      await interaction.reply({ embeds: [embed] });
    }

    else if (sub === 'daily') {
      const now = Date.now();
      const dayMs = 24 * 60 * 60 * 1000;
      let dailyData = db.prepare('SELECT * FROM daily_rewards WHERE user_id = ? AND guild_id = ?').get(userId, guildId);

      if (!dailyData) {
        db.prepare('INSERT INTO daily_rewards (user_id, guild_id, last_daily, streak) VALUES (?, ?, 0, 0)').run(userId, guildId);
        dailyData = { last_daily: 0, streak: 0 };
      }

      const timeSince = now - dailyData.last_daily;
      if (timeSince < dayMs) {
        const remaining = dayMs - timeSince;
        const hours = Math.floor(remaining / 3600000);
        const mins = Math.floor((remaining % 3600000) / 60000);
        return interaction.reply({ embeds: [errorEmbed(`You already claimed your daily! Come back in **${hours}h ${mins}m**.`)], ephemeral: true });
      }

      const isStreak = timeSince < dayMs * 2;
      const newStreak = isStreak ? dailyData.streak + 1 : 1;
      const baseReward = Math.floor(Math.random() * 200) + 100; // 100-300
      const streakBonus = Math.floor(baseReward * Math.min(newStreak * 0.05, 1)); // up to +100%
      const total = baseReward + streakBonus;

      addBalance(userId, guildId, total);
      db.prepare('UPDATE daily_rewards SET last_daily = ?, streak = ? WHERE user_id = ? AND guild_id = ?').run(now, newStreak, userId, guildId);

      const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🎁 Daily Reward Claimed!')
        .addFields(
          { name: '💎 Base Reward', value: `${baseReward} Minecoins`, inline: true },
          { name: '🔥 Streak Bonus', value: streakBonus > 0 ? `+${streakBonus} Minecoins` : 'None', inline: true },
          { name: '💰 Total Earned', value: `**${total} Minecoins**`, inline: true },
          { name: '🔥 Current Streak', value: `${newStreak} day(s)`, inline: true },
          { name: '👛 New Balance', value: `${getBalance(userId, guildId).toLocaleString()} Minecoins`, inline: true },
        )
        .setFooter({ text: isStreak ? `Keep your streak going! Come back tomorrow for day ${newStreak + 1}!` : 'Streak reset. Come back daily to build your streak!' })
        .setTimestamp();
      await interaction.reply({ embeds: [embed] });
    }

    else if (sub === 'work') {
      const now = Date.now();
      const cooldownMs = 30 * 60 * 1000;
      let workData = db.prepare('SELECT * FROM work_cooldowns WHERE user_id = ? AND guild_id = ?').get(userId, guildId);

      if (workData && now - workData.last_work < cooldownMs) {
        const remaining = cooldownMs - (now - workData.last_work);
        const mins = Math.floor(remaining / 60000);
        const secs = Math.floor((remaining % 60000) / 1000);
        return interaction.reply({ embeds: [errorEmbed(`You're tired from working! Rest for **${mins}m ${secs}s** more.`)], ephemeral: true });
      }

      const job = WORK_JOBS[Math.floor(Math.random() * WORK_JOBS.length)];
      const earned = Math.floor(Math.random() * (job.max - job.min)) + job.min;
      addBalance(userId, guildId, earned);

      if (!workData) {
        db.prepare('INSERT INTO work_cooldowns (user_id, guild_id, last_work) VALUES (?, ?, ?)').run(userId, guildId, now);
      } else {
        db.prepare('UPDATE work_cooldowns SET last_work = ? WHERE user_id = ? AND guild_id = ?').run(now, userId, guildId);
      }

      const embed = new EmbedBuilder()
        .setColor('#00aa00')
        .setTitle(`💼 Work Complete — ${job.job}`)
        .setDescription(`You ${job.action} and earned **${earned} Minecoins**!`)
        .addFields(
          { name: '💰 Earned', value: `${earned} Minecoins`, inline: true },
          { name: '👛 New Balance', value: `${getBalance(userId, guildId).toLocaleString()} Minecoins`, inline: true },
          { name: '⏰ Next Work', value: 'In 30 minutes', inline: true }
        )
        .setTimestamp();
      await interaction.reply({ embeds: [embed] });
    }

    else if (sub === 'transfer') {
      const target = interaction.options.getUser('user');
      const amount = interaction.options.getInteger('amount');
      if (target.id === userId) return interaction.reply({ embeds: [errorEmbed("You can't transfer to yourself.")], ephemeral: true });
      if (target.bot) return interaction.reply({ embeds: [errorEmbed("You can't transfer to a bot.")], ephemeral: true });
      const bal = getBalance(userId, guildId);
      if (bal < amount) return interaction.reply({ embeds: [errorEmbed(`Insufficient balance. You have **${bal} Minecoins**.`)], ephemeral: true });
      removeBalance(userId, guildId, amount);
      addBalance(target.id, guildId, amount);
      const embed = new EmbedBuilder().setColor('#00ff00').setTitle('💸 Transfer Successful')
        .addFields(
          { name: '📤 From', value: interaction.user.tag, inline: true },
          { name: '📥 To', value: target.tag, inline: true },
          { name: '💎 Amount', value: `${amount} Minecoins`, inline: true },
          { name: '💰 Your New Balance', value: `${getBalance(userId, guildId)} Minecoins`, inline: true }
        ).setTimestamp();
      await interaction.reply({ embeds: [embed] });
    }

    else if (sub === 'leaderboard') {
      const top = db.prepare('SELECT user_id, balance, bank FROM user_balances WHERE guild_id = ? ORDER BY (balance + bank) DESC LIMIT 10').all(guildId);
      if (top.length === 0) return interaction.reply({ embeds: [errorEmbed('No economy data yet.')] });
      const embed = new EmbedBuilder().setColor('#FFD700').setTitle('🏆 Minecoin Leaderboard (Net Worth)');
      const medals = ['🥇', '🥈', '🥉'];
      let desc = '';
      for (let i = 0; i < top.length; i++) {
        const netWorth = top[i].balance + (top[i].bank || 0);
        desc += `${medals[i] || `**${i + 1}.**`} <@${top[i].user_id}> — **${netWorth.toLocaleString()} Minecoins**\n`;
      }
      embed.setDescription(desc).setFooter({ text: 'Net worth = Wallet + Bank' }).setTimestamp();
      await interaction.reply({ embeds: [embed] });
    }

    else if (sub === 'deposit') {
      const amount = interaction.options.getInteger('amount');
      const bal = getBalance(userId, guildId);
      const deposit = Math.min(amount, bal);
      if (deposit <= 0) return interaction.reply({ embeds: [errorEmbed(`Insufficient wallet balance. You have **${bal} Minecoins**.`)], ephemeral: true });
      removeBalance(userId, guildId, deposit);
      addBankBalance(userId, guildId, deposit);
      const embed = new EmbedBuilder().setColor('#00ff88').setTitle('🏦 Deposit Successful')
        .addFields(
          { name: '💰 Deposited', value: `${deposit} Minecoins`, inline: true },
          { name: '👛 Wallet', value: `${getBalance(userId, guildId)} Minecoins`, inline: true },
          { name: '🏦 Bank', value: `${getBankBalance(userId, guildId)} Minecoins`, inline: true },
        ).setTimestamp();
      await interaction.reply({ embeds: [embed] });
    }

    else if (sub === 'withdraw') {
      const amount = interaction.options.getInteger('amount');
      const bank = getBankBalance(userId, guildId);
      if (bank < amount) return interaction.reply({ embeds: [errorEmbed(`Insufficient bank balance. Your bank has **${bank} Minecoins**.`)], ephemeral: true });
      removeBankBalance(userId, guildId, amount);
      addBalance(userId, guildId, amount);
      const embed = new EmbedBuilder().setColor('#00ff88').setTitle('🏦 Withdrawal Successful')
        .addFields(
          { name: '💰 Withdrawn', value: `${amount} Minecoins`, inline: true },
          { name: '👛 Wallet', value: `${getBalance(userId, guildId)} Minecoins`, inline: true },
          { name: '🏦 Bank', value: `${getBankBalance(userId, guildId)} Minecoins`, inline: true },
        ).setTimestamp();
      await interaction.reply({ embeds: [embed] });
    }

    else if (sub === 'rob') {
      const target = interaction.options.getUser('user');
      if (target.id === userId) return interaction.reply({ embeds: [errorEmbed("You can't rob yourself!")], ephemeral: true });
      if (target.bot) return interaction.reply({ embeds: [errorEmbed("Bots have no money to rob!")], ephemeral: true });

      const now = Date.now();
      const robCooldown = 60 * 60 * 1000; // 1 hour
      let robData = db.prepare('SELECT * FROM rob_cooldowns WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
      if (robData && now - robData.last_rob < robCooldown) {
        const remaining = robCooldown - (now - robData.last_rob);
        const mins = Math.floor(remaining / 60000);
        return interaction.reply({ embeds: [errorEmbed(`You're laying low after your last robbery. Try again in **${mins}m**.`)], ephemeral: true });
      }

      const targetBal = getBalance(target.id, guildId);
      if (targetBal < 50) return interaction.reply({ embeds: [errorEmbed(`${target.username} is too poor to rob (less than 50 Minecoins in wallet).`)] });

      const myBal = getBalance(userId, guildId);
      const successChance = 0.45; // 45% success rate
      const success = Math.random() < successChance;

      if (!robData) {
        db.prepare('INSERT INTO rob_cooldowns (user_id, guild_id, last_rob) VALUES (?, ?, ?)').run(userId, guildId, now);
      } else {
        db.prepare('UPDATE rob_cooldowns SET last_rob = ? WHERE user_id = ? AND guild_id = ?').run(now, userId, guildId);
      }

      if (success) {
        const robAmount = Math.floor(targetBal * (Math.random() * 0.4 + 0.1)); // steal 10-50%
        removeBalance(target.id, guildId, robAmount);
        addBalance(userId, guildId, robAmount);
        const embed = new EmbedBuilder().setColor('#ff6600').setTitle('💰 Robbery Successful!')
          .setDescription(`You successfully robbed **${target.username}** and got away with **${robAmount} Minecoins**! 🏃`)
          .addFields(
            { name: '💰 Stolen', value: `${robAmount} Minecoins`, inline: true },
            { name: '👛 Your New Balance', value: `${getBalance(userId, guildId)} Minecoins`, inline: true },
          ).setFooter({ text: 'Tip: Bank your coins to keep them safe!' }).setTimestamp();
        await interaction.reply({ embeds: [embed] });
      } else {
        const fine = Math.floor(myBal * (Math.random() * 0.2 + 0.05)); // lose 5-25%
        removeBalance(userId, guildId, fine);
        addBalance(target.id, guildId, Math.floor(fine / 2));
        const embed = new EmbedBuilder().setColor('#ff0000').setTitle('🚨 Caught Red-Handed!')
          .setDescription(`You tried to rob **${target.username}** but got caught by the police!\nYou were fined **${fine} Minecoins** — half was given to ${target.username} as compensation.`)
          .addFields(
            { name: '💸 Fine Paid', value: `${fine} Minecoins`, inline: true },
            { name: '👛 Your New Balance', value: `${getBalance(userId, guildId)} Minecoins`, inline: true },
          ).setFooter({ text: 'Next time, plan better!' }).setTimestamp();
        await interaction.reply({ embeds: [embed] });
      }
    }

    else if (sub === 'slots') {
      const bet = interaction.options.getInteger('bet');
      const bal = getBalance(userId, guildId);
      if (bal < bet) return interaction.reply({ embeds: [errorEmbed(`You need **${bet} Minecoins** to play but only have **${bal}**.`)], ephemeral: true });

      removeBalance(userId, guildId, bet);
      const reels = spinSlots();
      const multiplier = calcSlotMultiplier(reels);
      const winnings = Math.floor(bet * multiplier);

      if (winnings > 0) addBalance(userId, guildId, winnings);

      const slotDisplay = `| ${reels.join(' | ')} |`;
      let result = '';
      if (multiplier === 0) result = '💔 No match — better luck next time!';
      else if (multiplier >= 50) result = '🎰 **JACKPOT!!!** Three 7s — LEGENDARY WIN!';
      else if (multiplier >= 25) result = '💎 **MEGA WIN!** Triple diamonds!';
      else if (multiplier >= 15) result = '⭐ **BIG WIN!** Triple stars!';
      else if (multiplier >= 10) result = '🔔 **Great win!** Triple bells!';
      else if (multiplier >= 5) result = '🎉 **Triple match!** Nice win!';
      else result = `✨ Partial match! **${multiplier}x** multiplier!`;

      const netGain = winnings - bet;
      const embed = new EmbedBuilder()
        .setColor(winnings > bet ? '#FFD700' : '#ff0000')
        .setTitle('🎰 Slot Machine')
        .setDescription(`\`\`\`\n${slotDisplay}\n\`\`\`\n${result}`)
        .addFields(
          { name: '💸 Bet', value: `${bet} Minecoins`, inline: true },
          { name: '🏆 Won', value: `${winnings} Minecoins`, inline: true },
          { name: `${netGain >= 0 ? '📈' : '📉'} Net`, value: `${netGain >= 0 ? '+' : ''}${netGain} Minecoins`, inline: true },
          { name: '👛 Balance', value: `${getBalance(userId, guildId).toLocaleString()} Minecoins`, inline: true },
        )
        .setFooter({ text: '🍒x2=1.5x | 💎x3=25x | 7️⃣x3=50x' })
        .setTimestamp();
      await interaction.reply({ embeds: [embed] });
    }

    else if (sub === 'bet') {
      const amount = interaction.options.getInteger('amount');
      const choice = interaction.options.getString('choice');
      const bal = getBalance(userId, guildId);
      if (bal < amount) return interaction.reply({ embeds: [errorEmbed(`Insufficient balance. You have **${bal} Minecoins**.`)], ephemeral: true });

      const result = Math.random() < 0.5 ? 'heads' : 'tails';
      const won = result === choice;

      if (won) {
        addBalance(userId, guildId, amount);
      } else {
        removeBalance(userId, guildId, amount);
      }

      const embed = new EmbedBuilder()
        .setColor(won ? '#FFD700' : '#ff0000')
        .setTitle(`🪙 Coin Flip Bet — ${won ? 'You Won!' : 'You Lost!'}`)
        .addFields(
          { name: '🪙 Result', value: result.charAt(0).toUpperCase() + result.slice(1), inline: true },
          { name: '🎯 Your Choice', value: choice.charAt(0).toUpperCase() + choice.slice(1), inline: true },
          { name: won ? '💰 Won' : '💸 Lost', value: `${amount} Minecoins`, inline: true },
          { name: '👛 New Balance', value: `${getBalance(userId, guildId).toLocaleString()} Minecoins`, inline: true },
        ).setTimestamp();
      await interaction.reply({ embeds: [embed] });
    }

    else if (sub === 'shop') {
      const roles = db.prepare('SELECT * FROM shop_roles WHERE guild_id = ? AND active = 1').all(guildId);
      if (roles.length === 0) return interaction.reply({ embeds: [errorEmbed('The shop has no items yet. An admin can add roles with /admin addshoprole.')] });
      const embed = new EmbedBuilder().setColor('#FFD700').setTitle('🛒 Role Shop').setDescription('Buy a role with your Minecoins!\nUse `/economy buy <rolename>` to purchase.');
      roles.forEach(r => embed.addFields({ name: r.role_name, value: `💎 **${r.price} Minecoins**`, inline: true }));
      embed.setFooter({ text: 'Earn Minecoins by chatting, working, daily rewards, and gambling!' });
      await interaction.reply({ embeds: [embed] });
    }

    else if (sub === 'buy') {
      const roleName = interaction.options.getString('rolename').toLowerCase();
      const item = db.prepare('SELECT * FROM shop_roles WHERE guild_id = ? AND active = 1 AND LOWER(role_name) = ?').get(guildId, roleName);
      if (!item) return interaction.reply({ embeds: [errorEmbed(`No shop item found named "${roleName}". Check \`/economy shop\`.`)], ephemeral: true });
      const bal = getBalance(userId, guildId);
      if (bal < item.price) return interaction.reply({ embeds: [errorEmbed(`You need **${item.price} Minecoins** but you only have **${bal}**.`)], ephemeral: true });
      const role = interaction.guild.roles.cache.get(item.role_id);
      if (!role) return interaction.reply({ embeds: [errorEmbed('This role no longer exists. Ask an admin to update the shop.')], ephemeral: true });
      if (interaction.member.roles.cache.has(role.id)) return interaction.reply({ embeds: [errorEmbed('You already have this role!')], ephemeral: true });
      removeBalance(userId, guildId, item.price);
      await interaction.member.roles.add(role);
      await interaction.reply({ embeds: [new EmbedBuilder().setColor('#FFD700').setTitle('🛒 Purchase Successful!').setDescription(`You bought **${role.name}** for **${item.price} Minecoins**!\nNew balance: **${getBalance(userId, guildId)} Minecoins**`).setTimestamp()] });
    }

    else if (sub === 'loan') {
      const amount = interaction.options.getInteger('amount');
      const userData = db.prepare('SELECT total_messages FROM user_balances WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
      const msgs = userData?.total_messages || 0;
      const maxLoan = Math.min(msgs * 2, 5000);
      if (maxLoan < 10) return interaction.reply({ embeds: [errorEmbed('You need to be more active to get a loan. Chat more!')], ephemeral: true });
      if (amount > maxLoan) return interaction.reply({ embeds: [errorEmbed(`Your max loan is **${maxLoan} Minecoins** based on activity.`)], ephemeral: true });
      const activeLoans = db.prepare('SELECT * FROM loans WHERE user_id = ? AND guild_id = ? AND active = 1').all(userId, guildId);
      if (activeLoans.length > 0) return interaction.reply({ embeds: [errorEmbed('You already have an active loan. Repay it first.')], ephemeral: true });
      const interest = Math.floor(amount * 0.05);
      const due = Date.now() + 7 * 24 * 60 * 60 * 1000;
      db.prepare('INSERT INTO loans (user_id, guild_id, amount, interest, due_date) VALUES (?, ?, ?, ?, ?)').run(userId, guildId, amount, interest, due);
      addBalance(userId, guildId, amount);
      await interaction.reply({ embeds: [new EmbedBuilder().setColor('#00ffff').setTitle('🏦 Loan Approved!').addFields({ name: '💎 Amount', value: `${amount} Minecoins`, inline: true }, { name: '📈 Weekly Interest', value: `${interest} Minecoins (5%)`, inline: true }, { name: '⚠️ Note', value: 'Interest is deducted every week. Use `/economy repay` to pay it back.' }).setTimestamp()] });
    }

    else if (sub === 'repay') {
      const amount = interaction.options.getInteger('amount');
      const loan = db.prepare('SELECT * FROM loans WHERE user_id = ? AND guild_id = ? AND active = 1').get(userId, guildId);
      if (!loan) return interaction.reply({ embeds: [errorEmbed('You have no active loan.')], ephemeral: true });
      const bal = getBalance(userId, guildId);
      if (bal < amount) return interaction.reply({ embeds: [errorEmbed(`Insufficient balance. You have **${bal} Minecoins**.`)], ephemeral: true });
      removeBalance(userId, guildId, amount);
      if (amount >= loan.amount) {
        db.prepare('UPDATE loans SET active = 0 WHERE id = ?').run(loan.id);
        await interaction.reply({ embeds: [successEmbed(`Loan fully repaid! Remaining balance: **${getBalance(userId, guildId)} Minecoins**`)] });
      } else {
        db.prepare('UPDATE loans SET amount = amount - ? WHERE id = ?').run(amount, loan.id);
        const updated = db.prepare('SELECT * FROM loans WHERE id = ?').get(loan.id);
        await interaction.reply({ embeds: [successEmbed(`Paid **${amount} Minecoins**. Remaining loan: **${updated.amount} Minecoins**`)] });
      }
    }

    else if (sub === 'adminadd') {
      if (!hasAdminRole(interaction.member, settings)) return interaction.reply({ embeds: [errorEmbed('Admin only.')], ephemeral: true });
      const target = interaction.options.getUser('user');
      const amount = interaction.options.getInteger('amount');
      addBalance(target.id, guildId, amount);
      await interaction.reply({ embeds: [successEmbed(`Added **${amount} Minecoins** to ${target.tag}. New balance: ${getBalance(target.id, guildId)}`)] });
    }

    else if (sub === 'adminremove') {
      if (!hasAdminRole(interaction.member, settings)) return interaction.reply({ embeds: [errorEmbed('Admin only.')], ephemeral: true });
      const target = interaction.options.getUser('user');
      const amount = interaction.options.getInteger('amount');
      removeBalance(target.id, guildId, amount);
      await interaction.reply({ embeds: [successEmbed(`Removed **${amount} Minecoins** from ${target.tag}. New balance: ${getBalance(target.id, guildId)}`)] });
    }
  }
};
