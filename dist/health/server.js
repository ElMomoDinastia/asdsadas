"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthServer = void 0;
exports.createDefaultHealthStatus = createDefaultHealthStatus;
const express_1 = __importDefault(require("express"));
const config_1 = require("../config");
const logger_1 = require("../utils/logger");
class HealthServer {
    app;
    server = null;
    startTime = Date.now();
    getHealth;
    getMetrics;
    constructor(getHealth, getMetrics) {
        this.app = (0, express_1.default)();
        this.getHealth = getHealth;
        this.getMetrics = getMetrics;
        this.setupRoutes();
    }
    setupRoutes() {
        this.app.get('/health', (_req, res) => {
            try {
                const health = this.getHealth();
                const statusCode = health.status === 'ok' ? 200 : health.status === 'degraded' ? 200 : 503;
                res.status(statusCode).json(health);
            }
            catch (error) {
                logger_1.healthLogger.error({ error }, 'Health check failed');
                res.status(503).json({
                    status: 'error',
                    error: 'Health check failed',
                    timestamp: new Date().toISOString(),
                });
            }
        });
        this.app.get('/live', (_req, res) => {
            res.status(200).send('OK');
        });
        this.app.get('/ready', (_req, res) => {
            const health = this.getHealth();
            if (health.roomInitialized) {
                res.status(200).send('Ready');
            }
            else {
                res.status(503).send('Not Ready');
            }
        });
        this.app.get('/room', (_req, res) => {
            const health = this.getHealth();
            if (health.roomLink) {
                res.json({ link: health.roomLink });
            }
            else {
                res.status(404).json({ error: 'Room not initialized' });
            }
        });
        this.app.get('/metrics', (_req, res) => {
            try {
                const metrics = this.getMetrics();
                const uptime = Math.floor((Date.now() - this.startTime) / 1000);
                const prometheusMetrics = [
                    '# HELP haxball_players_connected Current number of connected players',
                    '# TYPE haxball_players_connected gauge',
                    `haxball_players_connected ${metrics.playersConnected}`,
                    '',
                    '# HELP haxball_players_queue Current number of players in queue',
                    '# TYPE haxball_players_queue gauge',
                    `haxball_players_queue ${metrics.playersInQueue}`,
                    '',
                    '# HELP haxball_rounds_total Total rounds played',
                    '# TYPE haxball_rounds_total counter',
                    `haxball_rounds_total ${metrics.roundsPlayed}`,
                    '',
                    '# HELP haxball_uptime_seconds Server uptime in seconds',
                    '# TYPE haxball_uptime_seconds counter',
                    `haxball_uptime_seconds ${uptime}`,
                    '',
                    `# HELP haxball_game_phase Current game phase (label)`,
                    `# TYPE haxball_game_phase gauge`,
                    `haxball_game_phase{phase="${metrics.currentPhase}"} 1`,
                ].join('\n');
                res.set('Content-Type', 'text/plain; version=0.0.4');
                res.send(prometheusMetrics);
            }
            catch (error) {
                logger_1.healthLogger.error({ error }, 'Metrics generation failed');
                res.status(500).send('# Error generating metrics');
            }
        });
    }
    start() {
        this.server = this.app.listen(config_1.config.port, () => {
            logger_1.healthLogger.info({ port: config_1.config.port }, 'Health server started');
        });
    }
    stop() {
        if (this.server) {
            this.server.close();
            this.server = null;
            logger_1.healthLogger.info('Health server stopped');
        }
    }
    getUptime() {
        return Date.now() - this.startTime;
    }
}
exports.HealthServer = HealthServer;
/**
 * Create default health status
 */
function createDefaultHealthStatus() {
    return {
        status: 'ok',
        uptime: 0,
        timestamp: new Date().toISOString(),
        roomLink: null,
        roomInitialized: false,
        currentPhase: 'WAITING',
        playersConnected: 0,
        roundsPlayed: 0,
    };
}
//# sourceMappingURL=server.js.map