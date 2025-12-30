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
import mongoose from 'mongoose'; // <--- AGREGADO


// --- DEFINICIÓN DEL MODELO DE MONGO ---
const PlayerLog = mongoose.model('PlayerLog', new mongoose.Schema({
    name: String,
    auth: String,
    conn: String,
    room: String,
    timestamp: { type: Date, default: Date.now }
}));

const SEAT_POSITIONS = [
  { x: 0, y: -130 },     // Top (Seat 1)
  { x: 124, y: -40 },    // Top-right (Seat 2)
  { x: 76, y: 105 },     // Bottom-right (Seat 3)
  { x: -76, y: 105 },    // Bottom-left (Seat 4)
  { x: -124, y: -40 },   // Top-left (Seat 5)
];

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

  // --- MODIFICADO: Ahora es ASYNC para guardar en MongoDB ---
  private async handlePlayerJoin(player: HBPlayer): Promise<void> {
    for (const existing of this.state.players.values()) {
      if (existing.name.toLowerCase() === player.name.toLowerCase()) {
        this.adapter.sendAnnouncement(`❌ El nombre "${player.name}" ya está en uso`, player.id, { color: 0xff0000 });
        this.adapter.kickPlayer(player.id, 'Nombre duplicado - elige otro nombre');
        return;
      }
    }

    // --- NUEVO: GUARDAR DATOS EN MONGO ---
    try {
        await PlayerLog.create({
            name: player.name,
            auth: player.auth,
            conn: player.conn,
            room: config.roomName // Guarda el nombre de la sala (Ej: #01)
        });
        gameLogger.info({ player: player.name }, 'Player data saved to MongoDB');
    } catch (error) {
        gameLogger.error({ error }, 'Failed to save player data to MongoDB');
    }
    // -------------------------------------

    const gamePlayer: GamePlayer = {
      id: player.id,
      name: player.name,
      auth: player.auth,
      isAdmin: player.admin,
      joinedAt: Date.now()
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
  const isAdmin = player.admin;

  // 1. GESTIÓN DE ESPECTADORES Y ELIMINADOS (FANTASMAS)
  const activePhases = [GamePhase.CLUES, GamePhase.DISCUSSION, GamePhase.VOTING, GamePhase.REVEAL];
  
  if (activePhases.includes(this.state.phase) && this.state.currentRound) {
    if (!this.isPlayerInRound(player.id) && !isAdmin) {
      if (command && command.type === CommandType.JOIN) {
        if (this.state.queue.includes(player.id)) {
          this.adapter.sendAnnouncement(`⏳ Ya estás en cola para la próxima ronda.`, player.id, { color: 0x00bfff });
          return false;
        }
        this.state.queue = [...this.state.queue, player.id];
        this.adapter.sendAnnouncement(`✅ ${player.name} se anotó para la próxima partida`, null, { color: 0x00ff00 });
        return false;
      }

      this.adapter.sendAnnouncement('👻 Los muertos no hablan... (Solo puedes mirar hasta que termine)', player.id, { color: 0xaaaaaa });
      return false;
    }
  }

  // 2. FASE DE PISTAS
  if (this.state.phase === GamePhase.CLUES && this.state.currentRound) {
    const currentGiverId = this.state.currentRound.clueOrder[this.state.currentRound.currentClueIndex];
    if (player.id !== currentGiverId && !isAdmin) {
      this.adapter.sendAnnouncement('⏳ Espera tu turno para dar la pista...', player.id, { color: 0xffaa00 });
      return false;
    }
    if (player.id !== currentGiverId && isAdmin) {
      this.adapter.sendAnnouncement(`👑 ${player.name}: ${message}`, null, { color: 0xffd700 });
      return false;
    }
    const clueWord = message.trim().split(/\s+/)[0];
    if (clueWord) {
      const secretFootballer = this.state.currentRound?.footballer;
      if (secretFootballer && this.containsSpoiler(clueWord, secretFootballer)) {
        this.adapter.sendAnnouncement('❌ ¡No puedes decir el nombre del futbolista!', player.id, { color: 0xff6b6b });
        return false;
      }
      const result = transition(this.state, { type: 'SUBMIT_CLUE', playerId: player.id, clue: clueWord });
      this.applyTransition(result);
      return false;
    }
  }

  // 3. MENSAJES REGULARES
  if (!command || command.type === CommandType.REGULAR_MESSAGE) {
    this.adapter.sendAnnouncement(`${player.name}: ${message}`, null, { color: 0xffffff });
    return false;
  }

  // 4. PROCESAMIENTO DE COMANDOS
  gameLogger.debug({ playerId: player.id, command: command.type }, 'Command received');
  if (command.type === CommandType.HELP) {
    this.adapter.sendAnnouncement(generateHelpText(this.state.phase, isAdmin), player.id, { color: 0x00bfff });
    return false;
  }
  if (command.type === CommandType.STATUS) {
    this.adapter.sendAnnouncement(generateStatusText(this.state), player.id, { color: 0x00bfff });
    return false;
  }
  if (command.type === CommandType.CLAIM_ADMIN) {
    this.adapter.setPlayerAdmin(player.id, true);
    this.adapter.sendAnnouncement('👑 Ahora eres administrador', player.id, { color: 0xffd700 });
    return false;
  }

  // 5. VALIDACIÓN DE COMANDOS DE JUEGO
  const secretFootballer = this.state.currentRound?.footballer;
  const validation = validateCommand(command, player, this.state, secretFootballer);
  if (!validation.valid) {
    this.adapter.sendAnnouncement(`❌ ${validation.error}`, player.id, { color: 0xff6b6b });
    return false;
  }
  if (validation.action) {
    if (validation.action.type === 'START_GAME') {
      validation.action = { type: 'START_GAME', footballers: this.footballers };
    }
    const result = transition(this.state, validation.action);
    this.applyTransition(result);
  }
  return false; 
}

  private applyTransition(result: TransitionResult): void {
    this.state = result.state;
    this.executeSideEffects(result.sideEffects);
    if (this.state.phase === GamePhase.ASSIGN) {
      this.setupGameField();
      this.assignDelayTimer = setTimeout(() => {
        const cluesResult = transitionToClues(this.state);
        this.applyTransition(cluesResult);
      }, 3000);
    }
    if (this.state.phase === GamePhase.REVEAL) {
      setTimeout(() => {
        const revealResult = transition(this.state, { type: 'END_REVEAL' });
        this.applyTransition(revealResult);
      }, 3000);
    }
    if (this.state.phase === GamePhase.RESULTS) {
      setTimeout(() => {
        const resetResult = transition(this.state, { type: 'RESET_GAME' });
        this.applyTransition(resetResult);
      }, 8000);
    }
  }

  private containsSpoiler(clue: string, footballer: string): boolean {
    const clueLower = clue.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const footballerLower = footballer.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const nameParts = footballerLower.split(/\s+/);
    for (const part of nameParts) {
      if (part.length > 2 && clueLower.includes(part)) {
        return true;
      }
    }
    return false;
  }

  private async setupGameField(): Promise<void> {
    if (!this.state.currentRound) return;
    try {
      const roundPlayerIds = [
        ...this.state.currentRound.normalPlayerIds,
        this.state.currentRound.impostorId,
      ];
      await this.adapter.setTeamsLock(true);
      await this.adapter.stopGame();
      await new Promise(resolve => setTimeout(resolve, 100));
      const allPlayers = await this.adapter.getPlayerList();
      for (const player of allPlayers) {
        if (player.id !== 0) { await this.adapter.setPlayerTeam(player.id, 0); }
      }
      await new Promise(resolve => setTimeout(resolve, 100));
      for (const playerId of roundPlayerIds) {
        await this.adapter.setPlayerTeam(playerId, 1); 
        await new Promise(resolve => setTimeout(resolve, 50)); 
      }
      await new Promise(resolve => setTimeout(resolve, 300));
      await this.adapter.startGame();
      await new Promise(resolve => setTimeout(resolve, 500));
      for (let i = 0; i < roundPlayerIds.length && i < SEAT_POSITIONS.length; i++) {
        const playerId = roundPlayerIds[i];
        const seat = SEAT_POSITIONS[i];
        await this.adapter.setPlayerDiscProperties(playerId, {
          x: seat.x, y: seat.y, xspeed: 0, yspeed: 0,
        });
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      gameLogger.error({ error }, 'Failed to setup game field');
    }
  }

  private isPlayerInRound(playerId: number): boolean {
    if (!this.state.currentRound) return false;
    return this.state.currentRound.clueOrder.includes(playerId);
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
          setTimeout(() => {
            const startResult = transition(this.state, {
              type: 'START_GAME',
              footballers: this.footballers,
            });
            this.applyTransition(startResult);
          }, 2000); 
          break;
      }
    }
  }

  private setPhaseTimer(durationSeconds: number): void {
    this.clearPhaseTimer();
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
    let result: TransitionResult;
    switch (this.state.phase) {
      case GamePhase.CLUES: result = transition(this.state, { type: 'CLUE_TIMEOUT' }); break;
      case GamePhase.DISCUSSION: result = transition(this.state, { type: 'END_DISCUSSION' }); break;
      case GamePhase.VOTING: result = transition(this.state, { type: 'END_VOTING' }); break;
      case GamePhase.REVEAL: result = transition(this.state, { type: 'END_REVEAL' }); break;
      default: return;
    }
    this.applyTransition(result);
  }

  private logRound(result: RoundResult): void {
    this.roundLogs.push(result);
    gameLogger.info({ roundResult: result }, 'Round completed');
  }

  getState(): GameState { return this.state; }
  getRoomLink(): string | null { return this.adapter.getRoomLink(); }
  isRoomInitialized(): boolean { return this.adapter.isInitialized(); }
  getPlayerCount(): number { return this.state.players.size; }
  getQueueCount(): number { return this.state.queue.length; }
  getRoundsPlayed(): number { return this.state.roundHistory.length; }
  getCurrentPhase(): string { return this.state.phase; }
  setFootballers(footballers: string[]): void { this.footballers = footballers; }

  private announceTimer: NodeJS.Timeout | null = null;

async start(): Promise<void> {
    await this.adapter.initialize();
    gameLogger.info('Game controller started');

  this.announceTimer = setInterval(() => {
  this.adapter.sendAnnouncement(
    "📢 Sala creada por: 【 𝙏𝙚𝙡𝙚𝙚𝙨𝙚 】", 
    null, 
    { color: 0x00FF00 } // Sacamos el fontWeight porque no existe en Haxball
  );
}, 5 * 60 * 1000);
    // -------------------------------------
  }

  stop(): void {
    this.clearPhaseTimer();
    this.adapter.close();
    gameLogger.info('Game controller stopped');
  }
}