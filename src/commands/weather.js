const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const { errorEmbed } = require('../utils/helpers');

const WMO_CODES = {
  0:  { label: 'Clear Sky',                  emoji: '☀️' },
  1:  { label: 'Mainly Clear',               emoji: '🌤️' },
  2:  { label: 'Partly Cloudy',              emoji: '⛅' },
  3:  { label: 'Overcast',                   emoji: '☁️' },
  45: { label: 'Foggy',                      emoji: '🌫️' },
  48: { label: 'Icy Fog',                    emoji: '🌫️' },
  51: { label: 'Light Drizzle',              emoji: '🌦️' },
  53: { label: 'Moderate Drizzle',           emoji: '🌦️' },
  55: { label: 'Dense Drizzle',              emoji: '🌧️' },
  61: { label: 'Slight Rain',               emoji: '🌧️' },
  63: { label: 'Moderate Rain',             emoji: '🌧️' },
  65: { label: 'Heavy Rain',               emoji: '🌧️' },
  71: { label: 'Slight Snow',              emoji: '🌨️' },
  73: { label: 'Moderate Snow',            emoji: '❄️' },
  75: { label: 'Heavy Snow',              emoji: '❄️' },
  77: { label: 'Snow Grains',             emoji: '🌨️' },
  80: { label: 'Slight Rain Showers',     emoji: '🌦️' },
  81: { label: 'Moderate Rain Showers',   emoji: '🌧️' },
  82: { label: 'Violent Rain Showers',    emoji: '⛈️' },
  85: { label: 'Snow Showers',            emoji: '🌨️' },
  86: { label: 'Heavy Snow Showers',      emoji: '❄️' },
  95: { label: 'Thunderstorm',            emoji: '⛈️' },
  96: { label: 'Thunderstorm w/ Hail',    emoji: '⛈️' },
  99: { label: 'Thunderstorm w/ Heavy Hail', emoji: '⛈️' },
};

const COLORS = {
  0: '#FFD700', 1: '#FFA500', 2: '#A9A9A9', 3: '#808080',
  45: '#696969', 48: '#696969',
  51: '#4169E1', 53: '#4169E1', 55: '#4169E1',
  61: '#4169E1', 63: '#4169E1', 65: '#00008B',
  71: '#E0FFFF', 73: '#B0C4DE', 75: '#B0C4DE',
  80: '#6495ED', 81: '#4169E1', 82: '#4B0082',
  95: '#4B0082', 96: '#4B0082', 99: '#4B0082',
};

