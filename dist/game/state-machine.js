"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
exports.createInitialState = createInitialState;
exports.transition = transition;
exports.transitionToClues = transitionToClues;
exports.canPlayerAct = canPlayerAct;
exports.getCurrentActor = getCurrentActor;
exports.getPhaseDescription = getPhaseDescription;

const { GamePhase } = require("./types");

/* =========================
   STATE INIT
========================= */

function createInitialState(settings) {
  return {
    phase: GamePhase.WAITING,
    players: new Map(),
    queue: [],
    currentRound: null,
    roundHistory: [],
    settings: settings || {
      minPlayers: 5,
      clueTimeSeconds: 30,
      discussionTimeSeconds: 30,
      votingTimeSeconds: 45,
    },
  };
}

/* =========================
   HELPERS
========================= */

function generateRoundId() {
  return `round_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getRoundPlayers(round) {
  if (!round) return [];
  return [round.impostorId, ...round.normalPlayerIds];
}

/* =========================
   TRANSITION ROUTER
========================= */

function transition(state, action) {
  switch (action.type) {
    case "PLAYER_JOIN": return handlePlayerJoin(state, action.player);
    case "PLAYER_LEAVE": return handlePlayerLeave(state, action.playerId);
    case "JOIN_QUEUE": return handleJoinQueue(state, action.playerId);
    case "LEAVE_QUEUE": return handleLeaveQueue(state, action.playerId);
    case "START_GAME": return handleStartGame(state, action.footballers);
    case "SUBMIT_CLUE": return handleSubmitClue(state, action.playerId, action.clue);
    case "CLUE_TIMEOUT": return handleClueTimeout(state);
    case "END_DISCUSSION": return handleEndDiscussion(state);
    case "SUBMIT_VOTE": return handleSubmitVote(state, action.playerId, action.votedId);
    case "END_VOTING": return handleEndVoting(state);
    case "RESET_GAME": return handleResetGame(state);
    default: return { state, sideEffects: [] };
  }
}

/* =========================
   PLAYER HANDLING
========================= */

function handlePlayerJoin(state, player) {
  const players = new Map(state.players);
  players.set(player.id, player);

  return {
    state: { ...state, players },
    sideEffects: [{
      type: "ANNOUNCE_PRIVATE",
      playerId: player.id,
      message: `🔴 EL IMPOSTOR | Escribe "jugar" para unirte`,
    }],
  };
}

function handlePlayerLeave(state, playerId) {
  const players = new Map(state.players);
  players.delete(playerId);

  const queue = state.queue.filter(id => id !== playerId);
  let newState = { ...state, players, queue };
  const sideEffects = [];

  if (state.currentRound) {
    const active = getRoundPlayers(state.currentRound).filter(id => players.has(id));
    if (active.length < 3) {
      sideEffects.push({
        type: "ANNOUNCE_PUBLIC",
        message: "⚠️ Ronda cancelada - faltan jugadores",
        style: { color: 0xff6b6b, sound: 2 },
      });
      sideEffects.push({ type: "CLEAR_TIMER" });
      newState = { ...newState, phase: GamePhase.WAITING, currentRound: null };
    }
  }

  return { state: newState, sideEffects };
}

/* =========================
   QUEUE
========================= */

function handleJoinQueue(state, playerId) {
  if (!state.players.has(playerId)) return { state, sideEffects: [] };

  if (state.queue.includes(playerId)) {
    return {
      state,
      sideEffects: [{ type: "ANNOUNCE_PRIVATE", playerId, message: "✅ Ya estás en la cola." }],
    };
  }

  const queue = [...state.queue, playerId];
  const remaining = state.settings.minPlayers - queue.length;

  const sideEffects = [{
    type: "ANNOUNCE_PUBLIC",
    message: remaining > 0
      ? `✅ Listos (${queue.length}/5) - faltan ${remaining}`
      : `🎮 5/5 ¡Iniciando!`,
    style: { color: 0x00ff00, sound: remaining <= 0 ? 1 : 0 },
  }];

  if (remaining <= 0) sideEffects.push({ type: "AUTO_START_GAME" });

  return { state: { ...state, queue }, sideEffects };
}

function handleLeaveQueue(state, playerId) {
  return {
    state: { ...state, queue: state.queue.filter(id => id !== playerId) },
    sideEffects: [{ type: "ANNOUNCE_PUBLIC", message: "👋 Alguien salió de la cola." }],
  };
}

/* =========================
   GAME FLOW
========================= */

function handleStartGame(state, footballers) {
  if (state.phase !== GamePhase.WAITING) return { state, sideEffects: [] };

  const players = shuffle(state.queue).slice(0, 5);
  if (players.length < 5) return { state, sideEffects: [] };

  const impostorId = players[Math.floor(Math.random() * players.length)];
  const normalPlayerIds = players.filter(id => id !== impostorId);
  const footballer = footballers[Math.floor(Math.random() * footballers.length)];

  const round = {
    id: generateRoundId(),
    footballer,
    impostorId,
    normalPlayerIds,
    clueOrder: shuffle(players),
    currentClueIndex: 0,
    votes: new Map(),
    startedAt: Date.now(),
  };

  const sideEffects = [{ type: "ANNOUNCE_PUBLIC", message: "🔴 RONDA INICIADA", style: { color: 0xff0000, sound: 2 } }];

  for (const id of players) {
    sideEffects.push({
      type: "ANNOUNCE_PRIVATE",
      playerId: id,
      message: id === impostorId
        ? "🕵️ ERES EL IMPOSTOR"
        : `⚽ FUTBOLISTA: ${footballer}`,
    });
  }

  return { state: { ...state, phase: GamePhase.ASSIGN, currentRound: round, queue: [] }, sideEffects };
}

function transitionToClues(state) {
  if (!state.currentRound) return { state, sideEffects: [] };
  const id = state.currentRound.clueOrder[0];
  return {
    state: { ...state, phase: GamePhase.CLUES },
    sideEffects: [
      { type: "ANNOUNCE_PUBLIC", message: `📝 Turno: ${state.players.get(id)?.name ?? "?"}` },
      { type: "SET_PHASE_TIMER", durationSeconds: state.settings.clueTimeSeconds },
    ],
  };
}

/* =========================
   CLUES / DISCUSSION / VOTE
========================= */

function handleSubmitClue(state, playerId, clue) {
  const r = state.currentRound;
  if (!r || state.phase !== GamePhase.CLUES) return { state, sideEffects: [] };

  if (r.clueOrder[r.currentClueIndex] !== playerId) return { state, sideEffects: [] };

  const nextIndex = r.currentClueIndex + 1;
  const nextRound = { ...r, currentClueIndex: nextIndex };

  if (nextIndex >= r.clueOrder.length) {
    return {
      state: { ...state, phase: GamePhase.DISCUSSION, currentRound: nextRound },
      sideEffects: [
        { type: "ANNOUNCE_PUBLIC", message: "🗣️ DEBATE", style: { sound: 1 } },
        { type: "SET_PHASE_TIMER", durationSeconds: state.settings.discussionTimeSeconds },
      ],
    };
  }

  return {
    state: { ...state, currentRound: nextRound },
    sideEffects: [{ type: "SET_PHASE_TIMER", durationSeconds: state.settings.clueTimeSeconds }],
  };
}

function handleClueTimeout(state) {
  const r = state.currentRound;
  if (!r) return { state, sideEffects: [] };
  return handleSubmitClue(state, r.clueOrder[r.currentClueIndex], "...");
}

function handleEndDiscussion(state) {
  const r = state.currentRound;
  if (!r) return { state, sideEffects: [] };

  let menu = "🗳️ VOTACIÓN:\n";
  r.clueOrder.forEach(id => {
    const p = state.players.get(id);
    if (p) menu += `[${id}] ${p.name}\n`;
  });

  return {
    state: { ...state, phase: GamePhase.VOTING },
    sideEffects: [
      { type: "ANNOUNCE_PUBLIC", message: menu, style: { sound: 2 } },
      { type: "SET_PHASE_TIMER", durationSeconds: state.settings.votingTimeSeconds },
    ],
  };
}

function handleSubmitVote(state, playerId, votedId) {
  const r = state.currentRound;
  if (!r || state.phase !== GamePhase.VOTING) return { state, sideEffects: [] };

  const votes = new Map(r.votes);
  votes.set(playerId, votedId);

  const sideEffects = [{ type: "ANNOUNCE_PUBLIC", message: `🗳️ Votos: ${votes.size}/5` }];
  if (votes.size >= 5) return handleEndVoting({ ...state, currentRound: { ...r, votes } });

  return { state: { ...state, currentRound: { ...r, votes } }, sideEffects };
}

function handleEndVoting(state) {
  const r = state.currentRound;
  if (!r) return { state, sideEffects: [] };

  const count = {};
  r.votes.forEach(v => count[v] = (count[v] || 0) + 1);
  const votedId = Number(Object.keys(count).sort((a, b) => count[b] - count[a])[0]);

  const impostorDead = votedId === r.impostorId;
  const name = state.players.get(votedId)?.name ?? "¿?";

  return {
    state: { ...state, phase: GamePhase.RESULTS },
    sideEffects: [
      { type: "CLEAR_TIMER" },
      {
        type: "ANNOUNCE_PUBLIC",
        message: impostorDead
          ? `🎯 ¡GANARON! ${name} era el impostor`
          : `💀 PERDIERON | ${name} era inocente`,
        style: { sound: 2 },
      },
      { type: "ANNOUNCE_PUBLIC", message: `⚽ Futbolista: ${r.footballer}` },
    ],
  };
}

function handleResetGame(state) {
  return { state: { ...state, phase: GamePhase.WAITING, currentRound: null, queue: [] }, sideEffects: [] };
}

/* =========================
   DUMMIES (OK)
========================= */

function canPlayerAct() { return true; }
function getCurrentActor() { return null; }
function getPhaseDescription(phase) { return phase; }

