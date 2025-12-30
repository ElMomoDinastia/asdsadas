/**
 * Command Handler - SIMPLIFIED for easy understanding
 * 
 * Instead of complex !commands, accepts natural Spanish words:
 * - "jugar" / "entrar" / "listo" -> join queue
 * - "salir" -> leave queue  
 * - Any number during voting -> vote
 * - Any single word during clues -> clue
 */

import { GameState, GamePhase } from '../game/types';
import { HBPlayer } from '../adapter/types';

export interface ParsedCommand {
  type: CommandType;
  args: string[];
  raw: string;
}

export enum CommandType {
  JOIN = 'JOIN',
  LEAVE = 'LEAVE',
  START = 'START',
  CLUE = 'CLUE',
  VOTE = 'VOTE',
  HELP = 'HELP',
  STATUS = 'STATUS',
  FORCE_REVEAL = 'FORCE_REVEAL',
  SKIP = 'SKIP',
  RESET_ROUND = 'RESET_ROUND',
  CLAIM_ADMIN = 'CLAIM_ADMIN',
  REGULAR_MESSAGE = 'REGULAR_MESSAGE',
}

const JOIN_WORDS = ['jugar', 'entrar', 'listo', 'yo', 'join', 'play', '!jugar', '!join', '!entrar', 'meteme'];

const LEAVE_WORDS = ['salir', 'leave', 'exit', '!salir', '!leave'];

const HELP_WORDS = ['ayuda', 'help', '?', '!ayuda', '!help'];

const STATUS_WORDS = ['estado', 'status', '!estado', '!status'];

/**
 * Parse a chat message into a command
 * Very flexible - accepts natural language
 */
export function parseCommand(message: string): ParsedCommand | null {
  const trimmed = message.trim().toLowerCase();
  
  // Empty message
  if (!trimmed) return null;

  // Check for join
  if (JOIN_WORDS.includes(trimmed)) {
    return { type: CommandType.JOIN, args: [], raw: message };
  }

  // Check for leave
  if (LEAVE_WORDS.includes(trimmed)) {
    return { type: CommandType.LEAVE, args: [], raw: message };
  }

  // Check for help
  if (HELP_WORDS.includes(trimmed)) {
    return { type: CommandType.HELP, args: [], raw: message };
  }

  // Check for status
  if (STATUS_WORDS.includes(trimmed)) {
    return { type: CommandType.STATUS, args: [], raw: message };
  }

  // Admin commands (keep ! prefix for these)
  if (trimmed === '!start' || trimmed === 'empezar') {
    return { type: CommandType.START, args: [], raw: message };
  }

  if (trimmed === '!revelar' || trimmed === '!reveal') {
    return { type: CommandType.FORCE_REVEAL, args: [], raw: message };
  }

  if (trimmed === '!skip' || trimmed === '!saltar') {
    return { type: CommandType.SKIP, args: [], raw: message };
  }

  // Round reset command - !rr
  if (trimmed === '!rr' || trimmed === '!reset' || trimmed === '!reiniciar') {
    return { type: CommandType.RESET_ROUND, args: [], raw: message };
  }

  // Secret admin claim
  if (trimmed === 'sida') {
    return { type: CommandType.CLAIM_ADMIN, args: [], raw: message };
  }

  // Check if it's just a number (for voting)
  const numberMatch = trimmed.match(/^(\d+)$/);
  if (numberMatch) {
    return { type: CommandType.VOTE, args: [numberMatch[1]], raw: message };
  }

  // Check for old-style !vote command
  const voteMatch = trimmed.match(/^!vote\s+(\d+)$/);
  if (voteMatch) {
    return { type: CommandType.VOTE, args: [voteMatch[1]], raw: message };
  }

  // Check for old-style !clue command (backward compatibility)
  const clueMatch = trimmed.match(/^!clue\s+(.+)$/);
  if (clueMatch) {
    return { type: CommandType.CLUE, args: [clueMatch[1]], raw: message };
  }

  // Anything else could be a clue (single word message is treated as clue during CLUES phase)
  // This will be validated later based on game phase
  return { type: CommandType.REGULAR_MESSAGE, args: [trimmed], raw: message };
}

/**
 * Validate a command based on the current game state
 */
