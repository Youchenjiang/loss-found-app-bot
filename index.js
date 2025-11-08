require('dotenv').config();
const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const { CLIENT_ID, GUILD_ID, TOKEN } = process.env;

const client = new Client({
	intents: [GatewayIntentBits.Guilds],
	presence: {
		activities: [{
			name: "線上狀態",
			type: ActivityType.Playing,
		}],
		status: 'online',
	},
});

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'ping') {
    await interaction.reply('Pong!');
  }
});

client.login(TOKEN);