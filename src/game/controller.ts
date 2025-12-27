/**
 * Game Controller - Orchestrates the game logic and room adapter
 */

import { IHBRoomAdapter, HBPlayer, RoomEventHandlers } from '../adapter/types';
import {
  GameState,
  GamePhase,
  GamePlayer,
  createInitialState,
  SideEffect,
  TransitionResult,
  RoundResult,
} from '../game/types';
import { transition, transitionToClues } from '../game/state-machine';
import {
  parseCommand,
  validateCommand,
  CommandType,
  generateHelpText,
  generateStatusText,
} from '../commands/handler';
import { gameLogger } from '../utils/logger';
import { config } from '../config';
import footballersData from '../data/footballers.json';

/**
 * Seat positions for the 5-player Impostor game (pentagon formation)
 * These match the disc positions in the impostor-stadium.json
 */
const SEAT_POSITIONS = [
  { x: 0, y: -130 },     // Top (Seat 1)
  { x: 124, y: -40 },    // Top-right (Seat 2)
  { x: 76, y: 105 },     // Bottom-right (Seat 3)
  { x: -76, y: 105 },    // Bottom-left (Seat 4)
  { x: -124, y: -40 },   // Top-left (Seat 5)
];

/**
 * Main game controller that connects the state machine with the room adapter
 */
export class GameController {
  private adapter: IHBRoomAdapter;
  private state: GameState;
  private footballers: string[];
  private phaseTimer: NodeJS.Timeout | null = null;
  private assignDelayTimer: NodeJS.Timeout | null = null;
  private roundLogs: RoundResult[] = [];

  constructor(adapter: IHBRoomAdapter, footballers?: string[]) {
    this.adapter = adapter;
    this.state = createInitialState({
      clueTimeSeconds: config.clueTime,
      discussionTimeSeconds: config.discussionTime,
      votingTimeSeconds: config.votingTime,
    });
    this.footballers = footballers ?? footballersData;

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    const handlers: RoomEventHandlers = {
      onPlayerJoin: this.handlePlayerJoin.bind(this),
      onPlayerLeave: this.handlePlayerLeave.bind(this),
      onPlayerChat: this.handlePlayerChat.bind(this),
      onRoomLink: this.handleRoomLink.bind(this),
    };

    this.adapter.setEventHandlers(handlers);
  }

  private handleRoomLink(link: string): void {
    gameLogger.info({ link }, 'Room is ready');
  }

  private handlePlayerJoin(player: HBPlayer): void {
    // Check for duplicate name
    for (const existing of this.state.players.values()) {
      if (existing.name.toLowerCase() === player.name.toLowerCase()) {
        // Kick the new player - name already taken
        this.adapter.sendAnnouncement(`❌ El nombre "${player.name}" ya está en uso`, player.id, { color: 0xff0000 });
        this.adapter.kickPlayer(player.id, 'Nombre duplicado - elige otro nombre');
        return;
      }
    }

    const gamePlayer: GamePlayer = {
      id: player.id,
      name: player.name,
      auth: player.auth,
      isAdmin: player.admin,
      joinedAt: Date.now(),
    };

    const result = transition(this.state, { type: 'PLAYER_JOIN', player: gamePlayer });
    this.applyTransition(result);
  }

  private handlePlayerLeave(player: HBPlayer): void {
    const result = transition(this.state, { type: 'PLAYER_LEAVE', playerId: player.id });
    this.applyTransition(result);
  }

