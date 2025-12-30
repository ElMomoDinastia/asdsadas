/**
 * Mock HaxBall Room Adapter for Testing
 */
import { IHBRoomAdapter, HBPlayer, RoomConfig, RoomEventHandlers, AnnouncementOptions, PlayerDiscProperties } from './types';
interface RecordedMessage {
    type: 'chat' | 'announcement';
    message: string;
    targetId?: number | null;
    options?: AnnouncementOptions;
    timestamp: number;
}
/**
 * Mock implementation of IHBRoomAdapter for unit and integration testing
 */
export declare class MockHBRoomAdapter implements IHBRoomAdapter {
    private players;
    private handlers;
    private messages;
    private roomLink;
    private initialized;
    private nextPlayerId;
    constructor(_config: RoomConfig);
    initialize(): Promise<void>;
    isInitialized(): boolean;
    getRoomLink(): string | null;
    getPlayerList(): HBPlayer[];
    getPlayer(id: number): HBPlayer | null;
    setPlayerAdmin(playerId: number, admin: boolean): void;
    setPlayerTeam(playerId: number, team: number): void;
    kickPlayer(playerId: number, _reason: string, _ban?: boolean): void;
    sendChat(message: string, targetId?: number): void;
    sendAnnouncement(message: string, targetId?: number | null, options?: AnnouncementOptions): void;
    setEventHandlers(handlers: RoomEventHandlers): void;
    setCustomStadium(_stadium: string): void;
    setPlayerDiscProperties(_playerId: number, _props: PlayerDiscProperties): void;
    startGame(): void;
    stopGame(): void;
    setTeamsLock(_locked: boolean): void;
    close(): void;
    /**
     * Simulate a player joining the room
     */
    simulatePlayerJoin(name: string, isAdmin?: boolean): HBPlayer;
    /**
     * Simulate a player leaving the room
     */
    simulatePlayerLeave(playerId: number): void;
    /**
     * Simulate a player sending a chat message
     * Returns false if the message was blocked by the handler
     */
    simulatePlayerChat(playerId: number, message: string): boolean;
    /**
     * Get all recorded messages (for assertions)
     */
    getRecordedMessages(): RecordedMessage[];
    /**
     * Get messages sent to a specific player
     */
    getPrivateMessages(playerId: number): RecordedMessage[];
    /**
     * Get public messages (sent to everyone)
     */
    getPublicMessages(): RecordedMessage[];
    /**
     * Clear recorded messages (useful between test assertions)
     */
    clearMessages(): void;
    /**
     * Reset the mock adapter to initial state
     */
    reset(): void;
}
/**
 * Create a mock adapter factory for testing
 */
export declare function createMockAdapter(config: RoomConfig): MockHBRoomAdapter;
export {};
//# sourceMappingURL=mock.adapter.d.ts.map