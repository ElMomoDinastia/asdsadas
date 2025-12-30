/**
 * HaxBall Room Adapter Interface
 * Abstracts the HaxBall room API for testing and implementation flexibility
 */
/**
 * HaxBall Player object (matches HBInit API)
 */
export interface HBPlayer {
    id: number;
    name: string;
    team: number;
    admin: boolean;
    position: {
        x: number;
        y: number;
    } | null;
    auth: string;
    conn: string;
}
/**
 * Room configuration for initialization
 */
export interface RoomConfig {
    roomName: string;
    maxPlayers: number;
    noPlayer: boolean;
    token?: string;
    public?: boolean;
    password?: string;
    geo?: {
        code: string;
        lat: number;
        lon: number;
    };
}
/**
 * Announcement styling options
 */
export interface AnnouncementOptions {
    color?: number;
    style?: 'normal' | 'bold' | 'italic' | 'small' | 'small-bold' | 'small-italic';
    sound?: 0 | 1 | 2;
}
/**
 * Player disc properties for positioning
 */
export interface PlayerDiscProperties {
    x?: number;
    y?: number;
    xspeed?: number;
    yspeed?: number;
}
/**
 * Event handlers interface
 */
export interface RoomEventHandlers {
    onPlayerJoin?: (player: HBPlayer) => void;
    onPlayerLeave?: (player: HBPlayer) => void;
    onPlayerChat?: (player: HBPlayer, message: string) => boolean;
    onPlayerAdminChange?: (changedPlayer: HBPlayer, byPlayer: HBPlayer | null) => void;
    onPlayerTeamChange?: (changedPlayer: HBPlayer, byPlayer: HBPlayer | null) => void;
    onRoomLink?: (link: string) => void;
    onGameTick?: () => void;
}
/**
 * Abstract interface for HaxBall room operations
 * Allows mocking for tests and swapping implementations
 */
export interface IHBRoomAdapter {
    initialize(): Promise<void>;
    getRoomLink(): string | null;
    isInitialized(): boolean;
    getPlayerList(): HBPlayer[] | Promise<HBPlayer[]>;
    getPlayer(id: number): HBPlayer | null | Promise<HBPlayer | null>;
    setPlayerAdmin(playerId: number, admin: boolean): void | Promise<void>;
    setPlayerTeam(playerId: number, team: number): void | Promise<void>;
    kickPlayer(playerId: number, reason: string, ban?: boolean): void | Promise<void>;
    sendChat(message: string, targetId?: number): void | Promise<void>;
    sendAnnouncement(message: string, targetId?: number | null, options?: AnnouncementOptions): void | Promise<void>;
    setEventHandlers(handlers: RoomEventHandlers): void;
    setCustomStadium(stadium: string): void | Promise<void>;
    setPlayerDiscProperties(playerId: number, props: PlayerDiscProperties): void | Promise<void>;
    startGame(): void | Promise<void>;
    stopGame(): void | Promise<void>;
    setTeamsLock(locked: boolean): void | Promise<void>;
    close(): void | Promise<void>;
}
/**
 * Factory function type for creating room adapters
 */
export type RoomAdapterFactory = (config: RoomConfig) => IHBRoomAdapter;
//# sourceMappingURL=types.d.ts.map