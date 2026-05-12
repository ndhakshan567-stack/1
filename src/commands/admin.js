const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database/db');
const { getGuildSettings, hasAdminRole, errorEmbed, successEmbed, parseColor, COLORS } = require('../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin')
    .setDescription('Admin configuration commands')
    .addSubcommand(s => s.setName('setwelcome').setDescription('Set welcome channel')
      .addChannelOption(o => o.setName('channel').setDescription('Channel').setRequired(true)))
    .addSubcommand(s => s.setName('setlog').setDescription('Set log channel')
      .addChannelOption(o => o.setName('channel').setDescription('Channel').setRequired(true)))
    .addSubcommand(s => s.setName('setreport').setDescription('Set report channel')
      .addChannelOption(o => o.setName('channel').setDescription('Channel').setRequired(true)))
    .addSubcommand(s => s.setName('setadminrole').setDescription('Set the admin/command role')
      .addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true)))
    .addSubcommand(s => s.setName('setmodrole').setDescription('Set the moderator role')
      .addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true)))
    .addSubcommand(s => s.setName('setverifyrole').setDescription('Set the verification role')
      .addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true)))
    .addSubcommand(s => s.setName('setdmstyle').setDescription('Set DM message style')
      .addStringOption(o => o.setName('style').setDescription('Style').setRequired(true).addChoices({ name: 'Embedded', value: 'embed' }, { name: 'Plain Text', value: 'plain' })))
    .addSubcommand(s => s.setName('setdmmessage').setDescription('Set DM message content')
      .addStringOption(o => o.setName('message').setDescription('Message content').setRequired(true)))
    .addSubcommand(s => s.setName('setdmcolor').setDescription('Set DM embed color')
      .addStringOption(o => o.setName('color').setDescription('Color name or hex').setRequired(true)))
    .addSubcommand(s => s.setName('autorole').setDescription('Add/remove an auto-role for new members')
      .addRoleOption(o => o.setName('role').setDescription('Role to auto-assign').setRequired(true))
      .addStringOption(o => o.setName('action').setDescription('Add or remove').setRequired(true).addChoices({ name: 'Add', value: 'add' }, { name: 'Remove', value: 'remove' })))
    .addSubcommand(s => s.setName('addshoprole').setDescription('Add a role to the shop')
      .addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true))
      .addIntegerOption(o => o.setName('price').setDescription('Price in Minecoins').setRequired(true).setMinValue(1)))
    .addSubcommand(s => s.setName('wordfilter').setDescription('Add/remove a word from the filter')
      .addStringOption(o => o.setName('word').setDescription('Word').setRequired(true))
      .addStringOption(o => o.setName('action').setDescription('Add or remove').setRequired(true).addChoices({ name: 'Add', value: 'add' }, { name: 'Remove', value: 'remove' })))
    .addSubcommand(s => s.setName('customcmd').setDescription('Add/remove a custom prefix command')
      .addStringOption(o => o.setName('trigger').setDescription('Command trigger (without $)').setRequired(true))
      .addStringOption(o => o.setName('action').setDescription('Add or remove').setRequired(true).addChoices({ name: 'Add', value: 'add' }, { name: 'Remove', value: 'remove' }))
      .addStringOption(o => o.setName('response').setDescription('Response text (required when adding)').setRequired(false)))
    .addSubcommand(s => s.setName('sticky').setDescription('Set/remove a sticky message in a channel')
      .addChannelOption(o => o.setName('channel').setDescription('Channel').setRequired(true))
      .addStringOption(o => o.setName('message').setDescription('Message (leave blank to remove)').setRequired(false)))
    .addSubcommand(s => s.setName('levelupchannel').setDescription('Set level-up announcement channel')
      .addChannelOption(o => o.setName('channel').setDescription('Channel').setRequired(true)))
    .addSubcommand(s => s.setName('setyoutubechannel').setDescription('Set a YouTube channel ID to monitor for new uploads')
      .addStringOption(o => o.setName('channel_id').setDescription('YouTube channel ID (found in YouTube Studio)').setRequired(true)))
    .addSubcommand(s => s.setName('setuploadchannel').setDescription('Set the Discord channel to post YouTube upload notifications')
      .addChannelOption(o => o.setName('channel').setDescription('Discord channel for YouTube notifications').setRequired(true)))
    .addSubcommand(s => s.setName('setruleschannel').setDescription('Set the default channel for /rules post')
      .addChannelOption(o => o.setName('channel').setDescription('Rules channel').setRequired(true)))
    .addSubcommand(s => s.setName('setsuggestionchannel').setDescription('Set the channel where suggestions are posted')
      .addChannelOption(o => o.setName('channel').setDescription('Suggestions channel').setRequired(true)))
    .addSubcommand(s => s.setName('serverinfo').setDescription('View server bot settings'))
    .addSubcommand(s => s.setName('colorlist').setDescription('List available colors')),

  async execute(interaction) {
    const settings = getGuildSettings(interaction.guild.id);
    const sub = interaction.options.getSubcommand();

    if (sub === 'setadminrole' && interaction.guild.ownerId !== interaction.user.id) {
      return interaction.reply({ embeds: [errorEmbed('Only the server owner can set the admin role.')], ephemeral: true });
    }

    if (!hasAdminRole(interaction.member, settings) && !['colorlist'].includes(sub)) {
      return interaction.reply({ embeds: [errorEmbed('You need admin permissions to use this command.')], ephemeral: true });
    }

    if (sub === 'setwelcome') {
      const ch = interaction.options.getChannel('channel');
      db.prepare('UPDATE guild_settings SET welcome_channel = ? WHERE guild_id = ?').run(ch.id, interaction.guild.id);
      return interaction.reply({ embeds: [successEmbed(`Welcome channel set to ${ch}.`)] });
    }

    if (sub === 'setlog') {
      const ch = interaction.options.getChannel('channel');
      db.prepare('UPDATE guild_settings SET log_channel = ? WHERE guild_id = ?').run(ch.id, interaction.guild.id);
      return interaction.reply({ embeds: [successEmbed(`Log channel set to ${ch}.`)] });
    }

    if (sub === 'setreport') {
      const ch = interaction.options.getChannel('channel');
      db.prepare('UPDATE guild_settings SET report_channel = ? WHERE guild_id = ?').run(ch.id, interaction.guild.id);
      return interaction.reply({ embeds: [successEmbed(`Report channel set to ${ch}.`)] });
    }

    if (sub === 'setadminrole') {
      const role = interaction.options.getRole('role');
      db.prepare('UPDATE guild_settings SET admin_role = ? WHERE guild_id = ?').run(role.id, interaction.guild.id);
      return interaction.reply({ embeds: [successEmbed(`Admin role set to ${role}.`)] });
    }

    if (sub === 'setmodrole') {
      const role = interaction.options.getRole('role');
      db.prepare('UPDATE guild_settings SET mod_role = ? WHERE guild_id = ?').run(role.id, interaction.guild.id);
      return interaction.reply({ embeds: [successEmbed(`Mod role set to ${role}.`)] });
    }

    if (sub === 'setverifyrole') {
      const role = interaction.options.getRole('role');
      db.prepare('UPDATE guild_settings SET verify_role = ? WHERE guild_id = ?').run(role.id, interaction.guild.id);
      return interaction.reply({ embeds: [successEmbed(`Verification role set to ${role}. Members will receive this role after passing the captcha.`)] });
    }

    if (sub === 'setdmstyle') {
      const style = interaction.options.getString('style');
      db.prepare('UPDATE guild_settings SET dm_embed = ? WHERE guild_id = ?').run(style === 'embed' ? 1 : 0, interaction.guild.id);
      return interaction.reply({ embeds: [successEmbed(`DM style set to **${style === 'embed' ? 'Embedded' : 'Plain Text'}**.`)] });
    }

    if (sub === 'setdmmessage') {
      const msg = interaction.options.getString('message');
      db.prepare('UPDATE guild_settings SET dm_message = ? WHERE guild_id = ?').run(msg, interaction.guild.id);
      return interaction.reply({ embeds: [successEmbed(`DM message updated.`)] });
    }

    if (sub === 'setdmcolor') {
      const color = parseColor(interaction.options.getString('color'));
      db.prepare('UPDATE guild_settings SET dm_color = ? WHERE guild_id = ?').run(color, interaction.guild.id);
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(color).setDescription(`✅ DM embed color set to \`${color}\`.`)] });
    }

    if (sub === 'autorole') {
      const role = interaction.options.getRole('role');
      const action = interaction.options.getString('action');
      if (action === 'add') {
        db.prepare('INSERT OR IGNORE INTO auto_roles (guild_id, role_id) VALUES (?, ?)').run(interaction.guild.id, role.id);
        return interaction.reply({ embeds: [successEmbed(`Auto-role ${role} added. New members will receive this role.`)] });
      } else {
        db.prepare('DELETE FROM auto_roles WHERE guild_id = ? AND role_id = ?').run(interaction.guild.id, role.id);
        return interaction.reply({ embeds: [successEmbed(`Auto-role ${role} removed.`)] });
      }
    }

    if (sub === 'addshoprole') {
      const role = interaction.options.getRole('role');
      const price = interaction.options.getInteger('price');
      db.prepare('INSERT INTO shop_roles (guild_id, role_id, role_name, price) VALUES (?, ?, ?, ?)').run(interaction.guild.id, role.id, role.name, price);
      return interaction.reply({ embeds: [successEmbed(`Added ${role} to the shop for **${price} Minecoins**.`)] });
    }

    if (sub === 'wordfilter') {
      const word = interaction.options.getString('word').toLowerCase();
      const action = interaction.options.getString('action');
      if (action === 'add') {
        db.prepare('INSERT OR IGNORE INTO word_filter (guild_id, word) VALUES (?, ?)').run(interaction.guild.id, word);
        return interaction.reply({ embeds: [successEmbed(`Word \`${word}\` added to filter.`)], ephemeral: true });
      } else {
        db.prepare('DELETE FROM word_filter WHERE guild_id = ? AND word = ?').run(interaction.guild.id, word);
        return interaction.reply({ embeds: [successEmbed(`Word \`${word}\` removed from filter.`)], ephemeral: true });
      }
    }

    if (sub === 'customcmd') {
      const trigger = interaction.options.getString('trigger').toLowerCase();
      const action = interaction.options.getString('action');
      if (action === 'add') {
        const response = interaction.options.getString('response');
        if (!response) return interaction.reply({ embeds: [errorEmbed('You must provide a response when adding a command.')], ephemeral: true });
        db.prepare('INSERT OR REPLACE INTO custom_commands (guild_id, trigger, response) VALUES (?, ?, ?)').run(interaction.guild.id, trigger, response);
        return interaction.reply({ embeds: [successEmbed(`Custom command \`$${trigger}\` added.`)] });
      } else {
        db.prepare('DELETE FROM custom_commands WHERE guild_id = ? AND trigger = ?').run(interaction.guild.id, trigger);
        return interaction.reply({ embeds: [successEmbed(`Custom command \`$${trigger}\` removed.`)] });
      }
    }

    if (sub === 'sticky') {
      const ch = interaction.options.getChannel('channel');
      const message = interaction.options.getString('message');
      if (message) {
        db.prepare('INSERT OR REPLACE INTO sticky_messages (guild_id, channel_id, message) VALUES (?, ?, ?)').run(interaction.guild.id, ch.id, message);
        return interaction.reply({ embeds: [successEmbed(`Sticky message set in ${ch}.`)] });
      } else {
        db.prepare('DELETE FROM sticky_messages WHERE guild_id = ? AND channel_id = ?').run(interaction.guild.id, ch.id);
        return interaction.reply({ embeds: [successEmbed(`Sticky message removed from ${ch}.`)] });
      }
    }

    if (sub === 'levelupchannel') {
      const ch = interaction.options.getChannel('channel');
      db.prepare('INSERT OR IGNORE INTO level_settings (guild_id) VALUES (?)').run(interaction.guild.id);
      db.prepare('UPDATE level_settings SET level_up_channel = ? WHERE guild_id = ?').run(ch.id, interaction.guild.id);
      return interaction.reply({ embeds: [successEmbed(`Level-up announcements will appear in ${ch}.`)] });
    }

    if (sub === 'setyoutubechannel') {
      const channelId = interaction.options.getString('channel_id').trim();
      db.prepare('UPDATE guild_settings SET yt_channel_id = ? WHERE guild_id = ?').run(channelId, interaction.guild.id);
      return interaction.reply({ embeds: [successEmbed(`YouTube channel ID set to \`${channelId}\`.\nMake sure to also set the upload notification channel with \`/admin setuploadchannel\`.\n\n**How to find your channel ID:** YouTube Studio → Settings → Channel → Advanced settings → Channel ID.`)] });
    }

    if (sub === 'setuploadchannel') {
      const ch = interaction.options.getChannel('channel');
      db.prepare('UPDATE guild_settings SET yt_notify_channel = ? WHERE guild_id = ?').run(ch.id, interaction.guild.id);
      return interaction.reply({ embeds: [successEmbed(`New YouTube upload notifications will be posted in ${ch} with @everyone ping!`)] });
    }

    if (sub === 'setruleschannel') {
      const ch = interaction.options.getChannel('channel');
      db.prepare('UPDATE guild_settings SET rules_channel = ? WHERE guild_id = ?').run(ch.id, interaction.guild.id);
      return interaction.reply({ embeds: [successEmbed(`Rules will be posted to ${ch} by default when using \`/rules post\`.`)] });
    }

    if (sub === 'setsuggestionchannel') {
      const ch = interaction.options.getChannel('channel');
      db.prepare('UPDATE guild_settings SET suggestion_channel = ? WHERE guild_id = ?').run(ch.id, interaction.guild.id);
      return interaction.reply({ embeds: [successEmbed(`Suggestions will be posted to ${ch}. Members can now use \`/suggest\`.`)] });
    }

    if (sub === 'serverinfo') {
      const s = getGuildSettings(interaction.guild.id);
      const embed = new EmbedBuilder().setColor('#0099ff').setTitle('⚙️ Server Bot Settings').setThumbnail(interaction.guild.iconURL({ dynamic: true }))
        .addFields(
          { name: '👋 Welcome Channel', value: s.welcome_channel ? `<#${s.welcome_channel}>` : 'Not set', inline: true },
          { name: '📋 Log Channel', value: s.log_channel ? `<#${s.log_channel}>` : 'Not set', inline: true },
          { name: '🚨 Report Channel', value: s.report_channel ? `<#${s.report_channel}>` : 'Not set', inline: true },
          { name: '👑 Admin Role', value: s.admin_role ? `<@&${s.admin_role}>` : 'Not set', inline: true },
          { name: '🛡️ Mod Role', value: s.mod_role ? `<@&${s.mod_role}>` : 'Not set', inline: true },
          { name: '✅ Verify Role', value: s.verify_role ? `<@&${s.verify_role}>` : 'Not set', inline: true },
          { name: '💬 DM Style', value: s.dm_embed ? 'Embedded' : 'Plain Text', inline: true },
          { name: '🎨 DM Color', value: s.dm_color || '#00ff00', inline: true },
          { name: '📺 YouTube Channel', value: s.yt_channel_id ? `\`${s.yt_channel_id}\`` : 'Not set', inline: true },
          { name: '🔔 Upload Notify', value: s.yt_notify_channel ? `<#${s.yt_notify_channel}>` : 'Not set', inline: true },
          { name: '📜 Rules Channel', value: s.rules_channel ? `<#${s.rules_channel}>` : 'Not set', inline: true },
          { name: '💡 Suggestions', value: s.suggestion_channel ? `<#${s.suggestion_channel}>` : 'Not set', inline: true },
        ).setTimestamp();
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'colorlist') {
      const list = Object.entries(COLORS).map(([name, hex]) => `**${name}** — \`${hex}\``).join('\n');
      return interaction.reply({ embeds: [new EmbedBuilder().setColor('#0099ff').setTitle('🎨 Available Colors').setDescription(list)], ephemeral: true });
    }
  }
};
