"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.getPublicConfig = getPublicConfig;
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables from .env file
dotenv_1.default.config();
function getEnvNumber(key, defaultValue) {
    const value = process.env[key];
    if (!value)
        return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
}
function getEnvBoolean(key, defaultValue) {
    const value = process.env[key];
    if (!value)
        return defaultValue;
    return value.toLowerCase() === 'true';
}
function loadConfig() {
    const haxballToken = process.env.HAXBALL_TOKEN || undefined;
    return {
        // HaxBall
        haxballToken: haxballToken && haxballToken.trim() !== '' ? haxballToken : undefined,
        roomName: process.env.ROOM_NAME || '🔴 EL IMPOSTOR 🔴',
        maxPlayers: getEnvNumber('MAX_PLAYERS', 16),
        noPlayer: getEnvBoolean('NO_PLAYER', true),
        // Server
        port: getEnvNumber('PORT', 3000),
        logLevel: process.env.LOG_LEVEL || 'info',
        // Game Timing
        clueTime: getEnvNumber('CLUE_TIME', 30),
        discussionTime: getEnvNumber('DISCUSSION_TIME', 30),
        votingTime: getEnvNumber('VOTING_TIME', 45),
        // Derived
        isProduction: process.env.NODE_ENV === 'production',
        hasToken: !!(haxballToken && haxballToken.trim() !== ''),
    };
}
exports.config = loadConfig();
// Log config on startup (excluding sensitive data)
function getPublicConfig() {
    return {
        ...exports.config,
        haxballToken: exports.config.hasToken ? '[REDACTED]' : '[NOT SET]',
    };
}
//# sourceMappingURL=index.js.map