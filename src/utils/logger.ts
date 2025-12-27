import pino from 'pino';
import { config } from '../config';

const transport = pino.transport({
  targets: [
    // Console output with pretty printing
    {
      target: 'pino-pretty',
      level: config.logLevel,
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    },
    // File output for production
    ...(config.isProduction
      ? [
          {
            target: 'pino/file',
            level: config.logLevel,
            options: {
              destination: './logs/app.log',
              mkdir: true,
            },
          },
        ]
      : []),
  ],
});

export const logger = pino(
  {
    level: config.logLevel,
    base: {
      app: 'haxball-impostor',
    },
  },
  transport
);

// Child loggers for different modules
export const gameLogger = logger.child({ module: 'game' });
export const roomLogger = logger.child({ module: 'room' });
export const commandLogger = logger.child({ module: 'command' });
export const healthLogger = logger.child({ module: 'health' });
