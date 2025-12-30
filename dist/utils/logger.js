"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthLogger = exports.commandLogger = exports.roomLogger = exports.gameLogger = exports.logger = void 0;
const pino_1 = __importDefault(require("pino"));
const config_1 = require("../config");
const transport = pino_1.default.transport({
    targets: [
        {
            target: 'pino-pretty',
            level: config_1.config.logLevel,
            options: {
                colorize: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname',
            },
        },
        ...(config_1.config.isProduction
            ? [
                {
                    target: 'pino/file',
                    level: config_1.config.logLevel,
                    options: {
                        destination: './logs/app.log',
                        mkdir: true,
                    },
                },
            ]
            : []),
    ],
});
exports.logger = (0, pino_1.default)({
    level: config_1.config.logLevel,
    base: {
        app: 'haxball-impostor',
    },
}, transport);
exports.gameLogger = exports.logger.child({ module: 'game' });
exports.roomLogger = exports.logger.child({ module: 'room' });
exports.commandLogger = exports.logger.child({ module: 'command' });
exports.healthLogger = exports.logger.child({ module: 'health' });
//# sourceMappingURL=logger.js.map