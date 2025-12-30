"use strict";
/**
 * Mock HaxBall Room Adapter for Testing
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockHBRoomAdapter = void 0;
exports.createMockAdapter = createMockAdapter;
/**
 * Mock implementation of IHBRoomAdapter for unit and integration testing
 */
class MockHBRoomAdapter {
    players = new Map();
    handlers = {};
    messages = [];
    roomLink = 'https://www.haxball.com/play?c=MOCK_ROOM_ID';
    initialized = false;
    nextPlayerId = 1;
    constructor(_config) {
        // Config stored for potential future use
    }
    async initialize() {
        this.initialized = true;
        // Simulate room link callback
        setTimeout(() => {
            this.handlers.onRoomLink?.(this.roomLink);
        }, 100);
    }
    isInitialized() {
        return this.initialized;
    }
    getRoomLink() {
        return this.initialized ? this.roomLink : null;
    }
    getPlayerList() {
        return Array.from(this.players.values());
    }
    getPlayer(id) {
        return this.players.get(id) ?? null;
    }
    setPlayerAdmin(playerId, admin) {
        const player = this.players.get(playerId);
        if (player) {
            const updatedPlayer = { ...player, admin };
            this.players.set(playerId, updatedPlayer);
            this.handlers.onPlayerAdminChange?.(updatedPlayer, null);
        }
    }
    setPlayerTeam(playerId, team) {
        const player = this.players.get(playerId);
        if (player) {
            const updatedPlayer = { ...player, team };
            this.players.set(playerId, updatedPlayer);
            this.handlers.onPlayerTeamChange?.(updatedPlayer, null);
        }
    }
    kickPlayer(playerId, _reason, _ban) {
        const player = this.players.get(playerId);
        if (player) {
            this.players.delete(playerId);
            this.handlers.onPlayerLeave?.(player);
        }
    }
    sendChat(message, targetId) {
        this.messages.push({
            type: 'chat',
            message,
            targetId,
            timestamp: Date.now(),
        });
    }
    sendAnnouncement(message, targetId, options) {
        this.messages.push({
            type: 'announcement',
            message,
            targetId,
            options,
            timestamp: Date.now(),
        });
    }
    setEventHandlers(handlers) {
        this.handlers = handlers;
    }
    setCustomStadium(_stadium) {
        // Mock - no-op
    }
    setPlayerDiscProperties(_playerId, _props) {
        // Mock - no-op
    }
    startGame() {
        // Mock - no-op
    }
    stopGame() {
        // Mock - no-op
    }
    setTeamsLock(_locked) {
        // Mock - no-op
    }
    close() {
        this.players.clear();
        this.messages = [];
        this.initialized = false;
    }
    // === Test Helper Methods ===
    /**
     * Simulate a player joining the room
     */
    simulatePlayerJoin(name, isAdmin = false) {
        const player = {
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
    simulatePlayerLeave(playerId) {
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
    simulatePlayerChat(playerId, message) {
        const player = this.players.get(playerId);
        if (!player)
            return false;
        return this.handlers.onPlayerChat?.(player, message) ?? true;
    }
    /**
     * Get all recorded messages (for assertions)
     */
    getRecordedMessages() {
        return [...this.messages];
    }
    /**
     * Get messages sent to a specific player
     */
    getPrivateMessages(playerId) {
        return this.messages.filter((m) => m.targetId === playerId);
    }
    /**
     * Get public messages (sent to everyone)
     */
    getPublicMessages() {
        return this.messages.filter((m) => m.targetId === undefined || m.targetId === null);
    }
    /**
     * Clear recorded messages (useful between test assertions)
     */
    clearMessages() {
        this.messages = [];
    }
    /**
     * Reset the mock adapter to initial state
     */
    reset() {
        this.players.clear();
        this.messages = [];
        this.nextPlayerId = 1;
    }
}
exports.MockHBRoomAdapter = MockHBRoomAdapter;
/**
 * Create a mock adapter factory for testing
 */
function createMockAdapter(config) {
    return new MockHBRoomAdapter(config);
}
//# sourceMappingURL=mock.adapter.js.map