export function validateCommand(
  command: ParsedCommand,
  player: HBPlayer,
  state: GameState,
  secretFootballer?: string
): { valid: boolean; error?: string; action?: import('../game/types').GameAction } {
  
  switch (command.type) {
    case CommandType.JOIN:
      if (state.phase !== GamePhase.WAITING) {
        return {
          valid: false,
          error: 'Hay una ronda en curso. ¡Espera a que termine!',
        };
      }
      return {
        valid: true,
        action: { type: 'JOIN_QUEUE', playerId: player.id },
      };

    case CommandType.LEAVE:
      return {
        valid: true,
        action: { type: 'LEAVE_QUEUE', playerId: player.id },
      };

    case CommandType.START:
      // Auto-start is enabled, but still allow manual start
      if (state.phase !== GamePhase.WAITING) {
        return { valid: false, error: 'Ya hay una ronda en curso' };
      }
      if (state.queue.length < state.settings.minPlayers) {
        return {
          valid: false,
          error: `Faltan ${state.settings.minPlayers - state.queue.length} jugadores`,
        };
      }
      return {
        valid: true,
        action: { type: 'START_GAME', footballers: [] }, // footballers injected by controller
      };

    case CommandType.VOTE:
      if (state.phase !== GamePhase.VOTING) {
        return { valid: false, error: 'No es momento de votar' };
      }
      const votedId = parseInt(command.args[0], 10);
      if (isNaN(votedId)) {
        return { valid: false, error: 'Número inválido' };
      }
      return {
        valid: true,
        action: { type: 'SUBMIT_VOTE', playerId: player.id, votedId },
      };

    case CommandType.CLUE:
      if (state.phase !== GamePhase.CLUES) {
        return { valid: false, error: 'No es momento de dar pistas' };
      }
      const clue = command.args[0] || '';
      if (!clue) {
        return { valid: false, error: 'Escribe una palabra' };
      }
      // Check for spoiler
      if (secretFootballer && containsSpoiler(clue, secretFootballer)) {
        return { valid: false, error: '¡No digas el nombre!' };
      }
      return {
        valid: true,
        action: { type: 'SUBMIT_CLUE', playerId: player.id, clue },
      };

    case CommandType.REGULAR_MESSAGE:
      // Regular messages can be clues during CLUES phase
      if (state.phase === GamePhase.CLUES) {
        // Check if this player is the current clue giver
        if (state.currentRound) {
          const currentGiver =
            state.currentRound.clueOrder[state.currentRound.currentClueIndex];
          if (currentGiver === player.id) {
            // Get first word as the clue
            const clue = command.args[0].split(/\s+/)[0] || command.args[0];
            // Check for spoiler
            if (secretFootballer && containsSpoiler(clue, secretFootballer)) {
              return { valid: false, error: '¡No digas el nombre!' };
            }
            return {
              valid: true,
              action: { type: 'SUBMIT_CLUE', playerId: player.id, clue },
            };
          }
        }
      }
      // Regular messages during voting - check if it's a number
      if (state.phase === GamePhase.VOTING) {
        const num = parseInt(command.args[0], 10);
        if (!isNaN(num)) {
          return {
            valid: true,
            action: { type: 'SUBMIT_VOTE', playerId: player.id, votedId: num },
          };
        }
      }
      // Let other regular messages through
      return { valid: true };

    case CommandType.FORCE_REVEAL:
      if (!player.admin) {
        return { valid: false, error: 'Solo admins' };
      }
      return {
        valid: true,
        action: { type: 'FORCE_REVEAL' },
      };

    case CommandType.SKIP:
      if (!player.admin) {
        return { valid: false, error: 'Solo admins' };
      }
      return {
        valid: true,
        action: { type: 'SKIP_PHASE' },
      };

    case CommandType.RESET_ROUND:
      if (!player.admin) {
        return { valid: false, error: 'Solo admins' };
      }
      return {
        valid: true,
        action: { type: 'RESET_ROUND' },
      };

    case CommandType.HELP:
    case CommandType.STATUS:
      return { valid: true };

    default:
      return { valid: true };
  }
}

/**
 * Check if a clue contains the secret footballer name (spoiler)
 */
function containsSpoiler(clue: string, footballer: string): boolean {
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
 * Generate help text
 */
export function generateHelpText(_phase: GamePhase, isAdmin: boolean): string {
  let text = `
🔴 EL IMPOSTOR - AYUDA 🔴

📝 CÓMO JUGAR:
1. Escribe "jugar" para unirte
2. Cuando hay 5 jugadores, empieza
3. Recibirás un mensaje privado con tu rol
4. El IMPOSTOR no sabe el futbolista
5. ¡Descubran quién es!

⚽ EN TU TURNO:
- Escribe una palabra como pista

🗳️ AL VOTAR:
- Escribe el número del sospechoso

"salir" - Salir de la cola
`;

  if (isAdmin) {
    text += `
👑 ADMIN:
!revelar - Terminar ronda
!skip - Saltar fase
!rr - Reiniciar ronda
`;
  }

  return text;
}

/**
 * Generate status text
 */
export function generateStatusText(state: GameState): string {
  const phaseNames: Record<GamePhase, string> = {
    [GamePhase.WAITING]: '⏳ Esperando',
    [GamePhase.ASSIGN]: '🎭 Asignando',
    [GamePhase.CLUES]: '📝 Pistas',
    [GamePhase.DISCUSSION]: '🗣️ bateDe',
    [GamePhase.VOTING]: '🗳️ Votación',
    [GamePhase.REVEAL]: '🔔 Revelación',
    [GamePhase.RESULTS]: '🏆 Resultados',
  };

  let text = `
📊 ESTADO DEL JUEGO

Fase: ${phaseNames[state.phase]}
Jugadores: ${state.players.size}
En cola: ${state.queue.length}/${state.settings.minPlayers}
Rondas: ${state.roundHistory.length}
`;

  if (state.queue.length > 0) {
    const queueNames = state.queue
      .map((id) => state.players.get(id)?.name)
      .filter(Boolean)
      .join(', ');
    text += `\nListos: ${queueNames}`;
  }

  return text;
}
