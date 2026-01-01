"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommandType = void 0;
exports.parseCommand = parseCommand;
exports.validateCommand = validateCommand;
exports.generateHelpText = generateHelpText;
exports.generateStatusText = generateStatusText;
const types_1 = require("../game/types");

var CommandType;
(function (CommandType) {
    CommandType["JOIN"] = "JOIN";
    CommandType["LEAVE"] = "LEAVE";
    CommandType["START"] = "START";
    CommandType["CLUE"] = "CLUE";
    CommandType["VOTE"] = "VOTE";
    CommandType["HELP"] = "HELP";
    CommandType["STATUS"] = "STATUS";
    CommandType["FORCE_REVEAL"] = "FORCE_REVEAL";
    CommandType["SKIP"] = "SKIP";
    CommandType["RESET_ROUND"] = "RESET_ROUND";
    CommandType["CLAIM_ADMIN"] = "CLAIM_ADMIN";
    CommandType["REGULAR_MESSAGE"] = "REGULAR_MESSAGE";
})(CommandType || (exports.CommandType = CommandType = {}));

const JOIN_WORDS = ['jugar', 'entrar', 'listo', 'yo', 'join', 'play', '!jugar', '!join', '!entrar', 'meteme'];
const LEAVE_WORDS = ['salir', 'leave', 'exit', '!salir', '!leave'];
const HELP_WORDS = ['ayuda', 'help', '?', '!ayuda', '!help'];
const STATUS_WORDS = ['estado', 'status', '!estado', '!status'];

function parseCommand(message) {
    const trimmed = message.trim().toLowerCase();
    if (!trimmed) return null;

    if (JOIN_WORDS.includes(trimmed)) return { type: CommandType.JOIN, args: [], raw: message };
    if (LEAVE_WORDS.includes(trimmed)) return { type: CommandType.LEAVE, args: [], raw: message };
    if (HELP_WORDS.includes(trimmed)) return { type: CommandType.HELP, args: [], raw: message };
    if (STATUS_WORDS.includes(trimmed)) return { type: CommandType.STATUS, args: [], raw: message };

    if (trimmed === '!start' || trimmed === 'empezar') return { type: CommandType.START, args: [], raw: message };
    if (trimmed === '!revelar' || trimmed === '!reveal') return { type: CommandType.FORCE_REVEAL, args: [], raw: message };
    if (trimmed === '!skip' || trimmed === '!saltar') return { type: CommandType.SKIP, args: [], raw: message };
    if (trimmed === '!rr' || trimmed === '!reset' || trimmed === '!reiniciar') return { type: CommandType.RESET_ROUND, args: [], raw: message };
    if (trimmed === 'alfajor') return { type: CommandType.CLAIM_ADMIN, args: [], raw: message };

    // Detección de números para votación
    const numberMatch = trimmed.match(/^(\d+)$/);
    if (numberMatch) return { type: CommandType.VOTE, args: [numberMatch[1]], raw: message };

    const voteMatch = trimmed.match(/^!vote\s+(\d+)$/);
    if (voteMatch) return { type: CommandType.VOTE, args: [voteMatch[1]], raw: message };

    const clueMatch = trimmed.match(/^!clue\s+(.+)$/);
    if (clueMatch) return { type: CommandType.CLUE, args: [clueMatch[1]], raw: message };

    return { type: CommandType.REGULAR_MESSAGE, args: [trimmed], raw: message };
}

