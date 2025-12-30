import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

export interface Config {
  // HaxBall
  haxballToken: string | undefined;
  roomName: string;
  maxPlayers: number;
  noPlayer: boolean;

  // Server
  port: number;
  logLevel: string;

  // Game Timing (in seconds)
  clueTime: number;
  discussionTime: number;
  votingTime: number;

  // Derived
  isProduction: boolean;
  hasToken: boolean;
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

function getEnvBoolean(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true';
}

function loadConfig(): Config {
  const roomIdRaw = process.env.ROOM_ID || '1';
  const roomIdFormated = roomIdRaw.padStart(2, '0');
  
  const haxballToken = process.env[`TOKEN_${roomIdRaw}`] || process.env.HAXBALL_TOKEN;

  return {
    haxballToken: haxballToken && haxballToken.trim() !== '' ? haxballToken : undefined,
    
    roomName: `🔴  「 𝙄𝙈𝙋𝙊𝙎𝙏𝙊𝙍 」  #${roomIdFormated}`,
    
    maxPlayers: getEnvNumber('MAX_PLAYERS', 16),
    noPlayer: getEnvBoolean('NO_PLAYER', true),

    port: getEnvNumber('PORT', 3000),
    logLevel: process.env.LOG_LEVEL || 'info',

    clueTime: getEnvNumber('CLUE_TIME', 30),
    discussionTime: getEnvNumber('DISCUSSION_TIME', 30),
    votingTime: getEnvNumber('VOTING_TIME', 45),

    // Derived
    isProduction: process.env.NODE_ENV === 'production',
    hasToken: !!(haxballToken && haxballToken.trim() !== ''),
  };
}

export const config = loadConfig();

// Log config on startup (excluding sensitive data)
export function getPublicConfig(): Omit<Config, 'haxballToken'> & { haxballToken: string } {
  return {
    ...config,
    haxballToken: config.hasToken ? '[REDACTED]' : '[NOT SET]',
  };
}
