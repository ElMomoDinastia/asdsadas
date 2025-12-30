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
export declare class HealthServer {
    private app;
    private server;
    private startTime;
    private getHealth;
    private getMetrics;
    constructor(getHealth: HealthCallback, getMetrics: MetricsCallback);
    private setupRoutes;
    start(): void;
    stop(): void;
    getUptime(): number;
}
/**
 * Create default health status
 */
export declare function createDefaultHealthStatus(): HealthStatus;
export {};
//# sourceMappingURL=server.d.ts.map