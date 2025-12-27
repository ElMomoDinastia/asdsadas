/**
 * Health Check and Metrics Server
 */

import express, { Request, Response, Application } from 'express';
import { config } from '../config';
import { healthLogger } from '../utils/logger';

interface HealthStatus {
  status: 'ok' | 'degraded' | 'error';
  uptime: number;
  timestamp: string;
  roomLink: string | null;
  roomInitialized: boolean;
  currentPhase: string;
  playersConnected: number;
  roundsPlayed: number;
}

interface MetricsData {
  playersConnected: number;
  playersInQueue: number;
  roundsPlayed: number;
  currentPhase: string;
  uptime: number;
}

type HealthCallback = () => HealthStatus;
type MetricsCallback = () => MetricsData;

export class HealthServer {
  private app: Application;
  private server: ReturnType<Application['listen']> | null = null;
  private startTime: number = Date.now();
  private getHealth: HealthCallback;
  private getMetrics: MetricsCallback;

  constructor(getHealth: HealthCallback, getMetrics: MetricsCallback) {
    this.app = express();
    this.getHealth = getHealth;
    this.getMetrics = getMetrics;
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (_req: Request, res: Response) => {
      try {
        const health = this.getHealth();
        const statusCode = health.status === 'ok' ? 200 : health.status === 'degraded' ? 200 : 503;
        res.status(statusCode).json(health);
      } catch (error) {
        healthLogger.error({ error }, 'Health check failed');
        res.status(503).json({
          status: 'error',
          error: 'Health check failed',
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Liveness probe (simple)
    this.app.get('/live', (_req: Request, res: Response) => {
      res.status(200).send('OK');
    });

    // Readiness probe
    this.app.get('/ready', (_req: Request, res: Response) => {
      const health = this.getHealth();
      if (health.roomInitialized) {
        res.status(200).send('Ready');
      } else {
        res.status(503).send('Not Ready');
      }
    });

    // Room link endpoint
    this.app.get('/room', (_req: Request, res: Response) => {
      const health = this.getHealth();
      if (health.roomLink) {
        res.json({ link: health.roomLink });
      } else {
        res.status(404).json({ error: 'Room not initialized' });
      }
    });

    // Prometheus-style metrics
    this.app.get('/metrics', (_req: Request, res: Response) => {
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
      } catch (error) {
        healthLogger.error({ error }, 'Metrics generation failed');
        res.status(500).send('# Error generating metrics');
      }
    });
  }

  start(): void {
    this.server = this.app.listen(config.port, () => {
      healthLogger.info({ port: config.port }, 'Health server started');
    });
  }

  stop(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
      healthLogger.info('Health server stopped');
    }
  }

  getUptime(): number {
    return Date.now() - this.startTime;
  }
}

/**
 * Create default health status
 */
export function createDefaultHealthStatus(): HealthStatus {
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
