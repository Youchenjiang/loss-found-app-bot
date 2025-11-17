require('dotenv').config();
const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const OpenAI = require('openai');
const featureFlags = require('./config/features');

const {
	TOKEN,
	REACTION_EMOJI,
	OPENAI_API_KEY,
	OPENAI_BASE_URL,
	OPENAI_MODEL,
	LOW_EMOTION_REPLY
} = process.env;

const keyword = 'lfa';
const supportiveReply = LOW_EMOTION_REPLY || '聽起來你真的辛苦了，先深呼吸、給自己一點時間，也別忘了找信任的人聊聊。';
const reactionEmoji = REACTION_EMOJI || '👍';
const decisionModel = OPENAI_MODEL || 'gpt-4o-mini';
const lowEmotionCuePattern = /(崩潰|崩溃|難過|难过|傷心|伤心|痛苦|絕望|绝望|我不行|不想活|好累|沮喪|沮丧|憂鬱|忧郁|焦慮|焦虑|壓力|压力|help|救命|救救我|拜託|拜托|QQ|T_T|:'\(|:’\(|哭|哭哭|sob|depress|anxious|無助|无助|恐慌|失眠|自責|自责|痛心|遺憾|遗憾|煎熬)/i;
const emotionalCuePattern = /[!?！？…~⋯]|(XD|QQ|囧|怒|氣|气|哭|笑|爽|悲|累|崩潰|崩溃|開心|开心|難過|难过|興奮|兴奋|緊張|紧张|害怕|期待|激動|激动|生氣|生气|煩|烦|糟糕|無語|无语|靠北|傻眼|:D|:\)|:\(|:o|>_<|orz|哈哈|哭哭|爽啦|angry|sad|happy|mad|tired|yay|lol|haha|lmao|omg|wow)/i;
const commandSplitRegex = /[,，\n]+/;
const emojiKeywordMap = {
	good: '👍',
	ok: '👍',
	positive: '👍',
	great: '👍',
	happy: '😊',
	excited: '🤩',
	love: '❤️',
	heart: '❤️',
	proud: '🤗',
	bad: '😢',
	sad: '😢',
	down: '😢',
	upset: '😢',
	cry: '😭',
	negative: '😢',
	angry: '😠',
	mad: '😡',
	shock: '😮',
	wow: '😮',
	fear: '😨',
	anxious: '😰'
};

const openai = OPENAI_API_KEY && featureFlags.useOpenAI
	? new OpenAI({
		apiKey: OPENAI_API_KEY,
		baseURL: OPENAI_BASE_URL || undefined,
	})
	: null;

const decisionSystemPrompt = `
你是一個專門為 Discord Bot 做互動判斷的助理。請依照輸入的訊息內容，只輸出幾個以逗號分隔的指令，每個指令都必須採用 "KEY|VALUE" 格式（例如：react|👍, reply|嗨，很高興見到你）。
- 支援的 KEY：react / reaction / emoji（代表只需要按表情）、reply / say / message / text（代表要發訊息）、action / mode（明確指定 ignore、reaction、reply、reply_and_reaction 等）。
- 若需要同時回覆和表情，可以輸出兩組指令，例如：reply|感謝你的分享, react|😊。
- 若只需要按表情，可輸出 react|😂 或 emoji|sad（sad 會被系統轉換成對應表情）。
- 若應該完全忽略，請輸出 action|ignore。
- 所有回覆文字請使用繁體中文，且不要承諾「我能幫忙」這類內容，鼓勵即可。
- 嚴格遵守上述格式，勿輸出 JSON 或多餘敘述。
`;

function deriveFallbackDecision(content = '') {
	const normalized = content.toLowerCase();
	const isExtremelyLow = normalized.includes(keyword) || lowEmotionCuePattern.test(content);

	if (isExtremelyLow) {
		return {
			action: 'reply_and_reaction',
			replyText: supportiveReply,
			reaction: reactionEmoji,
		};
	}

	if (emotionalCuePattern.test(content)) {
		return { action: 'reaction', reaction: reactionEmoji };
	}

	return { action: 'ignore' };
}

async function reactToMessage(message, emojiCandidate) {
	if (!featureFlags.allowReactions) return;

	const emojiToUse = emojiCandidate || reactionEmoji;
	if (!emojiToUse) return;

	try {
		await message.react(emojiToUse);
	} catch (error) {
		console.error(`無法在訊息上加入表情符號: ${error.message}`);
	}
}

function looksLikeEmoji(value = '') {
	return /\p{Extended_Pictographic}/u.test(value);
}

function normalizeEmojiValue(value = '') {
	const trimmed = value.trim();
	if (!trimmed) return '';
	if (looksLikeEmoji(trimmed)) return trimmed;

	const key = trimmed.replace(/\s+/g, '').toLowerCase();
	if (emojiKeywordMap[key]) return emojiKeywordMap[key];
	return trimmed;
}

function coerceActionKeyword(raw = '') {
	const value = raw.trim().toLowerCase();
	if (!value) return undefined;

	if (['ignore', 'skip', 'none'].includes(value)) return 'ignore';
	if (['reaction', 'react', 'emoji'].includes(value)) return 'reaction';
	if (['reply', 'say', 'message', 'text', 'talk'].includes(value)) return 'reply';
	if (['reply_and_reaction', 'both', 'all', 'reply+reaction', 'combo'].includes(value)) {
		return 'reply_and_reaction';
	}
	return undefined;
}

function parseInstructionOutput(rawOutput, originalContent) {
	if (!rawOutput) return null;

	const tokens = rawOutput
		.split(commandSplitRegex)
		.map(token => token.trim())
		.filter(Boolean);

	if (!tokens.length) return null;

	const aliasMap = {
		reply: 'reply',
		say: 'reply',
		message: 'reply',
		text: 'reply',
		hi: 'reply',
		react: 'reaction',
		reaction: 'reaction',
		emoji: 'reaction',
		action: 'action',
		mode: 'action',
		plan: 'action'
	};

	let replyText;
	let reaction;
	let explicitAction;
	let pendingKey = null;

	for (const token of tokens) {
		const pairMatch = token.match(/^([^|:]+)[|:](.+)$/);
		let key;
		let value;

		if (pairMatch) {
			key = pairMatch[1].trim().toLowerCase();
			value = pairMatch[2].trim();
		} else if (pendingKey) {
			key = pendingKey;
			value = token;
			pendingKey = null;
		} else {
			const normalized = token.toLowerCase();
			if (aliasMap[normalized]) {
				pendingKey = normalized;
				continue;
			}

			const inferredAction = coerceActionKeyword(normalized);
			if (inferredAction) {
				explicitAction = inferredAction;
				continue;
			}

			// treat standalone text as reply content if nothing else filled
			if (!replyText) {
				replyText = token;
			}
			continue;
		}

		const canonicalKey = aliasMap[key] || key;

		if (canonicalKey === 'reply') {
			if (value) replyText = value;
			continue;
		}

		if (canonicalKey === 'reaction') {
			reaction = normalizeEmojiValue(value) || reactionEmoji;
			continue;
		}

		if (canonicalKey === 'action') {
			const inferred = coerceActionKeyword(value);
			if (inferred) explicitAction = inferred;
			continue;
		}
	}

	// handle trailing command without value
	if (pendingKey === 'reaction' && !reaction) {
		reaction = reactionEmoji;
	} else if (pendingKey === 'reply' && !replyText) {
		replyText = supportiveReply;
	}

	if (!replyText && explicitAction === 'reply') {
		replyText = supportiveReply;
	}
	if (!reaction && (explicitAction === 'reaction' || explicitAction === 'reply_and_reaction')) {
		reaction = reactionEmoji;
	}

	let action = 'ignore';
	if (replyText && reaction) {
		action = 'reply_and_reaction';
	} else if (replyText) {
		action = 'reply';
	} else if (reaction) {
		action = 'reaction';
	} else if (explicitAction) {
		action = explicitAction;
	}

	if (action !== 'reply' && action !== 'reply_and_reaction') {
		replyText = undefined;
	}

	if (action !== 'reaction' && action !== 'reply_and_reaction') {
		reaction = undefined;
	}

	return { action, replyText, reaction };
}

function applyFeatureGates(plan) {
	if (!plan) return null;

	let { action, replyText, reaction } = plan;

	if (!featureFlags.allowReplies) {
		replyText = undefined;

		if (action === 'reply_and_reaction') {
			action = featureFlags.allowReactions && reaction ? 'reaction' : 'ignore';
		} else if (action === 'reply') {
			action = featureFlags.allowReactions && reaction ? 'reaction' : 'ignore';
		}
	}

	if (!featureFlags.allowReactions) {
		reaction = undefined;

		if (action === 'reply_and_reaction') {
			action = replyText ? 'reply' : 'ignore';
		} else if (action === 'reaction') {
			action = 'ignore';
		}
	}

	if ((action === 'reply' || action === 'reply_and_reaction') && !replyText) {
		action = reaction && featureFlags.allowReactions ? 'reaction' : 'ignore';
	}

	if ((action === 'reaction' || action === 'reply_and_reaction') && !reaction) {
		action = replyText && featureFlags.allowReplies ? 'reply' : 'ignore';
	}

	return action === 'ignore' ? { action } : { action, replyText, reaction };
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
		return applyFeatureGates(deriveFallbackDecision(message.content));
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
		const plan = parseInstructionOutput(aiReply, message.content);
		if (!plan) throw new Error('AI plan was empty or invalid');
		return applyFeatureGates(plan);
	} catch (error) {
		console.error('AI 判斷失敗，改用預設策略：', error.message);
		return applyFeatureGates(deriveFallbackDecision(message.content));
	}
}

client.on('messageCreate', async message => {
	if (message.author.bot) return;

	const decision = await analyzeIncomingMessage(message);
	if (!decision || decision.action === 'ignore') return;

	if (decision.action === 'reply_and_reaction') {
		const replyText = decision.replyText || supportiveReply;
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