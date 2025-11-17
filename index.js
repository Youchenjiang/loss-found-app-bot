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
const lowEmotionCuePattern = /(崩潰|崩溃|難過|难过|傷心|伤心|痛苦|絕望|绝望|我不行|不想活|好累|沮喪|沮丧|憂鬱|忧郁|焦慮|焦虑|壓力|压力|help|救命|救救我|拜託|拜托|QQ|T_T|:'\(|:’\(|哭|哭哭|sob|depress|anxious|無助|无助|恐慌|失眠|自責|自责|痛心|遺憾|遗憾|煎熬)/i;
const emotionalCuePattern = /[!?！？…~⋯]|(XD|QQ|囧|怒|氣|气|哭|笑|爽|悲|累|崩潰|崩溃|開心|开心|難過|难过|興奮|兴奋|緊張|紧张|害怕|期待|激動|激动|生氣|生气|煩|烦|糟糕|無語|无语|靠北|傻眼|:D|:\)|:\(|:o|>_<|orz|哈哈|哭哭|爽啦|angry|sad|happy|mad|tired|yay|lol|haha|lmao|omg|wow)/i;

const openai = OPENAI_API_KEY
	? new OpenAI({
		apiKey: OPENAI_API_KEY,
		baseURL: OPENAI_BASE_URL || undefined,
	})
	: null;

const decisionSystemPrompt = `
你是一個專門評估訊息情緒的 Discord Bot 決策助理。請依照輸入的訊息內容，輸出唯一一個 JSON 結果，用於決定是否互動。
- 先判斷情緒強度：neutral（無情緒）、emotional（有起伏但未到極低）、extremely_low（極度低落或求助）。
- action 只能是 "reply_and_reaction"、"reaction" 或 "ignore"。
- 只有 extremely_low 才能輸出 "reply_and_reaction"，此時必須提供繁體中文、充滿鼓勵與陪伴語氣的 replyText。內容應著重溫暖、肯定、提醒對方休息或深呼吸，避免承諾「我能幫忙」或詢問「需要我幫什麼」。
- 若是 emotional（但未到極低），action 必須為 "reaction"，可提供 reaction 表情但禁止輸出文字回覆。
- 若為 neutral，action 為 "ignore"，不做任何事。
- 請格外注意求救語氣、悲傷詞彙、直接點名 "lfa" 並表達痛苦的訊息，這些通常屬於 extremely_low。
- 嚴格回傳單一 JSON，不得輸出額外文字。
`;

function deriveFallbackDecision(content = '') {
	const normalized = content.toLowerCase();
	const isExtremelyLow = normalized.includes(keyword) || lowEmotionCuePattern.test(content);

	if (isExtremelyLow) {
		return {
			action: 'reply_and_reaction',
			replyText: responseMessage,
			reaction: reactionEmoji,
		};
	}

	if (emotionalCuePattern.test(content)) {
		return { action: 'reaction', reaction: reactionEmoji };
	}

	return { action: 'ignore' };
}

async function reactToMessage(message, emojiCandidate) {
	const emojiToUse = emojiCandidate || reactionEmoji;
	if (!emojiToUse) return;

	try {
		await message.react(emojiToUse);
	} catch (error) {
		console.error(`無法在訊息上加入表情符號: ${error.message}`);
	}
}

function enforceEmotionPolicy(decision, content = '') {
	if (!decision || !decision.action) {
		return deriveFallbackDecision(content);
	}

	const hasExtremeEmotion = lowEmotionCuePattern.test(content) || content.toLowerCase().includes(keyword);
	const hasEmotion = emotionalCuePattern.test(content);

	if (decision.action === 'ignore' && hasEmotion && !hasExtremeEmotion) {
		return { action: 'reaction', reaction: decision.reaction || reactionEmoji };
	}

	if (decision.action === 'reaction') {
		return {
			...decision,
			reaction: decision.reaction || reactionEmoji,
		};
	}

	if (decision.action === 'reply_and_reaction') {
		return {
			action: 'reply_and_reaction',
			replyText: decision.replyText || responseMessage,
			reaction: decision.reaction || reactionEmoji,
		};
	}

	return decision;
}

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
		return deriveFallbackDecision(message.content);
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
		const parsed = JSON.parse(aiReply);
		return enforceEmotionPolicy(parsed, message.content);
	} catch (error) {
		console.error('AI 判斷失敗，改用預設策略：', error.message);
		return deriveFallbackDecision(message.content);
	}
}

client.on('messageCreate', async message => {
	if (message.author.bot) return;

	const decision = await analyzeIncomingMessage(message);
	if (!decision || decision.action === 'ignore') return;

	if (decision.action === 'reply_and_reaction') {
		const replyText = decision.replyText || responseMessage;
		if (replyText) {
			try {
				await message.reply(replyText);
			} catch (error) {
				console.error(`無法回覆訊息: ${error.message}`);
			}
		}

		await reactToMessage(message, decision.reaction);
		return;
	}

	if (decision.action === 'reaction') {
		await reactToMessage(message, decision.reaction);
	}
});

client.login(TOKEN);