// 10-15 curated Unsplash images per weather category (randomly selected each call)
const WEATHER_IMAGE_POOLS = {
  clear: [
    'https://images.unsplash.com/photo-1601297183305-6df142704ea2?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1444044205806-38f3ed106c10?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1497582935868-7b50beb0b8a5?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1528127269322-539801943592?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?w=1280&h=853&fit=crop&q=80',
  ],
  mainlyClear: [
    'https://images.unsplash.com/photo-1524594152303-9fd13543fe6e?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1518020382113-a7e8fc38eac9?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1497436072909-60f360fe1ce9?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1533371452-9054fb37c34d?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1563781142806-6cc2e1a6e7f1?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1455218873509-8097305ee378?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1542339745-4dac899abfad?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1506197603052-3cc9c3a201bd?w=1280&h=853&fit=crop&q=80',
  ],
  partlyCloudy: [
    'https://images.unsplash.com/photo-1534088568595-a066f410bcda?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1513002749903-f56e4bfce083?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1471922694854-ff1b63b20054?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1504608524841-42584120d035?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1505533542167-8c89838bb19e?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1430417938747-b67a74a3fa31?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1504701954957-2010ec3bcec1?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1517685352821-92cf88aee5a5?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1566933293069-b55c7f326dd4?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1536514072410-5019a3c69182?w=1280&h=853&fit=crop&q=80',
  ],
  overcast: [
    'https://images.unsplash.com/photo-1495616811223-4d98c6e9c869?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1418985991508-4ee58ce39a95?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1483728642387-6c3bdd72c494?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1491929040768-7a1b35f7de1c?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1519692933481-e162a57d6721?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1534274988757-a79d537ef9c3?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1516912481808-3406841bd33c?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1513407030348-c983a97b98d8?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1503435824048-a799a3a84bf7?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1561553873-e8491a564fd0?w=1280&h=853&fit=crop&q=80',
  ],
  fog: [
    'https://images.unsplash.com/photo-1516912481808-3406841bd33c?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1513407030348-c983a97b98d8?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1578836537282-3171d77f8632?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1504386106331-3e4e71712b38?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1491553895291-c9e6db6b4eb5?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1519692933481-e162a57d6721?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1503435824048-a799a3a84bf7?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1485236715568-ddc5ee6ca227?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1427847907716-f8d10d5a4c1f?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1559825481-12a05cc00344?w=1280&h=853&fit=crop&q=80',
  ],
  drizzle: [
    'https://images.unsplash.com/photo-1428592953211-077101b2021b?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1476725994324-6f37a11f2ae8?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1534274988757-a79d537ef9c3?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1527766833261-b09c3163a791?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1504386106331-3e4e71712b38?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1518020382113-a7e8fc38eac9?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1532178910-7815d6919875?w=1280&h=853&fit=crop&q=80',
  ],
  rain: [
    'https://images.unsplash.com/photo-1515694346937-f34cd9e6fdd6?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1428592953211-077101b2021b?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1527766833261-b09c3163a791?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1476725994324-6f37a11f2ae8?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1493314894560-5c412a56c17c?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1519692933481-e162a57d6721?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1534274988757-a79d537ef9c3?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1561553873-e8491a564fd0?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1504386106331-3e4e71712b38?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1472145246862-b24cf25c4a36?w=1280&h=853&fit=crop&q=80',
  ],
  heavyRain: [
    'https://images.unsplash.com/photo-1504386106331-3e4e71712b38?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1534274988757-a79d537ef9c3?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1519692933481-e162a57d6721?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1527766833261-b09c3163a791?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1472145246862-b24cf25c4a36?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1561553873-e8491a564fd0?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1515694346937-f34cd9e6fdd6?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1493314894560-5c412a56c17c?w=1280&h=853&fit=crop&q=80',
  ],
  slightSnow: [
    'https://images.unsplash.com/photo-1457269449834-928af64c684d?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1491553895291-c9e6db6b4eb5?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1516912481808-3406841bd33c?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1511131341194-24e2eeeebb09?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1467664631004-58beab1ece0d?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1542273917363-3b1817f69a2d?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1418985991508-4ee58ce39a95?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1547754980-3df97fed72a8?w=1280&h=853&fit=crop&q=80',
  ],
  snow: [
    'https://images.unsplash.com/photo-1547754980-3df97fed72a8?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1491553895291-c9e6db6b4eb5?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1457269449834-928af64c684d?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1511131341194-24e2eeeebb09?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1542273917363-3b1817f69a2d?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1467664631004-58beab1ece0d?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1418985991508-4ee58ce39a95?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1477601263568-180e2c6d046e?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1491002052546-bf38f186af56?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1548777315-0f7ed5c5-9b2d?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1551582045-6ec9c11d8697?w=1280&h=853&fit=crop&q=80',
  ],
  heavySnow: [
    'https://images.unsplash.com/photo-1491002052546-bf38f186af56?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1547754980-3df97fed72a8?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1511131341194-24e2eeeebb09?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1477601263568-180e2c6d046e?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1467664631004-58beab1ece0d?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1551582045-6ec9c11d8697?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1457269449834-928af64c684d?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1491553895291-c9e6db6b4eb5?w=1280&h=853&fit=crop&q=80',
  ],
  showers: [
    'https://images.unsplash.com/photo-1561553873-e8491a564fd0?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1515694346937-f34cd9e6fdd6?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1428592953211-077101b2021b?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1527766833261-b09c3163a791?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1476725994324-6f37a11f2ae8?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1532178910-7815d6919875?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1472145246862-b24cf25c4a36?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1493314894560-5c412a56c17c?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1534274988757-a79d537ef9c3?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=1280&h=853&fit=crop&q=80',
  ],
  thunder: [
    'https://images.unsplash.com/photo-1605727216801-e27ce1d0cc28?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1534274988757-a79d537ef9c3?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1467581557459-4c30b3d09e87?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1504253109451-aa3c3c5c4c12?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1535666669445-e8c15cd2e7d9?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1495616811223-4d98c6e9c869?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1491929040768-7a1b35f7de1c?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1506197603052-3cc9c3a201bd?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1519692933481-e162a57d6721?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1527766833261-b09c3163a791?w=1280&h=853&fit=crop&q=80',
    'https://images.unsplash.com/photo-1471922694854-ff1b63b20054?w=1280&h=853&fit=crop&q=80',
  ],
};

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getWeatherImage(code) {
  if (code === 0)                       return pickRandom(WEATHER_IMAGE_POOLS.clear);
  if (code === 1)                       return pickRandom(WEATHER_IMAGE_POOLS.mainlyClear);
  if (code === 2)                       return pickRandom(WEATHER_IMAGE_POOLS.partlyCloudy);
  if (code === 3)                       return pickRandom(WEATHER_IMAGE_POOLS.overcast);
  if (code === 45 || code === 48)       return pickRandom(WEATHER_IMAGE_POOLS.fog);
  if (code >= 51 && code <= 55)         return pickRandom(WEATHER_IMAGE_POOLS.drizzle);
  if (code === 61 || code === 63)       return pickRandom(WEATHER_IMAGE_POOLS.rain);
  if (code === 65)                      return pickRandom(WEATHER_IMAGE_POOLS.heavyRain);
  if (code === 71)                      return pickRandom(WEATHER_IMAGE_POOLS.slightSnow);
  if (code === 73 || code === 77)       return pickRandom(WEATHER_IMAGE_POOLS.snow);
  if (code === 75)                      return pickRandom(WEATHER_IMAGE_POOLS.heavySnow);
  if (code >= 80 && code <= 82)         return pickRandom(WEATHER_IMAGE_POOLS.showers);
  if (code === 85 || code === 86)       return pickRandom(WEATHER_IMAGE_POOLS.snow);
  if (code >= 95)                       return pickRandom(WEATHER_IMAGE_POOLS.thunder);
  return pickRandom(WEATHER_IMAGE_POOLS.clear);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('weather')
    .setDescription('Get current weather for any city, town, or village')
    .addStringOption(o => o.setName('location').setDescription('City, town, or village name').setRequired(true)),

  prefixAliases: ['weather'],

  async execute(interaction) {
    const location = interaction.options.getString('location');
    await interaction.deferReply();
    await fetchWeather(location, (payload) => interaction.editReply(payload));
  },

  async executePrefixed(message, args) {
    const location = args.join(' ');
    if (!location) return message.reply({ embeds: [errorEmbed('Please provide a location. Example: `$weather London`')] });
    await fetchWeather(location, (payload) => message.reply(payload));
  }
};

