/**
 * Integration Tests - Full Game Flow with Mock Adapter
 */

import { MockHBRoomAdapter } from '../../src/adapter/mock.adapter';
import { GameController } from '../../src/game/controller';
import { RoomConfig } from '../../src/adapter/types';

describe('Game Flow Integration', () => {
  let adapter: MockHBRoomAdapter;
  let controller: GameController;

  const mockConfig: RoomConfig = {
    roomName: 'Test Room',
    maxPlayers: 16,
    noPlayer: true,
  };

  beforeEach(async () => {
    adapter = new MockHBRoomAdapter(mockConfig);
    controller = new GameController(adapter, ['Lionel Messi', 'Cristiano Ronaldo']);
    await adapter.initialize();
  });

  afterEach(() => {
    controller.stop();
    adapter.reset();
  });

  describe('Player Join Flow', () => {
    it('should welcome players when they join', () => {
      adapter.simulatePlayerJoin('Player1');

      const messages = adapter.getPublicMessages();
      expect(messages.some((m) => m.message.includes('Bienvenido'))).toBe(true);
    });

    it('should allow players to join queue', () => {
      const player = adapter.simulatePlayerJoin('Player1');
      adapter.simulatePlayerChat(player.id, '!join');

      expect(controller.getQueueCount()).toBe(1);
    });

    it('should show queue status when player joins', () => {
      const player = adapter.simulatePlayerJoin('Player1');
      adapter.clearMessages();
      adapter.simulatePlayerChat(player.id, '!join');

      const messages = adapter.getPublicMessages();
      expect(messages.some((m) => m.message.includes('cola'))).toBe(true);
    });
  });

  describe('Full Game Round', () => {
    it('should run a complete game round', async () => {
      const players = [];
      for (let i = 1; i <= 5; i++) {
        const player = adapter.simulatePlayerJoin(`Player${i}`, i === 1);
        players.push(player);
        adapter.simulatePlayerChat(player.id, '!join');
      }

      expect(controller.getQueueCount()).toBe(5);
      adapter.clearMessages();

      adapter.simulatePlayerChat(players[0].id, '!start');

      expect(controller.getCurrentPhase()).toBe('ASSIGN');

      const privateMessages = adapter.getRecordedMessages().filter((m) => m.targetId !== null && m.targetId !== undefined);
      expect(privateMessages.length).toBeGreaterThan(0);

      const impostorMessages = privateMessages.filter((m) => m.message.includes('IMPOSTOR'));
      expect(impostorMessages).toHaveLength(1);
    });

    it('should not start game with insufficient players', () => {
      const player = adapter.simulatePlayerJoin('Player1', true);
      adapter.simulatePlayerChat(player.id, '!join');
      adapter.clearMessages();

      adapter.simulatePlayerChat(player.id, '!start');

      // Error messages go to private messages
      const privateMessages = adapter.getPrivateMessages(player.id);
      expect(privateMessages.some((m) => m.message.includes('necesitan') || m.message.includes('menos'))).toBe(true);
      expect(controller.getCurrentPhase()).toBe('WAITING');
    });
  });

  describe('Command Validation', () => {
    it('should reject invalid commands', () => {
      const player = adapter.simulatePlayerJoin('Player1');
      adapter.clearMessages();

      adapter.simulatePlayerChat(player.id, '!invalidcmd');

      const privateMessages = adapter.getPrivateMessages(player.id);
      expect(privateMessages.some((m) => m.message.includes('desconocido'))).toBe(true);
    });

    it('should show help on !help command', () => {
      const player = adapter.simulatePlayerJoin('Player1');
      adapter.clearMessages();

      adapter.simulatePlayerChat(player.id, '!help');

      const privateMessages = adapter.getPrivateMessages(player.id);
      expect(privateMessages.some((m) => m.message.includes('COMANDOS'))).toBe(true);
    });

    it('should show status on !status command', () => {
      const player = adapter.simulatePlayerJoin('Player1');
      adapter.clearMessages();

      adapter.simulatePlayerChat(player.id, '!status');

      const privateMessages = adapter.getPrivateMessages(player.id);
      expect(privateMessages.some((m) => m.message.includes('Estado'))).toBe(true);
    });
  });

  describe('Player Disconnect Handling', () => {
    it('should remove player from queue on disconnect', () => {
      const player = adapter.simulatePlayerJoin('Player1');
      adapter.simulatePlayerChat(player.id, '!join');
      expect(controller.getQueueCount()).toBe(1);

      adapter.simulatePlayerLeave(player.id);
      expect(controller.getQueueCount()).toBe(0);
    });

    it('should announce player leave', () => {
      const player = adapter.simulatePlayerJoin('Player1');
      adapter.clearMessages();

      adapter.simulatePlayerLeave(player.id);

      const messages = adapter.getPublicMessages();
      expect(messages.some((m) => m.message.includes('salido'))).toBe(true);
    });
  });
});
