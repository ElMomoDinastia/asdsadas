/**
 * Sanitize user input to prevent injection attacks and filter inappropriate content
 */
export declare const MAX_CLUE_LENGTH = 20;
export declare const MAX_PLAYER_NAME_LENGTH = 25;
export declare const MAX_MESSAGE_LENGTH = 140;
/**
 * Sanitize a clue word - single word only, restricted characters
 */
export declare function sanitizeClue(input: string): {
    valid: boolean;
    sanitized: string;
    error?: string;
};
/**
 * Check if a message contains the secret footballer name (spoiler prevention)
 */
export declare function containsSpoiler(message: string, secretName: string): boolean;
/**
 * Normalize string for comparison (lowercase, tsremove accen)
 */
export declare function normalizeString(str: string): string;
/**
 * Sanitize general chat message
 */
export declare function sanitizeMessage(input: string): string;
/**
 * Parse player ID from vote command
 */
export declare function parsePlayerId(input: string): {
    valid: boolean;
    playerId?: number;
    error?: string;
};
/**
 * Escape HTML-like characters (for any web display)
 */
export declare function escapeHtml(str: string): string;
//# sourceMappingURL=sanitize.d.ts.map