/**
 * HaxBall Impostor Game - Main Entry Point
 */

import { config, getPublicConfig } from './config';
import { logger } from './utils/logger';
import { createHBRoomAdapter } from './adapter/haxball.adapter';
import { GameController } from './game/controller';
import { HealthServer } from './health/server';
import { RoomConfig } from './adapter/types';

let gameController: GameController | null = null;
let healthServer: HealthServer | null = null;

async function main(): Promise<void> {
  logger.info({ config: getPublicConfig() }, 'Starting HaxBall Impostor Game...');

  // Validate environment
  if (!config.hasToken) {
    logger.warn(
      '⚠️ No HAXBALL_TOKEN provided. You will need to solve recaptcha manually in the browser.'
    );
    logger.warn('To get a token, visit: https://www.haxball.com/headlesstoken');
    logger.warn('Set the token in your .env file as HAXBALL_TOKEN');
  }

  // Create room configuration
  const roomConfig: RoomConfig = {
    roomName: config.roomName,
    maxPlayers: config.maxPlayers,
    noPlayer: config.noPlayer,
    token: config.haxballToken,
    public: true,
  };

  // Create room adapter
  const adapter = createHBRoomAdapter(roomConfig);

  // Create game controller
  gameController = new GameController(adapter);

  // Create health server
  healthServer = new HealthServer(
    () => ({
      status: gameController?.isRoomInitialized() ? 'ok' : 'degraded',
      uptime: healthServer?.getUptime() ?? 0,
      timestamp: new Date().toISOString(),
      roomLink: gameController?.getRoomLink() ?? null,
      roomInitialized: gameController?.isRoomInitialized() ?? false,
      currentPhase: gameController?.getCurrentPhase() ?? 'UNKNOWN',
      playersConnected: gameController?.getPlayerCount() ?? 0,
      roundsPlayed: gameController?.getRoundsPlayed() ?? 0,
    }),
    () => ({
      playersConnected: gameController?.getPlayerCount() ?? 0,
      playersInQueue: gameController?.getQueueCount() ?? 0,
      roundsPlayed: gameController?.getRoundsPlayed() ?? 0,
      currentPhase: gameController?.getCurrentPhase() ?? 'UNKNOWN',
      uptime: Math.floor((healthServer?.getUptime() ?? 0) / 1000),
    })
  );

  // Start health server
  healthServer.start();

  // Start game controller
  try {
    await gameController.start();
    logger.info('🎮 HaxBall Impostor Game is running!');
    logger.info(`📊 Health check available at http://localhost:${config.port}/health`);

    if (gameController.getRoomLink()) {
      logger.info(`🔗 Room link: ${gameController.getRoomLink()}`);
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Game controller error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    logger.error({ error: errorMessage, stack: errorStack }, 'Failed to start game controller');
    shutdown(1);
  }
}

function shutdown(code: number = 0): void {
  logger.info('Shutting down...');

  if (gameController) {
    gameController.stop();
    gameController = null;
  }

  if (healthServer) {
    healthServer.stop();
    healthServer = null;
  }

  process.exit(code);
}

// Handle graceful shutdown
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
process.on('uncaughtException', (error) => {
  logger.error({ error }, 'Uncaught exception');
  shutdown(1);
});
process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled rejection');
  shutdown(1);
});

// Start application
main().catch((error) => {
  logger.error({ error }, 'Fatal error during startup');
  shutdown(1);
});
