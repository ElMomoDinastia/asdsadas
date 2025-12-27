/**
 * Unit Tests for Game State Machine
 */

import {
  transition,
  transitionToClues,
  canPlayerAct,
  getPhaseDescription,
} from '../../src/game/state-machine';
import {
  GameState,
  GamePhase,
  GamePlayer,
  createInitialState,
} from '../../src/game/types';

describe('State Machine', () => {
  let initialState: GameState;

  beforeEach(() => {
    initialState = createInitialState();
  });

  describe('Player Management', () => {
    it('should add player on PLAYER_JOIN', () => {
      const player: GamePlayer = {
        id: 1,
        name: 'TestPlayer',
        auth: 'auth123',
        isAdmin: false,
        joinedAt: Date.now(),
      };

      const result = transition(initialState, { type: 'PLAYER_JOIN', player });

      expect(result.state.players.size).toBe(1);
      expect(result.state.players.get(1)).toEqual(player);
      expect(result.sideEffects).toHaveLength(1);
      expect(result.sideEffects[0].type).toBe('ANNOUNCE_PUBLIC');
    });

    it('should remove player on PLAYER_LEAVE', () => {
      const player: GamePlayer = {
        id: 1,
        name: 'TestPlayer',
        auth: 'auth123',
        isAdmin: false,
        joinedAt: Date.now(),
      };

      // Add player first
      let state = transition(initialState, { type: 'PLAYER_JOIN', player }).state;
      // Then remove
      const result = transition(state, { type: 'PLAYER_LEAVE', playerId: 1 });

      expect(result.state.players.size).toBe(0);
    });
  });

  describe('Queue Management', () => {
    it('should add player to queue on JOIN_QUEUE', () => {
      const player: GamePlayer = {
        id: 1,
        name: 'TestPlayer',
        auth: 'auth123',
        isAdmin: false,
        joinedAt: Date.now(),
      };

      let state = transition(initialState, { type: 'PLAYER_JOIN', player }).state;
      const result = transition(state, { type: 'JOIN_QUEUE', playerId: 1 });

      expect(result.state.queue).toContain(1);
      expect(result.sideEffects.some((e) => e.type === 'ANNOUNCE_PUBLIC')).toBe(true);
    });

    it('should not allow duplicate queue entries', () => {
      const player: GamePlayer = {
        id: 1,
        name: 'TestPlayer',
        auth: 'auth123',
        isAdmin: false,
        joinedAt: Date.now(),
      };

      let state = transition(initialState, { type: 'PLAYER_JOIN', player }).state;
      state = transition(state, { type: 'JOIN_QUEUE', playerId: 1 }).state;
      const result = transition(state, { type: 'JOIN_QUEUE', playerId: 1 });

      expect(result.state.queue.filter((id) => id === 1)).toHaveLength(1);
    });

    it('should remove player from queue on LEAVE_QUEUE', () => {
      const player: GamePlayer = {
        id: 1,
        name: 'TestPlayer',
        auth: 'auth123',
        isAdmin: false,
        joinedAt: Date.now(),
      };

      let state = transition(initialState, { type: 'PLAYER_JOIN', player }).state;
      state = transition(state, { type: 'JOIN_QUEUE', playerId: 1 }).state;
      const result = transition(state, { type: 'LEAVE_QUEUE', playerId: 1 });

      expect(result.state.queue).not.toContain(1);
    });
  });

  describe('Game Start', () => {
    function setupPlayersInQueue(count: number): GameState {
      let state = initialState;
      for (let i = 1; i <= count; i++) {
        const player: GamePlayer = {
          id: i,
          name: `Player${i}`,
          auth: `auth${i}`,
          isAdmin: i === 1,
          joinedAt: Date.now(),
        };
        state = transition(state, { type: 'PLAYER_JOIN', player }).state;
        state = transition(state, { type: 'JOIN_QUEUE', playerId: i }).state;
      }
      return state;
    }

    it('should not start game with fewer than 5 players', () => {
      const state = setupPlayersInQueue(3);
      const result = transition(state, {
        type: 'START_GAME',
        footballers: ['Messi', 'Ronaldo'],
      });

      expect(result.state.phase).toBe(GamePhase.WAITING);
      expect(result.sideEffects.some((e) => 
        e.type === 'ANNOUNCE_PUBLIC' && 
        (e as { message: string }).message.includes('necesitan')
      )).toBe(true);
    });

    it('should start game with 5+ players', () => {
      const state = setupPlayersInQueue(5);
      const result = transition(state, {
        type: 'START_GAME',
        footballers: ['Messi', 'Ronaldo', 'Maradona'],
      });

      expect(result.state.phase).toBe(GamePhase.ASSIGN);
      expect(result.state.currentRound).not.toBeNull();
      expect(result.state.currentRound?.footballer).toBeDefined();
      expect(result.state.currentRound?.impostorId).toBeDefined();
      expect(result.state.queue).toHaveLength(0);
    });

    it('should assign exactly 1 impostor and 4 normal players', () => {
      const state = setupPlayersInQueue(5);
      const result = transition(state, {
        type: 'START_GAME',
        footballers: ['Messi'],
      });

      const round = result.state.currentRound;
      expect(round).not.toBeNull();
      expect(round?.normalPlayerIds).toHaveLength(4);
      expect(round?.normalPlayerIds).not.toContain(round?.impostorId);
    });

    it('should send private messages with roles', () => {
      const state = setupPlayersInQueue(5);
      const result = transition(state, {
        type: 'START_GAME',
        footballers: ['Messi'],
      });

      const privateMessages = result.sideEffects.filter((e) => e.type === 'ANNOUNCE_PRIVATE');
      expect(privateMessages).toHaveLength(5);

      // One should be impostor message
      const impostorMessage = privateMessages.find((e) =>
        (e as { message: string }).message.includes('IMPOSTOR')
      );
      expect(impostorMessage).toBeDefined();
    });
  });

  describe('Clue Phase', () => {
    function setupCluePhase(): GameState {
      let state = initialState;
      for (let i = 1; i <= 5; i++) {
        const player: GamePlayer = {
          id: i,
          name: `Player${i}`,
          auth: `auth${i}`,
          isAdmin: i === 1,
          joinedAt: Date.now(),
        };
        state = transition(state, { type: 'PLAYER_JOIN', player }).state;
        state = transition(state, { type: 'JOIN_QUEUE', playerId: i }).state;
      }
      state = transition(state, { type: 'START_GAME', footballers: ['Messi'] }).state;
      state = transitionToClues(state).state;
      return state;
    }

    it('should transition to CLUES phase', () => {
      let state = initialState;
      for (let i = 1; i <= 5; i++) {
        const player: GamePlayer = {
          id: i,
          name: `Player${i}`,
          auth: `auth${i}`,
          isAdmin: i === 1,
          joinedAt: Date.now(),
        };
        state = transition(state, { type: 'PLAYER_JOIN', player }).state;
        state = transition(state, { type: 'JOIN_QUEUE', playerId: i }).state;
      }
      state = transition(state, { type: 'START_GAME', footballers: ['Messi'] }).state;
      const result = transitionToClues(state);

      expect(result.state.phase).toBe(GamePhase.CLUES);
    });

    it('should accept clue from current player', () => {
      const state = setupCluePhase();
      const currentPlayerId = state.currentRound!.clueOrder[0];

      const result = transition(state, {
        type: 'SUBMIT_CLUE',
        playerId: currentPlayerId,
        clue: 'argentina',
      });

      expect(result.state.currentRound?.clues.get(currentPlayerId)).toBe('argentina');
    });

    it('should reject clue from wrong player', () => {
      const state = setupCluePhase();
      const _currentPlayerId = state.currentRound!.clueOrder[0];
      const wrongPlayerId = state.currentRound!.clueOrder[1];

      const result = transition(state, {
        type: 'SUBMIT_CLUE',
        playerId: wrongPlayerId,
        clue: 'test',
      });

      expect(result.state.currentRound?.clues.has(wrongPlayerId)).toBe(false);
      expect(result.sideEffects.some((e) => e.type === 'ANNOUNCE_PRIVATE')).toBe(true);
    });
  });

  describe('Voting Phase', () => {
    it('should record votes correctly', () => {
      // Setup a game in voting phase
      let state = initialState;
      for (let i = 1; i <= 5; i++) {
        const player: GamePlayer = {
          id: i,
          name: `Player${i}`,
          auth: `auth${i}`,
          isAdmin: i === 1,
          joinedAt: Date.now(),
        };
        state = transition(state, { type: 'PLAYER_JOIN', player }).state;
        state = transition(state, { type: 'JOIN_QUEUE', playerId: i }).state;
      }
      state = transition(state, { type: 'START_GAME', footballers: ['Messi'] }).state;
      state = transitionToClues(state).state;

      // Submit all clues
      for (const playerId of state.currentRound!.clueOrder) {
        state = transition(state, {
          type: 'SUBMIT_CLUE',
          playerId,
          clue: 'clue',
        }).state;
      }

      // Now in DISCUSSION, end it
      state = transition(state, { type: 'END_DISCUSSION' }).state;

      expect(state.phase).toBe(GamePhase.VOTING);

      // Submit a vote
      const voterId = state.currentRound!.normalPlayerIds[0];
      const votedId = state.currentRound!.impostorId;

      const result = transition(state, {
        type: 'SUBMIT_VOTE',
        playerId: voterId,
        votedId,
      });

      expect(result.state.currentRound?.votes.get(voterId)).toBe(votedId);
    });
  });

  describe('Helper Functions', () => {
    it('canPlayerAct should return correct values', () => {
      let state = initialState;
      for (let i = 1; i <= 5; i++) {
        const player: GamePlayer = {
          id: i,
          name: `Player${i}`,
          auth: `auth${i}`,
          isAdmin: i === 1,
          joinedAt: Date.now(),
        };
        state = transition(state, { type: 'PLAYER_JOIN', player }).state;
        state = transition(state, { type: 'JOIN_QUEUE', playerId: i }).state;
      }
      state = transition(state, { type: 'START_GAME', footballers: ['Messi'] }).state;
      state = transitionToClues(state).state;

      const currentPlayerId = state.currentRound!.clueOrder[0];
      const otherPlayerId = state.currentRound!.clueOrder[1];

      expect(canPlayerAct(state, currentPlayerId, 'clue')).toBe(true);
      expect(canPlayerAct(state, otherPlayerId, 'clue')).toBe(false);
    });

    it('getPhaseDescription should return descriptions for all phases', () => {
      const phases = Object.values(GamePhase);
      for (const phase of phases) {
        expect(getPhaseDescription(phase)).toBeTruthy();
      }
    });
  });
});
