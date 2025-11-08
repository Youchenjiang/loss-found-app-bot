require('dotenv').config();
const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const { CLIENT_ID, GUILD_ID, TOKEN } = process.env;

const client = new Client({
	intents: [
		// 基本事件
		GatewayIntentBits.Guilds, 

		// 排程事件
		GatewayIntentBits.GuildScheduledEvents, 

		// 聊天室如果有動作的事件
		GatewayIntentBits.GuildMessages, 

		// 接收聊天室內容的事件 → 需要到 Discord Developer Portal 把 MESSAGE CONTENT INTENT 打開
		GatewayIntentBits.MessageContent, 

		// 接收到反應的事件
		GatewayIntentBits.GuildMessageReactions 
	],
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