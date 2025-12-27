/**
 * Integration Tests - Mock Room Adapter
 */

import { MockHBRoomAdapter } from '../../src/adapter/mock.adapter';
import { RoomConfig, HBPlayer } from '../../src/adapter/types';

describe('Mock Room Adapter', () => {
  let adapter: MockHBRoomAdapter;

  const mockConfig: RoomConfig = {
    roomName: 'Test Room',
    maxPlayers: 16,
    noPlayer: true,
  };

  beforeEach(() => {
    adapter = new MockHBRoomAdapter(mockConfig);
  });

  afterEach(() => {
    adapter.close();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await adapter.initialize();
      expect(adapter.isInitialized()).toBe(true);
    });

    it('should provide room link after initialization', async () => {
      await adapter.initialize();
      expect(adapter.getRoomLink()).toBeTruthy();
      expect(adapter.getRoomLink()).toContain('haxball.com');
    });

    it('should call onRoomLink handler', async () => {
      let receivedLink: string | null = null;
      adapter.setEventHandlers({
        onRoomLink: (link) => {
          receivedLink = link;
        },
      });

      await adapter.initialize();

      // Wait for async callback
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(receivedLink).toBeTruthy();
    });
  });

  describe('Player Simulation', () => {
    beforeEach(async () => {
      await adapter.initialize();
    });

    it('should simulate player join', () => {
      let joinedPlayer: HBPlayer | null = null;
      adapter.setEventHandlers({
        onPlayerJoin: (player) => {
          joinedPlayer = player;
        },
      });

      const player = adapter.simulatePlayerJoin('TestPlayer');

      expect(player.name).toBe('TestPlayer');
      expect(player.id).toBeGreaterThan(0);
      expect(joinedPlayer).toEqual(player);
    });

    it('should add player to player list', () => {
      adapter.simulatePlayerJoin('Player1');
      adapter.simulatePlayerJoin('Player2');

      const players = adapter.getPlayerList();
      expect(players).toHaveLength(2);
    });

    it('should simulate player leave', () => {
      let leftPlayer: HBPlayer | null = null;
      adapter.setEventHandlers({
        onPlayerLeave: (player) => {
          leftPlayer = player;
        },
      });

      const player = adapter.simulatePlayerJoin('TestPlayer');
      adapter.simulatePlayerLeave(player.id);

      expect(leftPlayer).toEqual(player);
      expect(adapter.getPlayerList()).toHaveLength(0);
    });

    it('should simulate player chat', () => {
      let receivedMessage: { player: HBPlayer; message: string } | null = null;
      adapter.setEventHandlers({
        onPlayerChat: (player, message) => {
          receivedMessage = { player, message };
          return true;
        },
      });

      const player = adapter.simulatePlayerJoin('TestPlayer');
      adapter.simulatePlayerChat(player.id, 'Hello world');

      expect(receivedMessage!.message).toBe('Hello world');
      expect(receivedMessage!.player.id).toBe(player.id);
    });

    it('should respect chat handler return value', () => {
      adapter.setEventHandlers({
        onPlayerChat: () => false, // Block message
      });

      const player = adapter.simulatePlayerJoin('TestPlayer');
      const result = adapter.simulatePlayerChat(player.id, 'Test');

      expect(result).toBe(false);
    });
  });

  describe('Message Recording', () => {
    beforeEach(async () => {
      await adapter.initialize();
    });

    it('should record public messages', () => {
      adapter.sendAnnouncement('Hello everyone');

      const messages = adapter.getPublicMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0].message).toBe('Hello everyone');
    });

    it('should record private messages', () => {
      adapter.sendAnnouncement('Secret message', 5);

      const privateMessages = adapter.getPrivateMessages(5);
      expect(privateMessages).toHaveLength(1);
      expect(privateMessages[0].targetId).toBe(5);
    });

    it('should record chat messages', () => {
      adapter.sendChat('Chat message');

      const messages = adapter.getRecordedMessages();
      expect(messages.some((m) => m.type === 'chat')).toBe(true);
    });

    it('should clear messages on demand', () => {
      adapter.sendAnnouncement('Message 1');
      adapter.sendAnnouncement('Message 2');
      expect(adapter.getRecordedMessages()).toHaveLength(2);

      adapter.clearMessages();
      expect(adapter.getRecordedMessages()).toHaveLength(0);
    });
  });

  describe('Player Management', () => {
    beforeEach(async () => {
      await adapter.initialize();
    });

    it('should get player by ID', () => {
      const player = adapter.simulatePlayerJoin('TestPlayer');
      const found = adapter.getPlayer(player.id);

      expect(found).toEqual(player);
    });

    it('should return null for non-existent player', () => {
      const found = adapter.getPlayer(999);
      expect(found).toBeNull();
    });

    it('should set player admin status', () => {
      const player = adapter.simulatePlayerJoin('TestPlayer');
      expect(player.admin).toBe(false);

      adapter.setPlayerAdmin(player.id, true);
      const updated = adapter.getPlayer(player.id);

      expect(updated?.admin).toBe(true);
    });

    it('should set player team', () => {
      const player = adapter.simulatePlayerJoin('TestPlayer');
      expect(player.team).toBe(0);

      adapter.setPlayerTeam(player.id, 1);
      const updated = adapter.getPlayer(player.id);

      expect(updated?.team).toBe(1);
    });

    it('should kick player', () => {
      let leftPlayer: HBPlayer | null = null;
      adapter.setEventHandlers({
        onPlayerLeave: (player) => {
          leftPlayer = player;
        },
      });

      const player = adapter.simulatePlayerJoin('TestPlayer');
      adapter.kickPlayer(player.id, 'Test kick');

      expect(leftPlayer!.id).toBe(player.id);
      expect(adapter.getPlayerList()).toHaveLength(0);
    });
  });

  describe('Reset Functionality', () => {
    beforeEach(async () => {
      await adapter.initialize();
    });

    it('should reset all state', () => {
      adapter.simulatePlayerJoin('Player1');
      adapter.simulatePlayerJoin('Player2');
      adapter.sendAnnouncement('Test message');

      adapter.reset();

      expect(adapter.getPlayerList()).toHaveLength(0);
      expect(adapter.getRecordedMessages()).toHaveLength(0);
    });
  });
});