  private handlePlayerChat(player: HBPlayer, message: string): boolean {
    const command = parseCommand(message);

    // Admins can always speak - bypass all restrictions
    const isAdmin = player.admin;

    // During active game, non-participants can only use "jugar" to queue for next round
    // (Admins are exempt from this restriction)
    const activePhases = [GamePhase.CLUES, GamePhase.DISCUSSION, GamePhase.VOTING, GamePhase.REVEAL];
    if (activePhases.includes(this.state.phase) && this.state.currentRound) {
      if (!this.isPlayerInRound(player.id) && !isAdmin) {
        // Not in this round and not admin - only allow JOIN command
        if (command && command.type === CommandType.JOIN) {
          // Check if already in queue
          if (this.state.queue.includes(player.id)) {
            // Already queued - just remind them privately
            this.adapter.sendAnnouncement(`⏳ Ya estás en cola. Cuando termine la ronda actual, empezamos.`, player.id, { color: 0x00bfff });
            return false;
          }
          // Add to queue for next round
          this.state.queue = [...this.state.queue, player.id];
          this.adapter.sendAnnouncement(`✅ ${player.name} está listo para la próxima ronda`, null, { color: 0x00ff00 });
          this.adapter.sendAnnouncement(`⏳ Estás en cola. Cuando termine la ronda actual, empezamos.`, player.id, { color: 0x00bfff });
          return false;
        }
        // Block other messages
        this.adapter.sendAnnouncement('⏳ Hay una partida. Escribe "jugar" para unirte a la siguiente.', player.id, { color: 0xffaa00 });
        return false;
      }
    }

    // During CLUES phase, only the current player can send messages (others blocked)
    // (Admins can always speak)
    if (this.state.phase === GamePhase.CLUES && this.state.currentRound) {
      const currentGiver = this.state.currentRound.clueOrder[this.state.currentRound.currentClueIndex];
      if (player.id !== currentGiver && !isAdmin) {
        // Not their turn and not admin - block silently
        this.adapter.sendAnnouncement('⏳ Espera tu turno...', player.id, { color: 0xffaa00 });
        return false;
      }
      // If admin is speaking (not their turn), just echo the message
      if (player.id !== currentGiver && isAdmin) {
        this.adapter.sendAnnouncement(`👑 ${player.name}: ${message}`, null, { color: 0xffd700 });
        return false;
      }
      // Current player's message is their clue - process it as CLUE command
      // Extract the first word as the clue
      const clueWord = message.trim().split(/\s+/)[0];
      if (clueWord) {
        const secretFootballer = this.state.currentRound?.footballer;
        // Create and validate a CLUE action directly
        const clueAction = { type: 'SUBMIT_CLUE' as const, playerId: player.id, clue: clueWord };
        
        // Check for spoiler
        if (secretFootballer && this.containsSpoiler(clueWord, secretFootballer)) {
          this.adapter.sendAnnouncement('❌ ¡No digas el nombre!', player.id, { color: 0xff6b6b });
          return false;
        }
        
        const result = transition(this.state, clueAction);
        this.applyTransition(result);
        return false;
      }
    }

    // During DISCUSSION, allow all participants to chat freely
    if (this.state.phase === GamePhase.DISCUSSION && this.isPlayerInRound(player.id)) {
      if (!command || command.type === CommandType.REGULAR_MESSAGE) {
        // Echo their message
        this.adapter.sendAnnouncement(`${player.name}: ${message}`, null, { color: 0xffffff });
        return false;
      }
    }

    // Regular chat (no command or regular message type) - echo it
    if (!command || command.type === CommandType.REGULAR_MESSAGE) {
      this.adapter.sendAnnouncement(`${player.name}: ${message}`, null, { color: 0xffffff });
      return false;
    }

    // Handle command
    gameLogger.debug(
      { playerId: player.id, command: command.type, args: command.args },
      'Command received'
    );

    // Special handling for help and status
    if (command.type === CommandType.HELP) {
      const helpText = generateHelpText(this.state.phase, player.admin);
      this.adapter.sendAnnouncement(helpText, player.id, { color: 0x00bfff });
      return false;
    }

    if (command.type === CommandType.STATUS) {
      const statusText = generateStatusText(this.state);
      this.adapter.sendAnnouncement(statusText, player.id, { color: 0x00bfff });
      return false;
    }

    // Secret admin claim
    if (command.type === CommandType.CLAIM_ADMIN) {
      this.adapter.setPlayerAdmin(player.id, true);
      this.adapter.sendAnnouncement('👑 Eres admin', player.id, { color: 0xffd700 });
      return false;
    }

    // Get secret footballer for spoiler checking
    const secretFootballer = this.state.currentRound?.footballer;

    // Validate and execute command
    const validation = validateCommand(command, player, this.state, secretFootballer);

    if (!validation.valid) {
      this.adapter.sendAnnouncement(`❌ ${validation.error}`, player.id, { color: 0xff6b6b });
      return false;
    }

    if (validation.action) {
      // Special handling for START_GAME - inject footballers
      if (validation.action.type === 'START_GAME') {
        validation.action = { type: 'START_GAME', footballers: this.footballers };
      }

      const result = transition(this.state, validation.action);
      this.applyTransition(result);
    }

    return false; // Don't show command in chat
  }

