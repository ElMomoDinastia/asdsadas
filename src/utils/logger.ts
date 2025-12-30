import pino from 'pino';
import { config } from '../config';

const transport = pino.transport({
  targets: [
    {
      target: 'pino-pretty',
      level: config.logLevel,
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    },
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

export const gameLogger = logger.child({ module: 'game' });
export const roomLogger = logger.child({ module: 'room' });
export const commandLogger = logger.child({ module: 'command' });
export const healthLogger = logger.child({ module: 'health' });
