/**
 * Game Controller - Orchestrates the game logic and room adapter
 */
import { IHBRoomAdapter } from '../adapter/types';
import { GameState } from '../game/types';
export declare class GameController {
    private adapter;
    private state;
    private footballers;
    private phaseTimer;
    private assignDelayTimer;
    private roundLogs;
    constructor(adapter: IHBRoomAdapter, footballers?: string[]);
    private setupEventHandlers;
    private handleRoomLink;
    private handlePlayerJoin;
    private handlePlayerLeave;
    private handlePlayerChat;
    private applyTransition;
    private containsSpoiler;
    private setupGameField;
    private isPlayerInRound;
    private executeSideEffects;
    private setPhaseTimer;
    private clearPhaseTimer;
    private handlePhaseTimeout;
    private logRound;
    getState(): GameState;
    getRoomLink(): string | null;
    isRoomInitialized(): boolean;
    getPlayerCount(): number;
    getQueueCount(): number;
    getRoundsPlayed(): number;
    getCurrentPhase(): string;
    setFootballers(footballers: string[]): void;
    start(): Promise<void>;
    stop(): void;
}
//# sourceMappingURL=controller.d.ts.map