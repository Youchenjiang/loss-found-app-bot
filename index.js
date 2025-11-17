require('dotenv').config();
const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const OpenAI = require('openai');

const {
	TOKEN,
	REACTION_EMOJI,
	OPENAI_API_KEY,
	OPENAI_BASE_URL,
	OPENAI_MODEL
} = process.env;

const keyword = 'lfa';
const responseMessage = '你好啊！';
const reactionEmoji = REACTION_EMOJI || '👍';
const decisionModel = OPENAI_MODEL || 'gpt-4o-mini';

const openai = OPENAI_API_KEY
	? new OpenAI({
		apiKey: OPENAI_API_KEY,
		baseURL: OPENAI_BASE_URL || undefined,
	})
	: null;

const decisionSystemPrompt = `
你是一個只負責判斷 Discord Bot 回應方式的助理。請依照輸入的訊息內容，輸出唯一一個 JSON 結果，用於決定是否互動。
- action 只能是 "reply"、"reaction" 或 "ignore"。
- 若 action 為 "reply"，必須提供 replyText（繁體中文），reaction 可省略。
- 若 action 為 "reaction"，可提供 reaction 欄位表示自訂表情，否則由程式決定。
- 若訊息與 bot 無關、或應忽略，action 為 "ignore"。
- 優先在被點名、包含關鍵字 "lfa"、需要協助或有疑問時選擇 reply。
- 簡短正向訊息可用 reaction；禁止同時回覆與按表情。
- 嚴格回傳單一 JSON，不得有多餘文字。
`;

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildScheduledEvents,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildMessageReactions
	],
});

client.on('ready', () => {
	console.log(`Logged in as ${client.user.tag}!`);
	client.user.setPresence({ activities: [{ name: '被編程中', type: ActivityType.Playing }], status: 'online' });
});

client.on('interactionCreate', async interaction => {
	if (!interaction.isChatInputCommand()) return;

	if (interaction.commandName === 'ping') {
		await interaction.reply('Pong!');
	}
});

async function analyzeIncomingMessage(message) {
	if (!openai) {
		if (message.content.includes(keyword)) {
			return { action: 'reply', replyText: responseMessage };
		}
		return { action: 'reaction', reaction: reactionEmoji };
	}

	try {
		const completion = await openai.chat.completions.create({
			model: decisionModel,
			temperature: 0.3,
			messages: [
				{ role: 'system', content: decisionSystemPrompt },
				{
					role: 'user',
					content: JSON.stringify({
						author: message.author?.username,
						content: message.content,
						channel: message.channel?.name,
						keyword,
					})
				}
			]
		});

		const aiReply = completion.choices[0]?.message?.content;
		if (!aiReply) throw new Error('AI response was empty');
		return JSON.parse(aiReply);
	} catch (error) {
		console.error('AI 判斷失敗，改用預設策略：', error.message);
		if (message.content.includes(keyword)) {
			return { action: 'reply', replyText: responseMessage };
		}
		return { action: 'reaction', reaction: reactionEmoji };
	}
}

client.on('messageCreate', async message => {
	if (message.author.bot) return;

	const decision = await analyzeIncomingMessage(message);
	if (!decision || decision.action === 'ignore') return;

	if (decision.action === 'reply' && decision.replyText) {
		await message.reply(decision.replyText);
		return;
	}

	if (decision.action === 'reaction') {
		const emojiToUse = decision.reaction || reactionEmoji;
		try {
			await message.react(emojiToUse);
		} catch (error) {
			console.error(`無法在訊息上加入表情符號: ${error.message}`);
		}
	}
});

client.login(TOKEN);