const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const { fetchAnimeGif, errorEmbed } = require('../utils/helpers');

const MEME_SUBS = ['memes', 'dankmemes', 'me_irl', 'funny', 'ProgrammerHumor', 'AdviceAnimals'];

async function getRandomMeme() {
  const sub = MEME_SUBS[Math.floor(Math.random() * MEME_SUBS.length)];
  const res = await axios.get(`https://www.reddit.com/r/${sub}/random.json`, {
    headers: { 'User-Agent': 'DiscordBot/2.0' },
    timeout: 6000,
  });
  return res.data[0]?.data?.children?.[0]?.data;
}

const ACTION_MESSAGES = {
  punch:    (a, t) => [`${a} punches **${t}**! 👊`, `**${t}** got absolutely wrecked by **${a}**! 💥`, `**${a}** threw a clean hit at **${t}**!`],
  kiss:     (a, t) => [`**${a}** kisses **${t}**! 💋`, `Aww! **${a}** planted one on **${t}**! 😘`, `**${t}** was caught off guard by **${a}**'s kiss! 💕`],
  hug:      (a, t) => [`**${a}** hugs **${t}**! 🤗`, `**${t}** gets a warm squeeze from **${a}**!`, `**${a}** wraps their arms around **${t}** tight! 💛`],
  slap:     (a, t) => [`**${a}** slaps **${t}**! 👋`, `**${t}** got slapped by **${a}**! The audacity!`, `SMACK! **${a}** did not hold back on **${t}**!`],
  pat:      (a, t) => [`**${a}** gently pats **${t}**! 🥰`, `**${t}** gets headpatted by **${a}**! So cute!`, `**${a}** says you did good, **${t}**! 💜`],
  bite:     (a, t) => [`**${a}** bites **${t}**! 😬`, `Ouch! **${a}** chomped **${t}** out of nowhere!`, `**${t}** got nibbled by **${a}**! 🦷`],
  cuddle:   (a, t) => [`**${a}** cuddles **${t}**! 💕`, `**${a}** and **${t}** are cuddling! So wholesome! 🌸`, `**${t}** is getting the cuddle treatment from **${a}**!`],
  poke:     (a, t) => [`**${a}** pokes **${t}**! 👉`, `Hey! **${a}** poked **${t}** for attention!`, `**${t}** got poked by **${a}**! Pay attention!`],
  wave:     (a, t) => [`**${a}** waves at **${t}**! 👋`, `**${a}** says hi to **${t}**! 🌊`, `Hey **${t}**! **${a}** just waved at you!`],
  cry:      (a)    => [`**${a}** is crying! 😢`, `**${a}** is having a tough time...`, `Someone cheer up **${a}**! 😭`],
  dance:    (a)    => [`**${a}** busts some moves! 💃`, `**${a}** is showing off their dance skills! 🕺`, `Nobody puts **${a}** in a corner! 💫`],
  shoot:    (a, t) => [`**${a}** shoots **${t}**! 🔫`, `**${t}** got taken out by **${a}**! 💀`, `Pew pew! **${a}** fired at **${t}**!`],
};