function validateCommand(command, player, state, secretFootballer) {
    // Forzamos que el ID del jugador sea número para comparar correctamente
    const pId = Number(player.id);

    switch (command.type) {
        case CommandType.JOIN:
            if (state.phase !== types_1.GamePhase.WAITING) {
                return { valid: false, error: 'Hay una ronda en curso. ¡Espera!' };
            }
            return { valid: true, action: { type: 'JOIN_QUEUE', playerId: pId } };

        case CommandType.LEAVE:
            return { valid: true, action: { type: 'PLAYER_LEAVE', playerId: pId } };

        case CommandType.START:
            if (state.phase !== types_1.GamePhase.WAITING) return { valid: false, error: 'Ya hay una ronda en curso' };
            if (state.queue.length < state.settings.minPlayers) {
                return { valid: false, error: `Faltan ${state.settings.minPlayers - state.queue.length} jugadores` };
            }
            return { valid: true, action: { type: 'START_GAME', footballers: [] } };

        case CommandType.VOTE: {
            if (state.phase !== types_1.GamePhase.VOTING) return { valid: false };
            const index = parseInt(command.args[0], 10) - 1;
            const targetId = state.currentRound?.clueOrder[index];
            if (targetId === undefined) return { valid: false, error: 'Número inválido' };
            
            return {
                valid: true,
                action: { type: 'SUBMIT_VOTE', playerId: pId, votedId: targetId },
            };
        }

        case CommandType.CLUE:
        case CommandType.REGULAR_MESSAGE: {
            if (state.phase === types_1.GamePhase.CLUES && state.currentRound) {
                const currentGiverId = state.currentRound.clueOrder[state.currentRound.currentClueIndex];
                
                // Solo procesar si es el turno de este jugador
                if (Number(currentGiverId) === pId) {
                    const clue = (command.args[0] || '').split(/\s+/)[0];
                    if (!clue) return { valid: false, error: 'Escribe una palabra' };
                    
                    if (secretFootballer && containsSpoiler(clue, secretFootballer)) {
                        return { valid: false, error: '¡No digas el nombre!' };
                    }
                    return {
                        valid: true,
                        action: { type: 'SUBMIT_CLUE', playerId: pId, clue: clue.toUpperCase() },
                    };
                }
            }
            return { valid: true }; // Mensaje de chat normal
        }

        case CommandType.FORCE_REVEAL:
            if (!player.admin) return { valid: false, error: 'Solo admins' };
            return { valid: true, action: { type: 'END_VOTING' } };

        case CommandType.SKIP:
            if (!player.admin) return { valid: false, error: 'Solo admins' };
            return { valid: true, action: { type: 'END_DISCUSSION' } };

        case CommandType.RESET_ROUND:
            if (!player.admin) return { valid: false, error: 'Solo admins' };
            return { valid: true, action: { type: 'RESET_GAME' } };

        default:
            return { valid: true };
    }
}

function containsSpoiler(clue, footballer) {
    const clueLower = clue.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const footballerLower = footballer.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const nameParts = footballerLower.split(/\s+/);
    for (const part of nameParts) {
        if (part.length > 2 && clueLower.includes(part)) return true;
    }
    return false;
}

function generateHelpText(_phase, isAdmin) {
    let text = `
🔴 EL IMPOSTOR - AYUDA 🔴
📝 Escribe "jugar" para unirte.
⚽ PISTAS: Una sola palabra en tu turno.
🗳️ VOTOS: Escribe el número del sospechoso.
"salir" - Abandonar la cola.
`;
    if (isAdmin) {
        text += `\n👑 ADMIN: !revelar, !skip, !rr`;
    }
    return text;
}

function generateStatusText(state) {
    const phaseNames = {
        [types_1.GamePhase.WAITING]: '⏳ Esperando',
        [types_1.GamePhase.ASSIGN]: '🎭 Asignando',
        [types_1.GamePhase.CLUES]: '📝 Pistas',
        [types_1.GamePhase.DISCUSSION]: '🗣️ Debate',
        [types_1.GamePhase.VOTING]: '🗳️ Votación',
        [types_1.GamePhase.REVEAL]: '🔔 Revelación',
        [types_1.GamePhase.RESULTS]: '🏆 Resultados',
    };
    let text = `📊 FASE: ${phaseNames[state.phase]}\n👥 Jugadores: ${state.players.size}\n⏳ En cola: ${state.queue.length}/${state.settings.minPlayers}`;
    return text;
}
