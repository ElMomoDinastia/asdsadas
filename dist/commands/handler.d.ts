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
export declare enum CommandType {
    JOIN = "JOIN",
    LEAVE = "LEAVE",
    START = "START",
    CLUE = "CLUE",
    VOTE = "VOTE",
    HELP = "HELP",
    STATUS = "STATUS",
    FORCE_REVEAL = "FORCE_REVEAL",
    SKIP = "SKIP",
    RESET_ROUND = "RESET_ROUND",
    CLAIM_ADMIN = "CLAIM_ADMIN",
    REGULAR_MESSAGE = "REGULAR_MESSAGE"
}
/**
 * Parse a chat message into a command
 * Very flexible - accepts natural language
 */
export declare function parseCommand(message: string): ParsedCommand | null;
/**
 * Validate a command based on the current game state
 */
export declare function validateCommand(command: ParsedCommand, player: HBPlayer, state: GameState, secretFootballer?: string): {
    valid: boolean;
    error?: string;
    action?: import('../game/types').GameAction;
};
/**
 * Generate help text
 */
export declare function generateHelpText(_phase: GamePhase, isAdmin: boolean): string;
/**
 * Generate status text
 */
export declare function generateStatusText(state: GameState): string;
//# sourceMappingURL=handler.d.ts.map