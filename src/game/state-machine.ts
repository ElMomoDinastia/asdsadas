/**
 * Pure State Machine - CLEAN & HORIZONTAL MESSAGES
 */

import {
  GameState,
  GameAction,
  GamePhase,
  TransitionResult,
  SideEffect,
  Round,
  RoundResult,
  GamePlayer,
} from './types';

function generateRoundId(): string {
  return `round_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function transition(state: GameState, action: GameAction): TransitionResult {
  switch (action.type) {
    case 'PLAYER_JOIN':
      return handlePlayerJoin(state, action.player);
    case 'PLAYER_LEAVE':
      return handlePlayerLeave(state, action.playerId);
    case 'JOIN_QUEUE':
      return handleJoinQueue(state, action.playerId);
    case 'LEAVE_QUEUE':
      return handleLeaveQueue(state, action.playerId);
    case 'START_GAME':
      return handleStartGame(state, action.footballers);
    case 'SUBMIT_CLUE':
      return handleSubmitClue(state, action.playerId, action.clue);
    case 'CLUE_TIMEOUT':
      return handleClueTimeout(state);
    case 'END_DISCUSSION':
      return handleEndDiscussion(state);
    case 'SUBMIT_VOTE':
      return handleSubmitVote(state, action.playerId, action.votedId);
    case 'END_VOTING':
      return handleEndVoting(state);
    case 'END_REVEAL':
      return handleEndReveal(state);
    case 'FORCE_REVEAL':
      return handleForceReveal(state);
    case 'SKIP_PHASE':
      return handleSkipPhase(state);
    case 'RESET_ROUND':
      return handleResetRound(state);
    case 'RESET_GAME':
      return handleResetGame(state);
    default:
      return { state, sideEffects: [] };
  }
}

function handlePlayerJoin(state: GameState, player: GamePlayer): TransitionResult {
  const newPlayers = new Map(state.players);
  newPlayers.set(player.id, player);

  const needed = state.settings.minPlayers - state.queue.length;

  const sideEffects: SideEffect[] = [
    {
      type: 'ANNOUNCE_PRIVATE',
      playerId: player.id,
      message: `🔴 EL IMPOSTOR | Escribe "jugar" para unirte ${needed > 0 ? `(faltan ${needed})` : ''}`,
    },
  ];

  return { state: { ...state, players: newPlayers }, sideEffects };
}

function handlePlayerLeave(state: GameState, playerId: number): TransitionResult {
  const player = state.players.get(playerId);
  if (!player) return { state, sideEffects: [] };

  const newPlayers = new Map(state.players);
  newPlayers.delete(playerId);
  const newQueue = state.queue.filter((id) => id !== playerId);
  let newState: GameState = { ...state, players: newPlayers, queue: newQueue };
  const sideEffects: SideEffect[] = [];

  if (state.currentRound) {
    const roundPlayerIds = [state.currentRound.impostorId, ...state.currentRound.normalPlayerIds];
    if (roundPlayerIds.includes(playerId)) {
      const remaining = roundPlayerIds.filter((id) => id !== playerId && newPlayers.has(id));
      if (remaining.length < 3) {
        sideEffects.push({
          type: 'ANNOUNCE_PUBLIC',
          message: '⚠️ Ronda cancelada - muy pocos jugadores',
          style: { color: 0xff6b6b, sound: 2 },
        });
        newState = { ...newState, phase: GamePhase.WAITING, currentRound: null };
        sideEffects.push({ type: 'CLEAR_TIMER' });
      }
    }
  }

  return { state: newState, sideEffects };
}

function handleJoinQueue(state: GameState, playerId: number): TransitionResult {
  if (state.phase !== GamePhase.WAITING) {
    return { state, sideEffects: [] };
  }

  const player = state.players.get(playerId);
  if (!player) return { state, sideEffects: [] };

  if (state.queue.includes(playerId)) {
    return { state, sideEffects: [{ type: 'ANNOUNCE_PRIVATE', playerId, message: '✅ Ya estás listo' }] };
  }

  // Only take exactly minPlayers (5)
  if (state.queue.length >= state.settings.minPlayers) {
    return {
      state,
      sideEffects: [{ type: 'ANNOUNCE_PRIVATE', playerId, message: '⏳ Cola llena, espera la siguiente ronda' }],
    };
  }

  const newQueue = [...state.queue, playerId];
  const remaining = state.settings.minPlayers - newQueue.length;

  const sideEffects: SideEffect[] = [];

  if (remaining > 0) {
    sideEffects.push({
      type: 'ANNOUNCE_PUBLIC',
      message: `✅ ${player.name} listo (${newQueue.length}/5) - faltan ${remaining}`,
      style: { color: 0x00ff00 },
    });
  } else {
    sideEffects.push({
      type: 'ANNOUNCE_PUBLIC',
      message: `✅ ${player.name} listo | 🎮 ¡5/5 JUGADORES! Empieza en 3s...`,
      style: { color: 0x00ff00, sound: 1 },
    });
    sideEffects.push({ type: 'AUTO_START_GAME' });
  }

  return { state: { ...state, queue: newQueue }, sideEffects };
}

function handleLeaveQueue(state: GameState, playerId: number): TransitionResult {
  if (!state.queue.includes(playerId)) return { state, sideEffects: [] };
  const player = state.players.get(playerId);
  const newQueue = state.queue.filter((id) => id !== playerId);
  return {
    state: { ...state, queue: newQueue },
    sideEffects: [{ type: 'ANNOUNCE_PUBLIC', message: `👋 ${player?.name ?? '?'} salió (${newQueue.length}/5)` }],
  };
}

function handleStartGame(state: GameState, footballers: string[]): TransitionResult {
  if (state.phase !== GamePhase.WAITING) return { state, sideEffects: [] };
  if (state.queue.length < state.settings.minPlayers) {
    return { state, sideEffects: [{ type: 'ANNOUNCE_PUBLIC', message: `❌ Faltan jugadores (${state.queue.length}/5)` }] };
  }
  if (footballers.length === 0) {
    return { state, sideEffects: [{ type: 'ANNOUNCE_PUBLIC', message: '❌ Error config' }] };
  }

  // Take exactly 5 players
  const roundPlayers = shuffle(state.queue).slice(0, 5);
  const impostorId = roundPlayers[Math.floor(Math.random() * roundPlayers.length)];
  const normalPlayerIds = roundPlayers.filter((id) => id !== impostorId);
  const footballer = footballers[Math.floor(Math.random() * footballers.length)];
  const clueOrder = shuffle([...roundPlayers]);

  const round: Round = {
    id: generateRoundId(),
    footballer,
    impostorId,
    normalPlayerIds,
    clues: new Map(),
    votes: new Map(),
    clueOrder,
    currentClueIndex: 0,
    phaseDeadline: null,
    startedAt: Date.now(),
  };

  const names = roundPlayers.map((id) => state.players.get(id)?.name ?? '?').join(', ');

  const sideEffects: SideEffect[] = [
    { type: 'ANNOUNCE_PUBLIC', message: `🔴 RONDA: ${names}`, style: { color: 0xff0000, style: 'bold', sound: 2 } },
  ];

  for (const pid of roundPlayers) {
    const p = state.players.get(pid);
    if (!p) continue;
    if (pid === impostorId) {
      sideEffects.push({ type: 'ANNOUNCE_PRIVATE', playerId: pid, message: `🕵️ ERES IMPOSTOR - No sabes el futbolista. ¡Finge!` });
    } else {
      sideEffects.push({ type: 'ANNOUNCE_PRIVATE', playerId: pid, message: `⚽ FUTBOLISTA: ${footballer} - ¡No digas el nombre!` });
    }
  }

  return { state: { ...state, phase: GamePhase.ASSIGN, currentRound: round, queue: [] }, sideEffects };
}

export function transitionToClues(state: GameState): TransitionResult {
  if (state.phase !== GamePhase.ASSIGN || !state.currentRound) return { state, sideEffects: [] };

  const firstId = state.currentRound.clueOrder[0];
  const first = state.players.get(firstId);

  return {
    state: { ...state, phase: GamePhase.CLUES },
    sideEffects: [
      { type: 'ANNOUNCE_PUBLIC', message: `📝 PISTAS | Turno: ${first?.name ?? '?'} - Escribe UNA palabra`, style: { color: 0x00bfff, style: 'bold', sound: 1 } },
      { type: 'SET_PHASE_TIMER', durationSeconds: state.settings.clueTimeSeconds },
    ],
  };
}

function handleSubmitClue(state: GameState, playerId: number, clue: string): TransitionResult {
  if (state.phase !== GamePhase.CLUES || !state.currentRound) return { state, sideEffects: [] };

  const round = state.currentRound;
  const expectedId = round.clueOrder[round.currentClueIndex];
  if (playerId !== expectedId) return { state, sideEffects: [] };

  const newClues = new Map(round.clues);
  newClues.set(playerId, clue);
  const newRound: Round = { ...round, clues: newClues, currentClueIndex: round.currentClueIndex + 1 };
  const player = state.players.get(playerId);

  const sideEffects: SideEffect[] = [
    { type: 'ANNOUNCE_PUBLIC', message: `💬 ${player?.name ?? '?'}: "${clue}"`, style: { color: 0xffffff, style: 'bold' } },
  ];

  if (newRound.currentClueIndex >= round.clueOrder.length) {
    // Build clue summary
    const summary = round.clueOrder
      .map((id) => {
        const p = state.players.get(id);
        const c = newClues.get(id) ?? '...';
        return `${p?.name ?? '?'}:"${c}"`;
      })
      .join(' | ');

    sideEffects.push({ type: 'ANNOUNCE_PUBLIC', message: `🗣️ DEBATE (30s) | ${summary}`, style: { color: 0xffa500, style: 'bold', sound: 1 } });
    sideEffects.push({ type: 'SET_PHASE_TIMER', durationSeconds: state.settings.discussionTimeSeconds });
    return { state: { ...state, phase: GamePhase.DISCUSSION, currentRound: newRound }, sideEffects };
  }

  const nextId = round.clueOrder[newRound.currentClueIndex];
  const next = state.players.get(nextId);
  sideEffects.push({ type: 'ANNOUNCE_PUBLIC', message: `📝 Turno: ${next?.name ?? '?'}` });
  sideEffects.push({ type: 'SET_PHASE_TIMER', durationSeconds: state.settings.clueTimeSeconds });

  return { state: { ...state, currentRound: newRound }, sideEffects };
}

function handleClueTimeout(state: GameState): TransitionResult {
  if (state.phase !== GamePhase.CLUES || !state.currentRound) return { state, sideEffects: [] };

  const round = state.currentRound;
  const timedOutId = round.clueOrder[round.currentClueIndex];
  const timedOut = state.players.get(timedOutId);

  const newClues = new Map(round.clues);
  newClues.set(timedOutId, '...');
  const newRound: Round = { ...round, clues: newClues, currentClueIndex: round.currentClueIndex + 1 };

  const sideEffects: SideEffect[] = [
    { type: 'ANNOUNCE_PUBLIC', message: `⏰ ${timedOut?.name ?? '?'}: "..." (tiempo)` },
  ];

  if (newRound.currentClueIndex >= round.clueOrder.length) {
    const summary = round.clueOrder
      .map((id) => {
        const p = state.players.get(id);
        const c = newClues.get(id) ?? '...';
        return `${p?.name ?? '?'}:"${c}"`;
      })
      .join(' | ');

    sideEffects.push({ type: 'ANNOUNCE_PUBLIC', message: `🗣️ DEBATE (30s) | ${summary}`, style: { color: 0xffa500, style: 'bold', sound: 1 } });
    sideEffects.push({ type: 'SET_PHASE_TIMER', durationSeconds: state.settings.discussionTimeSeconds });
    return { state: { ...state, phase: GamePhase.DISCUSSION, currentRound: newRound }, sideEffects };
  }

  const nextId = round.clueOrder[newRound.currentClueIndex];
  const next = state.players.get(nextId);
  sideEffects.push({ type: 'ANNOUNCE_PUBLIC', message: `📝 Turno: ${next?.name ?? '?'}` });
  sideEffects.push({ type: 'SET_PHASE_TIMER', durationSeconds: state.settings.clueTimeSeconds });

  return { state: { ...state, currentRound: newRound }, sideEffects };
}

function handleEndDiscussion(state: GameState): TransitionResult {
  if (state.phase !== GamePhase.DISCUSSION || !state.currentRound) return { state, sideEffects: [] };

  const round = state.currentRound;
  const ids = [round.impostorId, ...round.normalPlayerIds];
  const list = ids.map((id) => `${id}.${state.players.get(id)?.name ?? '?'}`).join(' | ');

  return {
    state: { ...state, phase: GamePhase.VOTING },
    sideEffects: [
      { type: 'ANNOUNCE_PUBLIC', message: `🗳️ VOTAR | ${list} | Escribe el NÚMERO`, style: { color: 0xff69b4, style: 'bold', sound: 2 } },
      { type: 'SET_PHASE_TIMER', durationSeconds: state.settings.votingTimeSeconds },
    ],
  };
}

function handleSubmitVote(state: GameState, playerId: number, votedId: number): TransitionResult {
  if (state.phase !== GamePhase.VOTING || !state.currentRound) return { state, sideEffects: [] };

  const round = state.currentRound;
  const ids = [round.impostorId, ...round.normalPlayerIds];

  if (!ids.includes(playerId)) return { state, sideEffects: [{ type: 'ANNOUNCE_PRIVATE', playerId, message: '❌ No estás en la ronda' }] };
  if (!ids.includes(votedId)) return { state, sideEffects: [{ type: 'ANNOUNCE_PRIVATE', playerId, message: '❌ Número inválido' }] };
  if (playerId === votedId) return { state, sideEffects: [{ type: 'ANNOUNCE_PRIVATE', playerId, message: '❌ No puedes votarte' }] };

  const newVotes = new Map(round.votes);
  newVotes.set(playerId, votedId);
  const voter = state.players.get(playerId);
  const newRound: Round = { ...round, votes: newVotes };

  const sideEffects: SideEffect[] = [
    { type: 'ANNOUNCE_PUBLIC', message: `🗳️ ${voter?.name ?? '?'} votó (${newVotes.size}/${ids.length})` },
  ];

  if (newVotes.size >= ids.length) {
    return handleEndVoting({ ...state, currentRound: newRound });
  }

  return { state: { ...state, currentRound: newRound }, sideEffects };
}

function handleEndVoting(state: GameState): TransitionResult {
  if ((state.phase !== GamePhase.VOTING && state.phase !== GamePhase.DISCUSSION) || !state.currentRound) {
    return { state, sideEffects: [] };
  }

  const round = state.currentRound;
  const voteCount = new Map<number, number>();
  for (const votedId of round.votes.values()) {
    voteCount.set(votedId, (voteCount.get(votedId) || 0) + 1);
  }

  let maxVotes = 0;
  let votedOutId: number | null = null;
  const tied: number[] = [];

  for (const [pid, count] of voteCount) {
    if (count > maxVotes) {
      maxVotes = count;
      votedOutId = pid;
      tied.length = 0;
      tied.push(pid);
    } else if (count === maxVotes) {
      tied.push(pid);
    }
  }

  if (tied.length > 1) votedOutId = tied[Math.floor(Math.random() * tied.length)];

  const wasCorrect = votedOutId === round.impostorId;
  const impostor = state.players.get(round.impostorId);
  const votedOut = votedOutId ? state.players.get(votedOutId) : null;

  const result: RoundResult = {
    impostorWon: !wasCorrect,
    impostorId: round.impostorId,
    impostorName: impostor?.name ?? '?',
    footballer: round.footballer,
    votedOutId,
    votedOutName: votedOut?.name ?? null,
    wasCorrectVote: wasCorrect,
  };

  return {
    state: { ...state, phase: GamePhase.REVEAL, currentRound: { ...round, endedAt: Date.now(), result } },
    sideEffects: [
      { type: 'CLEAR_TIMER' },
      { type: 'ANNOUNCE_PUBLIC', message: `📊 Más votado: ${votedOut?.name ?? 'nadie'}`, style: { color: 0xffffff, style: 'bold', sound: 2 } },
    ],
  };
}

function handleEndReveal(state: GameState): TransitionResult {
  if (state.phase !== GamePhase.REVEAL || !state.currentRound) return { state, sideEffects: [] };

  const result = state.currentRound.result;
  if (!result) return { state, sideEffects: [] };

  const sideEffects: SideEffect[] = [];

  if (result.impostorWon) {
    sideEffects.push({
      type: 'ANNOUNCE_PUBLIC',
      message: `🔴 IMPOSTOR GANA | Era: ${result.impostorName} | Futbolista: ${result.footballer}`,
      style: { color: 0xff0000, style: 'bold', sound: 1 },
    });
  } else {
    sideEffects.push({
      type: 'ANNOUNCE_PUBLIC',
      message: `🟢 JUGADORES GANAN | Impostor: ${result.impostorName} | Futbolista: ${result.footballer}`,
      style: { color: 0x00ff00, style: 'bold', sound: 1 },
    });
  }

  sideEffects.push({ type: 'ANNOUNCE_PUBLIC', message: `━━━ Escribe "jugar" para otra ronda ━━━` });
  sideEffects.push({ type: 'LOG_ROUND', result });

  return { state: { ...state, phase: GamePhase.RESULTS, roundHistory: [...state.roundHistory, result] }, sideEffects };
}

function handleForceReveal(state: GameState): TransitionResult {
  if (!state.currentRound) return { state, sideEffects: [] };
  const round = state.currentRound;
  const impostor = state.players.get(round.impostorId);

  const result: RoundResult = {
    impostorWon: true,
    impostorId: round.impostorId,
    impostorName: impostor?.name ?? '?',
    footballer: round.footballer,
    votedOutId: null,
    votedOutName: null,
    wasCorrectVote: false,
  };

  return {
    state: { ...state, phase: GamePhase.RESULTS, currentRound: { ...round, result, endedAt: Date.now() }, roundHistory: [...state.roundHistory, result] },
    sideEffects: [
      { type: 'CLEAR_TIMER' },
      { type: 'ANNOUNCE_PUBLIC', message: `⚠️ Admin reveló | Impostor: ${result.impostorName} | Futbolista: ${result.footballer}` },
    ],
  };
}

function handleSkipPhase(state: GameState): TransitionResult {
  switch (state.phase) {
    case GamePhase.CLUES: return handleClueTimeout(state);
    case GamePhase.DISCUSSION: return handleEndDiscussion(state);
    case GamePhase.VOTING: return handleEndVoting(state);
    case GamePhase.REVEAL: return handleEndReveal(state);
    default: return { state, sideEffects: [] };
  }
}

function handleResetGame(state: GameState): TransitionResult {
  return { state: { ...state, phase: GamePhase.WAITING, currentRound: null }, sideEffects: [] };
}

function handleResetRound(state: GameState): TransitionResult {
  // Admin command to skip current round entirely and go back to waiting
  // Keep the queue - players waiting will start next round
  const sideEffects: SideEffect[] = [
    { type: 'CLEAR_TIMER' },
    {
      type: 'ANNOUNCE_PUBLIC',
      message: '⚠️ Admin saltó la ronda | Escribe "jugar" para la siguiente',
      style: { color: 0xffaa00, sound: 2 },
    },
  ];

  // Check if queue has enough players to auto-start
  if (state.queue.length >= state.settings.minPlayers) {
    sideEffects.push({ type: 'AUTO_START_GAME' });
  }
  
  return {
    state: { ...state, phase: GamePhase.WAITING, currentRound: null },
    sideEffects,
  };
}

export function canPlayerAct(state: GameState, playerId: number, action: 'clue' | 'vote'): boolean {
  if (!state.currentRound) return false;
  const round = state.currentRound;
  const ids = [round.impostorId, ...round.normalPlayerIds];
  if (!ids.includes(playerId)) return false;

  switch (action) {
    case 'clue': return state.phase === GamePhase.CLUES && round.clueOrder[round.currentClueIndex] === playerId;
    case 'vote': return state.phase === GamePhase.VOTING && !round.votes.has(playerId);
    default: return false;
  }
}

export function getCurrentActor(state: GameState): number | null {
  if (!state.currentRound || state.phase !== GamePhase.CLUES) return null;
  return state.currentRound.clueOrder[state.currentRound.currentClueIndex] ?? null;
}

export function getPhaseDescription(phase: GamePhase): string {
  const names: Record<GamePhase, string> = {
    [GamePhase.WAITING]: '⏳ Esperando',
    [GamePhase.ASSIGN]: '🎭 Asignando',
    [GamePhase.CLUES]: '📝 Pistas',
    [GamePhase.DISCUSSION]: '🗣️ Debate',
    [GamePhase.VOTING]: '🗳️ Votación',
    [GamePhase.REVEAL]: '🔔 Revelación',
    [GamePhase.RESULTS]: '🏆 Resultados',
  };
  return names[phase] ?? 'Desconocido';
}
