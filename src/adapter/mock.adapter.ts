/**
 * Mock HaxBall Room Adapter for Testing
 */

import {
  IHBRoomAdapter,
  HBPlayer,
  RoomConfig,
  RoomEventHandlers,
  AnnouncementOptions,
  PlayerDiscProperties,
} from './types';

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
export class MockHBRoomAdapter implements IHBRoomAdapter {
  private players: Map<number, HBPlayer> = new Map();
  private handlers: RoomEventHandlers = {};
  private messages: RecordedMessage[] = [];
  private roomLink: string = 'https://www.haxball.com/play?c=MOCK_ROOM_ID';
  private initialized: boolean = false;
  private nextPlayerId: number = 1;

  constructor(_config: RoomConfig) {
    // Config stored for potential future use
  }

  async initialize(): Promise<void> {
    this.initialized = true;
    // Simulate room link callback
    setTimeout(() => {
      this.handlers.onRoomLink?.(this.roomLink);
    }, 100);
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getRoomLink(): string | null {
    return this.initialized ? this.roomLink : null;
  }

  getPlayerList(): HBPlayer[] {
    return Array.from(this.players.values());
  }

  getPlayer(id: number): HBPlayer | null {
    return this.players.get(id) ?? null;
  }

  setPlayerAdmin(playerId: number, admin: boolean): void {
    const player = this.players.get(playerId);
    if (player) {
      const updatedPlayer = { ...player, admin };
      this.players.set(playerId, updatedPlayer);
      this.handlers.onPlayerAdminChange?.(updatedPlayer, null);
    }
  }

  setPlayerTeam(playerId: number, team: number): void {
    const player = this.players.get(playerId);
    if (player) {
      const updatedPlayer = { ...player, team };
      this.players.set(playerId, updatedPlayer);
      this.handlers.onPlayerTeamChange?.(updatedPlayer, null);
    }
  }

  kickPlayer(playerId: number, _reason: string, _ban?: boolean): void {
    const player = this.players.get(playerId);
    if (player) {
      this.players.delete(playerId);
      this.handlers.onPlayerLeave?.(player);
    }
  }

  sendChat(message: string, targetId?: number): void {
    this.messages.push({
      type: 'chat',
      message,
      targetId,
      timestamp: Date.now(),
    });
  }

  sendAnnouncement(
    message: string,
    targetId?: number | null,
    options?: AnnouncementOptions
  ): void {
    this.messages.push({
      type: 'announcement',
      message,
      targetId,
      options,
      timestamp: Date.now(),
    });
  }

  setEventHandlers(handlers: RoomEventHandlers): void {
    this.handlers = handlers;
  }

  setCustomStadium(_stadium: string): void {
    // Mock - no-op
  }

  setPlayerDiscProperties(_playerId: number, _props: PlayerDiscProperties): void {
    // Mock - no-op
  }

  startGame(): void {
    // Mock - no-op
  }

  stopGame(): void {
    // Mock - no-op
  }

  setTeamsLock(_locked: boolean): void {
    // Mock - no-op
  }

  close(): void {
    this.players.clear();
    this.messages = [];
    this.initialized = false;
  }

  // === Test Helper Methods ===

  /**
   * Simulate a player joining the room
   */
  simulatePlayerJoin(name: string, isAdmin: boolean = false): HBPlayer {
    const player: HBPlayer = {
      id: this.nextPlayerId++,
      name,
      team: 0,
      admin: isAdmin,
      position: null,
      auth: `auth_${name}_${Date.now()}`,
      conn: `conn_${name}`,
    };
    this.players.set(player.id, player);
    this.handlers.onPlayerJoin?.(player);
    return player;
  }

  /**
   * Simulate a player leaving the room
   */
  simulatePlayerLeave(playerId: number): void {
    const player = this.players.get(playerId);
    if (player) {
      this.players.delete(playerId);
      this.handlers.onPlayerLeave?.(player);
    }
  }

  /**
   * Simulate a player sending a chat message
   * Returns false if the message was blocked by the handler
   */
  simulatePlayerChat(playerId: number, message: string): boolean {
    const player = this.players.get(playerId);
    if (!player) return false;
    return this.handlers.onPlayerChat?.(player, message) ?? true;
  }

  /**
   * Get all recorded messages (for assertions)
   */
  getRecordedMessages(): RecordedMessage[] {
    return [...this.messages];
  }

  /**
   * Get messages sent to a specific player
   */
  getPrivateMessages(playerId: number): RecordedMessage[] {
    return this.messages.filter((m) => m.targetId === playerId);
  }

  /**
   * Get public messages (sent to everyone)
   */
  getPublicMessages(): RecordedMessage[] {
    return this.messages.filter((m) => m.targetId === undefined || m.targetId === null);
  }

  /**
   * Clear recorded messages (useful between test assertions)
   */
  clearMessages(): void {
    this.messages = [];
  }

  /**
   * Reset the mock adapter to initial state
   */
  reset(): void {
    this.players.clear();
    this.messages = [];
    this.nextPlayerId = 1;
  }
}

/**
 * Create a mock adapter factory for testing
 */
export function createMockAdapter(config: RoomConfig): MockHBRoomAdapter {
  return new MockHBRoomAdapter(config);
}