async function buildAnimeEmbed(action, actor, target, color) {
  const gif = await fetchAnimeGif(action);
  const msgArr = ACTION_MESSAGES[action]
    ? ACTION_MESSAGES[action](actor, target)
    : [`**${actor}** uses ${action} on **${target}**!`];
  const msg = msgArr[Math.floor(Math.random() * msgArr.length)];
  return new EmbedBuilder()
    .setColor(color || '#ff69b4')
    .setDescription(msg)
    .setImage(gif)
    .setFooter({ text: `✨ Anime action • powered by waifu.pics` });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('fun')
    .setDescription('Fun commands!')
    .addSubcommand(s => s.setName('meme').setDescription('Get a random meme'))
    .addSubcommand(s => s.setName('punch').setDescription('Punch someone anime style').addUserOption(o => o.setName('user').setDescription('User to punch').setRequired(true)))
    .addSubcommand(s => s.setName('kiss').setDescription('Kiss someone').addUserOption(o => o.setName('user').setDescription('User to kiss').setRequired(true)))
    .addSubcommand(s => s.setName('hug').setDescription('Hug someone').addUserOption(o => o.setName('user').setDescription('User to hug').setRequired(true)))
    .addSubcommand(s => s.setName('slap').setDescription('Slap someone').addUserOption(o => o.setName('user').setDescription('User to slap').setRequired(true)))
    .addSubcommand(s => s.setName('pat').setDescription('Headpat someone').addUserOption(o => o.setName('user').setDescription('User to pat').setRequired(true)))
    .addSubcommand(s => s.setName('bite').setDescription('Bite someone').addUserOption(o => o.setName('user').setDescription('User to bite').setRequired(true)))
    .addSubcommand(s => s.setName('cuddle').setDescription('Cuddle someone').addUserOption(o => o.setName('user').setDescription('User to cuddle').setRequired(true)))
    .addSubcommand(s => s.setName('poke').setDescription('Poke someone').addUserOption(o => o.setName('user').setDescription('User to poke').setRequired(true)))
    .addSubcommand(s => s.setName('wave').setDescription('Wave at someone').addUserOption(o => o.setName('user').setDescription('User to wave at').setRequired(true)))
    .addSubcommand(s => s.setName('cry').setDescription('Cry anime style'))
    .addSubcommand(s => s.setName('dance').setDescription('Dance anime style'))
    .addSubcommand(s => s.setName('shoot').setDescription('Shoot someone anime style').addUserOption(o => o.setName('user').setDescription('User to shoot').setRequired(true)))
    .addSubcommand(s => s.setName('8ball').setDescription('Ask the magic 8-ball a question').addStringOption(o => o.setName('question').setDescription('Your question').setRequired(true)))
    .addSubcommand(s => s.setName('coinflip').setDescription('Flip a coin'))
    .addSubcommand(s => s.setName('dice').setDescription('Roll a dice').addIntegerOption(o => o.setName('sides').setDescription('Number of sides (default 6)').setRequired(false).setMinValue(2).setMaxValue(1000)))
    .addSubcommand(s => s.setName('rps').setDescription('Rock Paper Scissors!').addStringOption(o => o.setName('choice').setDescription('Your choice').setRequired(true).addChoices({ name: '🪨 Rock', value: 'rock' }, { name: '📄 Paper', value: 'paper' }, { name: '✂️ Scissors', value: 'scissors' })))
    .addSubcommand(s => s.setName('joke').setDescription('Get a random joke'))
    .addSubcommand(s => s.setName('fact').setDescription('Get a random fun fact'))
    .addSubcommand(s => s.setName('ship').setDescription('Ship two users together').addUserOption(o => o.setName('user1').setDescription('First user').setRequired(true)).addUserOption(o => o.setName('user2').setDescription('Second user').setRequired(true)))
    .addSubcommand(s => s.setName('roast').setDescription('Roast someone playfully').addUserOption(o => o.setName('user').setDescription('User to roast').setRequired(true)))
    .addSubcommand(s => s.setName('compliment').setDescription('Compliment someone').addUserOption(o => o.setName('user').setDescription('User to compliment').setRequired(true)))
    .addSubcommand(s => s.setName('rate').setDescription('Rate something').addStringOption(o => o.setName('thing').setDescription('What to rate').setRequired(true)))
    .addSubcommand(s => s.setName('trivia').setDescription('Get a random trivia question')),

  prefixAliases: ['meme', 'punch', 'kiss', 'hug', 'slap', '8ball', 'coinflip', 'dice', 'joke', 'fact'],

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const actor = interaction.user.username;

    const animeActions = ['punch', 'kiss', 'hug', 'slap', 'pat', 'bite', 'cuddle', 'poke', 'wave', 'shoot', 'cry', 'dance'];
    if (animeActions.includes(sub)) {
      await interaction.deferReply();
      const hasTarget = !['cry', 'dance'].includes(sub);
      const target = hasTarget ? interaction.options.getUser('user') : null;
      const colors = { punch: '#ff4444', kiss: '#ff69b4', hug: '#ff9966', slap: '#ff6600', pat: '#ffaaff', bite: '#cc0000', cuddle: '#ffb6c1', poke: '#aaffaa', wave: '#aaaaff', cry: '#6699ff', dance: '#ff66ff', shoot: '#880000' };
      const embed = await buildAnimeEmbed(sub, actor, target ? target.username : '', colors[sub]);
      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'meme') {
      await interaction.deferReply();
      try {
        const post = await getRandomMeme();
        if (!post || !post.url) return interaction.editReply({ embeds: [errorEmbed('Could not fetch a meme right now.')] });
        const embed = new EmbedBuilder().setColor('#ff9900').setTitle(post.title.slice(0, 256)).setImage(post.url).setFooter({ text: `👍 ${post.ups} | 💬 ${post.num_comments} | r/${post.subreddit}` }).setURL(`https://reddit.com${post.permalink}`);
        return interaction.editReply({ embeds: [embed] });
      } catch { return interaction.editReply({ embeds: [errorEmbed('Could not fetch meme. Reddit might be down.')] }); }
    }

    if (sub === '8ball') {
      const question = interaction.options.getString('question');
      const answers = ['It is certain.', 'It is decidedly so.', 'Without a doubt.', 'Yes, definitely.', 'You may rely on it.', 'As I see it, yes.', 'Most likely.', 'Outlook good.', 'Yes.', 'Signs point to yes.', 'Reply hazy, try again.', 'Ask again later.', 'Better not tell you now.', 'Cannot predict now.', 'Concentrate and ask again.', "Don't count on it.", 'My reply is no.', 'My sources say no.', 'Outlook not so good.', 'Very doubtful.'];
      const answer = answers[Math.floor(Math.random() * answers.length)];
      const idx = answers.indexOf(answer);
      const color = idx < 10 ? '#00ff00' : idx < 15 ? '#ffaa00' : '#ff0000';
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(color).setTitle('🎱 Magic 8-Ball').addFields({ name: '❓ Question', value: question }, { name: '🔮 Answer', value: `**${answer}**` })] });
    }

    if (sub === 'coinflip') {
      const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
      const gif = result === 'Heads' ? 'https://media.giphy.com/media/H7kfFGMQqGUmjSMQL1/giphy.gif' : 'https://media.giphy.com/media/3o7TKtPLrDLDGh6mxq/giphy.gif';
      return interaction.reply({ embeds: [new EmbedBuilder().setColor('#FFD700').setTitle('🪙 Coin Flip').setDescription(`The coin landed on **${result}**!`).setImage(gif)] });
    }

    if (sub === 'dice') {
      const sides = interaction.options.getInteger('sides') || 6;
      const roll = Math.floor(Math.random() * sides) + 1;
      return interaction.reply({ embeds: [new EmbedBuilder().setColor('#aa00ff').setTitle('🎲 Dice Roll').setDescription(`You rolled a **${roll}** out of ${sides}!`)] });
    }

    if (sub === 'rps') {
      const choices = ['rock', 'paper', 'scissors'];
      const botChoice = choices[Math.floor(Math.random() * 3)];
      const userChoice = interaction.options.getString('choice');
      const emojis = { rock: '🪨', paper: '📄', scissors: '✂️' };
      let result = '';
      if (userChoice === botChoice) result = "It's a tie!";
      else if ((userChoice === 'rock' && botChoice === 'scissors') || (userChoice === 'paper' && botChoice === 'rock') || (userChoice === 'scissors' && botChoice === 'paper')) result = 'You win! 🎉';
      else result = 'I win! 😈';
      const colorMap = { 'You win! 🎉': '#00ff00', "It's a tie!": '#ffaa00', 'I win! 😈': '#ff0000' };
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(colorMap[result]).setTitle('✊ Rock Paper Scissors').addFields({ name: 'Your choice', value: `${emojis[userChoice]} ${userChoice}`, inline: true }, { name: 'My choice', value: `${emojis[botChoice]} ${botChoice}`, inline: true }, { name: 'Result', value: `**${result}**` })] });
    }

    if (sub === 'joke') {
      const jokes = [
        ["Why don't scientists trust atoms?", "Because they make up everything!"],
        ["What do you call a fish without eyes?", "A fsh!"],
        ["Why did the scarecrow win an award?", "He was outstanding in his field!"],
        ["I told my wife she was drawing her eyebrows too high.", "She looked surprised."],
        ["What's a computer's favorite snack?", "Microchips!"],
        ["Why can't a nose be 12 inches long?", "Because then it would be a foot!"],
        ["What did the ocean say to the beach?", "Nothing, it just waved."],
        ["I'm reading a book about anti-gravity.", "It's impossible to put down!"],
        ["Why do cows wear bells?", "Because their horns don't work!"],
        ["What do you call cheese that isn't yours?", "Nacho cheese!"],
        ["Why couldn't the bicycle stand on its own?", "It was two-tired!"],
        ["What's a vampire's favorite fruit?", "A blood orange!"],
        ["Why did the math book look so sad?", "Because it had too many problems."],
        ["What do you call a lazy kangaroo?", "A pouch potato!"],
      ];
      const [setup, punchline] = jokes[Math.floor(Math.random() * jokes.length)];
      return interaction.reply({ embeds: [new EmbedBuilder().setColor('#ffff00').setTitle('😂 Random Joke').addFields({ name: setup, value: `||${punchline}||` }).setFooter({ text: 'Click the spoiler to reveal!' })] });
    }

    if (sub === 'fact') {
      const facts = [
        "A group of flamingos is called a flamboyance.",
        "Honey never spoils — 3000-year-old honey was found in Egyptian tombs and was still good.",
        "Cleopatra lived closer in time to the Moon landing than to the Great Pyramid's construction.",
        "Bananas are technically berries, but strawberries are not.",
        "A day on Venus is longer than a year on Venus.",
        "Octopuses have three hearts and blue blood.",
        "The shortest war in history lasted 38-45 minutes (Anglo-Zanzibar War, 1896).",
        "There are more stars in the universe than grains of sand on all Earth's beaches.",
        "A bolt of lightning is 5 times hotter than the surface of the sun.",
        "Wombats produce cube-shaped droppings.",
        "Sloths take two weeks to digest a single leaf.",
        "The human nose can detect over 1 trillion different smells.",
        "A jiffy is an actual unit of time — 1/100th of a second.",
        "Cows have best friends and get stressed when separated from them.",
        "The Eiffel Tower grows about 6 inches taller in summer due to heat expansion.",
      ];
      return interaction.reply({ embeds: [new EmbedBuilder().setColor('#00ffff').setTitle('💡 Fun Fact').setDescription(facts[Math.floor(Math.random() * facts.length)])] });
    }

    if (sub === 'ship') {
      const user1 = interaction.options.getUser('user1');
      const user2 = interaction.options.getUser('user2');
      const percent = Math.floor(Math.random() * 101);
      const bar = '█'.repeat(Math.floor(percent / 10)) + '░'.repeat(10 - Math.floor(percent / 10));
      const msg = percent >= 85 ? '💞 Soulmates!' : percent >= 70 ? '💕 Perfect match!' : percent >= 50 ? '💛 Pretty decent!' : percent >= 30 ? '💙 Meh...' : '💔 Not meant to be.';
      return interaction.reply({ embeds: [new EmbedBuilder().setColor('#ff69b4').setTitle('💘 Shipping').setDescription(`**${user1.username}** ❤️ **${user2.username}**\n\n${bar} **${percent}%**\n\n${msg}`)] });
    }

    if (sub === 'roast') {
      const target = interaction.options.getUser('user');
      const roasts = [
        `${target.username}, you're the human equivalent of a participation trophy.`,
        `${target.username} is so slow that they got tired just watching a fast food place.`,
        `If brains were gasoline, ${target.username} couldn't power an ant's motorcycle.`,
        `${target.username}'s brain is like a browser with 1000 tabs open and all of them are wrong.`,
        `${target.username} has the energy of a phone on 1% battery.`,
        `I'd roast ${target.username} more but my mom said I shouldn't burn trash.`,
        `${target.username} is proof that evolution can go in reverse.`,
        `${target.username} googled "how to be normal" and got zero results.`,
      ];
      return interaction.reply({ embeds: [new EmbedBuilder().setColor('#ff4444').setTitle('🔥 Roast!').setDescription(roasts[Math.floor(Math.random() * roasts.length)]).setFooter({ text: 'All in good fun! 😄' })] });
    }

    if (sub === 'compliment') {
      const target = interaction.options.getUser('user');
      const compliments = [
        `${target.username} has the energy of a warm cup of coffee on a rainy day ☕`,
        `${target.username} is like a rainbow — you always feel better after seeing them 🌈`,
        `The world is genuinely a better place because ${target.username} is in it 🌟`,
        `${target.username} has a smile that could power a thousand solar panels ☀️`,
        `If kindness was currency, ${target.username} would be a billionaire 💖`,
        `${target.username} is the plot twist nobody saw coming — in the best way! ✨`,
        `Having ${target.username} around is like finding the last slice of pizza — just perfect! 🍕`,
      ];
      return interaction.reply({ embeds: [new EmbedBuilder().setColor('#ff69b4').setTitle('💌 Compliment!').setDescription(compliments[Math.floor(Math.random() * compliments.length)])] });
    }

    if (sub === 'rate') {
      const thing = interaction.options.getString('thing');
      const rating = (Math.random() * 10).toFixed(1);
      const stars = '⭐'.repeat(Math.round(Number(rating)));
      return interaction.reply({ embeds: [new EmbedBuilder().setColor('#FFD700').setTitle('⭐ Rating').setDescription(`I rate **${thing}** a **${rating}/10**\n${stars}`)] });
    }

    if (sub === 'trivia') {
      await interaction.deferReply();
      try {
        const res = await axios.get('https://opentdb.com/api.php?amount=1&type=multiple', { timeout: 6000 });
        const q = res.data.results[0];
        const decode = s => s.replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
        const allAnswers = [...q.incorrect_answers, q.correct_answer].sort(() => Math.random() - 0.5).map(decode);
        const embed = new EmbedBuilder().setColor('#9900ff').setTitle('🧠 Trivia Time!').addFields(
          { name: 'Category', value: q.category, inline: true },
          { name: 'Difficulty', value: q.difficulty.charAt(0).toUpperCase() + q.difficulty.slice(1), inline: true },
          { name: '❓ Question', value: decode(q.question) },
          { name: '🔤 Options', value: allAnswers.map((a, i) => `${['A', 'B', 'C', 'D'][i]}. ${a}`).join('\n') },
          { name: '✅ Answer', value: `||${decode(q.correct_answer)}||` }
        ).setFooter({ text: 'Reveal the spoiler when ready!' });
        return interaction.editReply({ embeds: [embed] });
      } catch {
        return interaction.editReply({ embeds: [errorEmbed('Could not fetch trivia. Try again!')] });
      }
    }
  },

  async executePrefixed(message, args) {
    const command = message.content.slice(1).split(' ')[0].toLowerCase();
    if (command === 'meme') {
      try {
        const post = await getRandomMeme();
        if (!post || !post.url) return message.reply({ embeds: [errorEmbed('Could not fetch a meme.')] });
        return message.reply({ embeds: [new EmbedBuilder().setColor('#ff9900').setTitle(post.title.slice(0, 256)).setImage(post.url).setFooter({ text: `👍 ${post.ups} | r/${post.subreddit}` })] });
      } catch { return message.reply({ embeds: [errorEmbed('Could not fetch meme.')] }); }
    }
    if (command === '8ball') {
      const question = args.join(' ');
      if (!question) return message.reply({ embeds: [errorEmbed('Ask a question! Example: `$8ball Will I win today?`')] });
      const answers = ['It is certain.', 'Without a doubt.', 'Yes!', 'Most likely.', 'Reply hazy, try again.', 'Ask again later.', "Don't count on it.", 'Very doubtful.', 'No.'];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#9900ff').setTitle('🎱 Magic 8-Ball').addFields({ name: '❓', value: question }, { name: '🔮', value: answers[Math.floor(Math.random() * answers.length)] })] });
    }
    if (command === 'coinflip') {
      return message.reply({ embeds: [new EmbedBuilder().setColor('#FFD700').setTitle('🪙 Coin Flip').setDescription(`**${Math.random() < 0.5 ? 'Heads' : 'Tails'}**!`)] });
    }
  }
};
