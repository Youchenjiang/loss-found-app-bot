const truthyValues = ['1', 'true', 'yes', 'on'];
const falsyValues = ['0', 'false', 'no', 'off'];

function readFlag(envKey, defaultValue) {
	const raw = process.env[envKey];
	if (raw === undefined) return defaultValue;

	const normalized = raw.trim().toLowerCase();
	if (truthyValues.includes(normalized)) return true;
	if (falsyValues.includes(normalized)) return false;
	return defaultValue;
}

module.exports = {
	useOpenAI: readFlag('FEATURE_USE_OPENAI', true),
	allowReplies: readFlag('FEATURE_ALLOW_REPLIES', true),
	allowReactions: readFlag('FEATURE_ALLOW_REACTIONS', true),
};