async function fetchWeather(location, respond) {
  try {
    const geoRes = await axios.get('https://geocoding-api.open-meteo.com/v1/search', {
      params: { name: location, count: 1, language: 'en', format: 'json' },
      timeout: 8000
    });

    if (!geoRes.data.results || geoRes.data.results.length === 0) {
      return respond({ embeds: [new EmbedBuilder().setColor('#ff0000')
        .setDescription(`❌ Location **"${location}"** not found. Try a different spelling or nearby city name.`)] });
    }

    const place = geoRes.data.results[0];
    const { latitude, longitude, name, country, admin1 } = place;

    const weatherRes = await axios.get('https://api.open-meteo.com/v1/forecast', {
      params: {
        latitude, longitude,
        current: [
          'temperature_2m', 'apparent_temperature', 'relative_humidity_2m',
          'wind_speed_10m', 'wind_direction_10m', 'weather_code',
          'cloud_cover', 'visibility', 'surface_pressure', 'precipitation'
        ].join(','),
        wind_speed_unit: 'kmh',
        timezone: 'auto'
      },
      timeout: 8000
    });

    const c = weatherRes.data.current;
    const code = c.weather_code ?? 0;
    const condition = WMO_CODES[code] || { label: 'Unknown', emoji: '🌡️' };
    const color = COLORS[code] || '#00bfff';
    const imageUrl = getWeatherImage(code);

    const tempC = Math.round(c.temperature_2m);
    const tempF = Math.round(tempC * 9 / 5 + 32);
    const feelsC = Math.round(c.apparent_temperature);
    const feelsF = Math.round(feelsC * 9 / 5 + 32);
    const visKm = c.visibility != null ? (c.visibility / 1000).toFixed(1) : 'N/A';
    const region = admin1 ? `${admin1}, ${country}` : country;
    const windDir = c.wind_direction_10m != null ? degToCompass(c.wind_direction_10m) : '';

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`${condition.emoji} Weather in ${name}, ${region}`)
      .setDescription(`**${condition.label}**`)
      .setImage(imageUrl)
      .addFields(
        { name: '🌡️ Temperature',   value: `${tempC}°C / ${tempF}°F`,                        inline: true },
        { name: '🤔 Feels Like',    value: `${feelsC}°C / ${feelsF}°F`,                      inline: true },
        { name: '💧 Humidity',      value: `${c.relative_humidity_2m}%`,                     inline: true },
        { name: '💨 Wind',          value: `${Math.round(c.wind_speed_10m)} km/h ${windDir}`, inline: true },
        { name: '☁️ Cloud Cover',   value: `${c.cloud_cover}%`,                              inline: true },
        { name: '📊 Pressure',      value: `${Math.round(c.surface_pressure)} hPa`,          inline: true },
        { name: '👁️ Visibility',    value: `${visKm} km`,                                    inline: true },
        { name: '🌧️ Precipitation', value: `${c.precipitation} mm`,                         inline: true },
      )
      .setFooter({ text: `📍 ${latitude.toFixed(2)}°, ${longitude.toFixed(2)}° • Open-Meteo • Image rotates per search` })
      .setTimestamp();

    respond({ embeds: [embed] });
  } catch (err) {
    if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
      respond({ embeds: [new EmbedBuilder().setColor('#ff0000')
        .setDescription('❌ Weather service timed out. Please try again in a moment.')] });
    } else {
      respond({ embeds: [new EmbedBuilder().setColor('#ff0000')
        .setDescription(`❌ Could not fetch weather for **"${location}"**. Try again later.`)] });
    }
  }
}

function degToCompass(deg) {
  const dirs = ['N','NE','E','SE','S','SW','W','NW'];
  return dirs[Math.round(deg / 45) % 8];
}
