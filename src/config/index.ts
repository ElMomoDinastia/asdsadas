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

export const config = loadConfig();

// Log config on startup (excluding sensitive data)
export function getPublicConfig(): Omit<Config, 'haxballToken'> & { haxballToken: string } {
  return {
    ...config,
    haxballToken: config.hasToken ? '[REDACTED]' : '[NOT SET]',
  };
}
