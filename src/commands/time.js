const { SlashCommandBuilder, EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
const { getTimeForTimezone } = require('../events/timezoneHelper');

const TIMEZONES = [
  { label: '🇺🇸 New York (EST)', value: 'America/New_York' },
  { label: '🇺🇸 Los Angeles (PST)', value: 'America/Los_Angeles' },
  { label: '🇺🇸 Chicago (CST)', value: 'America/Chicago' },
  { label: '🇬🇧 London (GMT)', value: 'Europe/London' },
  { label: '🇫🇷 Paris (CET)', value: 'Europe/Paris' },
  { label: '🇩🇪 Berlin (CET)', value: 'Europe/Berlin' },
  { label: '🇷🇺 Moscow (MSK)', value: 'Europe/Moscow' },
  { label: '🇮🇳 India (IST)', value: 'Asia/Kolkata' },
  { label: '🇵🇰 Pakistan (PKT)', value: 'Asia/Karachi' },
  { label: '🇧🇩 Bangladesh (BST)', value: 'Asia/Dhaka' },
  { label: '🇨🇳 China (CST)', value: 'Asia/Shanghai' },
  { label: '🇯🇵 Japan (JST)', value: 'Asia/Tokyo' },
  { label: '🇰🇷 South Korea (KST)', value: 'Asia/Seoul' },
  { label: '🇸🇬 Singapore (SGT)', value: 'Asia/Singapore' },
  { label: '🇦🇪 Dubai (GST)', value: 'Asia/Dubai' },
  { label: '🇸🇦 Saudi Arabia (AST)', value: 'Asia/Riyadh' },
  { label: '🇹🇷 Turkey (TRT)', value: 'Europe/Istanbul' },
  { label: '🇵🇭 Philippines (PHT)', value: 'Asia/Manila' },
  { label: '🇮🇩 Indonesia (WIB)', value: 'Asia/Jakarta' },
  { label: '🇲🇾 Malaysia (MYT)', value: 'Asia/Kuala_Lumpur' },
  { label: '🇦🇺 Sydney (AEST)', value: 'Australia/Sydney' },
  { label: '🇦🇺 Melbourne (AEST)', value: 'Australia/Melbourne' },
  { label: '🇳🇿 Auckland (NZST)', value: 'Pacific/Auckland' },
  { label: '🇧🇷 Brazil (BRT)', value: 'America/Sao_Paulo' },
  { label: '🇦🇷 Argentina (ART)', value: 'America/Argentina/Buenos_Aires' },
  { label: '🇲🇽 Mexico (CST)', value: 'America/Mexico_City' },
  { label: '🇨🇦 Toronto (EST)', value: 'America/Toronto' },
  { label: '🇿🇦 South Africa (SAST)', value: 'Africa/Johannesburg' },
  { label: '🇳🇬 Nigeria (WAT)', value: 'Africa/Lagos' },
  { label: '🇰🇪 Kenya (EAT)', value: 'Africa/Nairobi' },
  { label: '🇪🇬 Egypt (EET)', value: 'Africa/Cairo' },
  { label: '🇬🇭 Ghana (GMT)', value: 'Africa/Accra' },
  { label: '🇧🇪 Belgium (CET)', value: 'Europe/Brussels' },
  { label: '🇳🇱 Netherlands (CET)', value: 'Europe/Amsterdam' },
  { label: '🇸🇪 Sweden (CET)', value: 'Europe/Stockholm' },
  { label: '🇳🇴 Norway (CET)', value: 'Europe/Oslo' },
  { label: '🇩🇰 Denmark (CET)', value: 'Europe/Copenhagen' },
  { label: '🇵🇱 Poland (CET)', value: 'Europe/Warsaw' },
  { label: '🇺🇦 Ukraine (EET)', value: 'Europe/Kiev' },
  { label: '🇬🇷 Greece (EET)', value: 'Europe/Athens' },
  { label: '🇮🇹 Italy (CET)', value: 'Europe/Rome' },
  { label: '🇪🇸 Spain (CET)', value: 'Europe/Madrid' },
  { label: '🇵🇹 Portugal (WET)', value: 'Europe/Lisbon' },
  { label: '🇨🇭 Switzerland (CET)', value: 'Europe/Zurich' },
  { label: '🇦🇹 Austria (CET)', value: 'Europe/Vienna' },
  { label: '🇮🇱 Israel (IST)', value: 'Asia/Jerusalem' },
  { label: '🇮🇷 Iran (IRST)', value: 'Asia/Tehran' },
  { label: '🇹🇭 Thailand (ICT)', value: 'Asia/Bangkok' },
  { label: '🇻🇳 Vietnam (ICT)', value: 'Asia/Ho_Chi_Minh' },
  { label: '🇭🇰 Hong Kong (HKT)', value: 'Asia/Hong_Kong' },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('time')
    .setDescription('Check the current time in any country/timezone'),

  prefixAliases: ['time'],

  async execute(interaction) {
    // Split into groups of 25 (Discord menu limit)
    const chunks = [];
    for (let i = 0; i < TIMEZONES.length; i += 25) {
      chunks.push(TIMEZONES.slice(i, i + 25));
    }

    const rows = chunks.slice(0, 5).map((chunk, idx) =>
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('timezone_select')
          .setPlaceholder(`Select timezone (group ${idx + 1})`)
          .addOptions(chunk)
      )
    );

    const embed = new EmbedBuilder()
      .setColor('#00ffff')
      .setTitle('🕐 World Clock')
      .setDescription('Select a timezone from the menus below to see the current time!')
      .setTimestamp();

    await interaction.reply({ embeds: [embed], components: rows.slice(0, 1) });
  },

  async executePrefixed(message) {
    const rows = [
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('timezone_select')
          .setPlaceholder('Select a timezone...')
          .addOptions(TIMEZONES.slice(0, 25))
      )
    ];
    const embed = new EmbedBuilder().setColor('#00ffff').setTitle('🕐 World Clock').setDescription('Pick a timezone to check the current time!').setTimestamp();
    await message.reply({ embeds: [embed], components: rows });
  }
};
