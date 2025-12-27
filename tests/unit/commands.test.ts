/**
 * Unit Tests for Command Handler
 */

import {
  parseCommand,
  validateCommand,
  CommandType,
  generateHelpText,
  generateStatusText,
} from '../../src/commands/handler';
import { GamePhase, createInitialState } from '../../src/game/types';
import { HBPlayer } from '../../src/adapter/types';

describe('Command Handler', () => {
  describe('parseCommand', () => {
    it('should parse !join command', () => {
      const result = parseCommand('!join');
      expect(result).not.toBeNull();
      expect(result?.type).toBe(CommandType.JOIN);
      expect(result?.args).toHaveLength(0);
    });

    it('should parse !clue with argument', () => {
      const result = parseCommand('!clue argentina');
      expect(result).not.toBeNull();
      expect(result?.type).toBe(CommandType.CLUE);
      expect(result?.args).toEqual(['argentina']);
    });

    it('should parse !vote with ID', () => {
      const result = parseCommand('!vote 5');
      expect(result).not.toBeNull();
      expect(result?.type).toBe(CommandType.VOTE);
      expect(result?.args).toEqual(['5']);
    });

    it('should return null for non-command messages', () => {
      expect(parseCommand('hello world')).toBeNull();
      expect(parseCommand('just chatting')).toBeNull();
    });

    it('should handle case insensitivity', () => {
      const result = parseCommand('!JOIN');
      expect(result?.type).toBe(CommandType.JOIN);
    });

    it('should parse unknown commands', () => {
      const result = parseCommand('!unknowncommand');
      expect(result?.type).toBe(CommandType.UNKNOWN);
    });
  });

  describe('validateCommand', () => {
    const mockPlayer: HBPlayer = {
      id: 1,
      name: 'TestPlayer',
      team: 0,
      admin: false,
      position: null,
      auth: 'auth123',
      conn: 'conn123',
    };

    const mockAdmin: HBPlayer = {
      ...mockPlayer,
      admin: true,
    };

    it('should validate !join in WAITING phase', () => {
      const state = createInitialState();
      state.players.set(1, {
        id: 1,
        name: 'TestPlayer',
        auth: 'auth123',
        isAdmin: false,
        joinedAt: Date.now(),
      });

      const command = parseCommand('!join')!;
      const result = validateCommand(command, mockPlayer, state);

      expect(result.valid).toBe(true);
      expect(result.action?.type).toBe('JOIN_QUEUE');
    });

    it('should reject !join during active round', () => {
      const state = createInitialState();
      state.phase = GamePhase.CLUES;

      const command = parseCommand('!join')!;
      const result = validateCommand(command, mockPlayer, state);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('ronda en curso');
    });

    it('should reject !start from non-admin', () => {
      const state = createInitialState();
      state.queue = [1, 2, 3, 4, 5];

      const command = parseCommand('!start')!;
      const result = validateCommand(command, mockPlayer, state);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('admin');
    });

    it('should accept !start from admin with enough players', () => {
      const state = createInitialState();
      state.queue = [1, 2, 3, 4, 5];

      const command = parseCommand('!start')!;
      const result = validateCommand(command, mockAdmin, state);

      expect(result.valid).toBe(true);
      expect(result.action?.type).toBe('START_GAME');
    });

    it('should reject !clue with spoiler', () => {
      const state = createInitialState();
      state.phase = GamePhase.CLUES;
      state.currentRound = {
        id: 'test',
        footballer: 'Lionel Messi',
        impostorId: 2,
        normalPlayerIds: [1, 3, 4, 5],
        clues: new Map(),
        votes: new Map(),
        clueOrder: [1, 2, 3, 4, 5],
        currentClueIndex: 0,
        phaseDeadline: null,
        startedAt: Date.now(),
      };

      const command = parseCommand('!clue messi')!;
      const result = validateCommand(command, mockPlayer, state, 'Lionel Messi');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('nombre del futbolista');
    });
  });

  describe('generateHelpText', () => {
    it('should include base commands', () => {
      const help = generateHelpText(GamePhase.WAITING, false);
      expect(help).toContain('!join');
      expect(help).toContain('!leave');
      expect(help).toContain('!help');
    });

    it('should include phase-specific commands', () => {
      const waitingHelp = generateHelpText(GamePhase.WAITING, true);
      expect(waitingHelp).toContain('!start');

      const cluesHelp = generateHelpText(GamePhase.CLUES, false);
      expect(cluesHelp).toContain('!clue');

      const votingHelp = generateHelpText(GamePhase.VOTING, false);
      expect(votingHelp).toContain('!vote');
    });

    it('should include admin commands for admins', () => {
      const adminHelp = generateHelpText(GamePhase.WAITING, true);
      expect(adminHelp).toContain('!forcereveal');
      expect(adminHelp).toContain('!skipphase');
    });

    it('should not include admin commands for non-admins', () => {
      const userHelp = generateHelpText(GamePhase.WAITING, false);
      expect(userHelp).not.toContain('!forcereveal');
    });
  });

  describe('generateStatusText', () => {
    it('should show current phase', () => {
      const state = createInitialState();
      const status = generateStatusText(state);

      expect(status).toContain('Esperando jugadores');
    });

    it('should show queue count in WAITING phase', () => {
      const state = createInitialState();
      state.queue = [1, 2, 3];

      const status = generateStatusText(state);
      expect(status).toContain('3/5');
    });

    it('should show rounds played', () => {
      const state = createInitialState();
      state.roundHistory = [
        {
          impostorWon: true,
          impostorId: 1,
          impostorName: 'Test',
          footballer: 'Messi',
          votedOutId: null,
          votedOutName: null,
          wasCorrectVote: false,
        },
      ];

      const status = generateStatusText(state);
      expect(status).toContain('1');
    });
  });
});
