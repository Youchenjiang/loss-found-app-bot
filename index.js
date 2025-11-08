require('dotenv').config();
const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const { CLIENT_ID, GUILD_ID, TOKEN } = process.env;

const keyword = 'lfa';
const responseMessage = '你好啊！';

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
});

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
  client.user.setPresence({ activities: [{ name: '被編程中', type: ActivityType.Playing }] , status: 'online' });
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'ping') {
    await interaction.reply('Pong!');
  }
});

client.on('messageCreate', async message => {
	if (message.author.bot) return;
	if(message.content.includes(keyword)){
		message.reply(responseMessage)
	}
})

client.login(TOKEN);