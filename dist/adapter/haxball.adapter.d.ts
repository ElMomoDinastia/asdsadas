import { IHBRoomAdapter, HBPlayer, RoomConfig, RoomEventHandlers, AnnouncementOptions, PlayerDiscProperties } from './types';
export declare class HBRoomAdapter implements IHBRoomAdapter {
    private browser;
    private page;
    private roomLink;
    private handlers;
    private config;
    private initialized;
    private pollingInterval;
    constructor(config: RoomConfig);
    initialize(): Promise<void>;
    private loadDefaultStadium;
    private startEventPolling;
    private handleEvent;
    isInitialized(): boolean;
    getRoomLink(): string | null;
    getPlayerList(): Promise<HBPlayer[]>;
    getPlayer(id: number): Promise<HBPlayer | null>;
    setPlayerAdmin(playerId: number, admin: boolean): Promise<void>;
    setPlayerTeam(playerId: number, team: number): Promise<void>;
    kickPlayer(playerId: number, reason: string, ban?: boolean): Promise<void>;
    sendChat(message: string, targetId?: number): Promise<void>;
    sendAnnouncement(message: string, targetId?: number | null, options?: AnnouncementOptions): Promise<void>;
    setEventHandlers(handlers: RoomEventHandlers): void;
    setCustomStadium(stadium: string): Promise<void>;
    setPlayerDiscProperties(playerId: number, props: PlayerDiscProperties): Promise<void>;
    startGame(): Promise<void>;
    stopGame(): Promise<void>;
    setTeamsLock(locked: boolean): Promise<void>;
    close(): Promise<void>;
}
/**
 * Factory function to create real HaxBall adapter
 */
export declare function createHBRoomAdapter(config: RoomConfig): HBRoomAdapter;
//# sourceMappingURL=haxball.adapter.d.ts.map