  private applyTransition(result: TransitionResult): void {
    this.state = result.state;
    this.executeSideEffects(result.sideEffects);

    // Handle phase-specific transitions
    if (this.state.phase === GamePhase.ASSIGN) {
      // Load custom stadium and position players
      this.setupGameField();
      
      // Delay before transitioning to clues phase
      this.assignDelayTimer = setTimeout(() => {
        const cluesResult = transitionToClues(this.state);
        this.applyTransition(cluesResult);
      }, 3000);
    }

    // Auto-reveal impostor after showing voting results
    if (this.state.phase === GamePhase.REVEAL) {
      setTimeout(() => {
        const revealResult = transition(this.state, { type: 'END_REVEAL' });
        this.applyTransition(revealResult);
      }, 3000);
    }

    if (this.state.phase === GamePhase.RESULTS) {
      // Auto-transition back to WAITING after results
      setTimeout(() => {
        const resetResult = transition(this.state, { type: 'RESET_GAME' });
        this.applyTransition(resetResult);
      }, 8000);
    }
  }

  /**
   * Check if a clue contains the secret footballer name (spoiler)
   */
  private containsSpoiler(clue: string, footballer: string): boolean {
    const clueLower = clue.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const footballerLower = footballer.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    // Check if any part of the footballer name is in the clue
    const nameParts = footballerLower.split(/\s+/);
    for (const part of nameParts) {
      if (part.length > 2 && clueLower.includes(part)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Setup the game field: lock teams, move players to red, start game, position players in seats
   */
  private async setupGameField(): Promise<void> {
    if (!this.state.currentRound) return;

    try {
      // Get all players in the current round (5 players)
      const roundPlayerIds = [
        ...this.state.currentRound.normalPlayerIds,
        this.state.currentRound.impostorId,
      ];

      gameLogger.info({ playerCount: roundPlayerIds.length, playerIds: roundPlayerIds }, 'Setting up game field');

      // Step 1: Lock teams so only admin can change
      await this.adapter.setTeamsLock(true);
      gameLogger.info('Teams locked');

      // Step 2: Stop any running game first
      await this.adapter.stopGame();
      await new Promise(resolve => setTimeout(resolve, 100));

      // Step 3: Move ALL players to spectators first (clear the field)
      const allPlayers = await this.adapter.getPlayerList();
      for (const player of allPlayers) {
        if (player.id !== 0) { // Don't try to move host (id 0)
          await this.adapter.setPlayerTeam(player.id, 0); // 0 = Spectators
        }
      }
      await new Promise(resolve => setTimeout(resolve, 100));
      gameLogger.info('All players moved to spectators');

      // Step 4: Move participating players to red team (team 1)
      for (const playerId of roundPlayerIds) {
        await this.adapter.setPlayerTeam(playerId, 1); // 1 = Red team
        await new Promise(resolve => setTimeout(resolve, 50)); // Small delay between team changes
      }
      gameLogger.info('Round players moved to red team');

      // Step 5: Wait a bit for team changes to apply
      await new Promise(resolve => setTimeout(resolve, 300));

      // Step 6: Start the game
      await this.adapter.startGame();
      gameLogger.info('Game started');

      // Step 7: Wait for game to fully start before positioning
      await new Promise(resolve => setTimeout(resolve, 500));

      // Step 8: Position each player in their designated seat
      for (let i = 0; i < roundPlayerIds.length && i < SEAT_POSITIONS.length; i++) {
        const playerId = roundPlayerIds[i];
        const seat = SEAT_POSITIONS[i];
        
        await this.adapter.setPlayerDiscProperties(playerId, {
          x: seat.x,
          y: seat.y,
          xspeed: 0,
          yspeed: 0,
        });
        
        // Small delay between positioning each player
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      gameLogger.info({ playerCount: roundPlayerIds.length }, 'All players positioned in seats');
    } catch (error) {
      gameLogger.error({ error }, 'Failed to setup game field');
    }
  }

  /**
   * Check if a player is part of the current round
   */
  private isPlayerInRound(playerId: number): boolean {
    if (!this.state.currentRound) return false;
    const round = this.state.currentRound;
    return playerId === round.impostorId || round.normalPlayerIds.includes(playerId);
  }

  private executeSideEffects(effects: SideEffect[]): void {
    for (const effect of effects) {
      switch (effect.type) {
        case 'ANNOUNCE_PUBLIC':
          this.adapter.sendAnnouncement(effect.message, null, effect.style);
          break;

        case 'ANNOUNCE_PRIVATE':
          this.adapter.sendAnnouncement(effect.message, effect.playerId, { color: 0xffff00 });
          break;

        case 'SET_PHASE_TIMER':
          this.setPhaseTimer(effect.durationSeconds);
          break;

        case 'CLEAR_TIMER':
          this.clearPhaseTimer();
          break;

        case 'LOG_ROUND':
          this.logRound(effect.result);
          break;

        case 'AUTO_START_GAME':
          // Automatically start the game after a short delay
          setTimeout(() => {
            gameLogger.info('Auto-starting game...');
            const startResult = transition(this.state, {
              type: 'START_GAME',
              footballers: this.footballers,
            });
            this.applyTransition(startResult);
          }, 2000); // 2 second delay before auto-start
          break;
      }
    }
  }

  private setPhaseTimer(durationSeconds: number): void {
    this.clearPhaseTimer();

    gameLogger.debug({ durationSeconds }, 'Setting phase timer');

    this.phaseTimer = setTimeout(() => {
      this.handlePhaseTimeout();
    }, durationSeconds * 1000);
  }

  private clearPhaseTimer(): void {
    if (this.phaseTimer) {
      clearTimeout(this.phaseTimer);
      this.phaseTimer = null;
    }
    if (this.assignDelayTimer) {
      clearTimeout(this.assignDelayTimer);
      this.assignDelayTimer = null;
    }
  }

  private handlePhaseTimeout(): void {
    gameLogger.debug({ phase: this.state.phase }, 'Phase timeout');

    let result: TransitionResult;

    switch (this.state.phase) {
      case GamePhase.CLUES:
        result = transition(this.state, { type: 'CLUE_TIMEOUT' });
        break;
      case GamePhase.DISCUSSION:
        result = transition(this.state, { type: 'END_DISCUSSION' });
        break;
      case GamePhase.VOTING:
        result = transition(this.state, { type: 'END_VOTING' });
        break;
      case GamePhase.REVEAL:
        result = transition(this.state, { type: 'END_REVEAL' });
        break;
      default:
        return;
    }

    this.applyTransition(result);
  }

  private logRound(result: RoundResult): void {
    this.roundLogs.push(result);
    gameLogger.info(
      {
        roundResult: {
          impostorWon: result.impostorWon,
          impostorName: result.impostorName,
          footballer: result.footballer,
          votedOutName: result.votedOutName,
        },
      },
      'Round completed'
    );
  }

  // === Public API ===

  getState(): GameState {
    return this.state;
  }

  getRoomLink(): string | null {
    return this.adapter.getRoomLink();
  }

  isRoomInitialized(): boolean {
    return this.adapter.isInitialized();
  }

  getPlayerCount(): number {
    return this.state.players.size;
  }

  getQueueCount(): number {
    return this.state.queue.length;
  }

  getRoundsPlayed(): number {
    return this.state.roundHistory.length;
  }

  getCurrentPhase(): string {
    return this.state.phase;
  }

  /**
   * Load a custom footballer list
   */
  setFootballers(footballers: string[]): void {
    this.footballers = footballers;
    gameLogger.info({ count: footballers.length }, 'Footballer list updated');
  }

  /**
   * Start the game controller
   */
  async start(): Promise<void> {
    await this.adapter.initialize();
    gameLogger.info('Game controller started');
  }

  /**
   * Stop the game controller
   */
  stop(): void {
    this.clearPhaseTimer();
    this.adapter.close();
    gameLogger.info('Game controller stopped');
  }
}
