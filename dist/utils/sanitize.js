"use strict";
/**
 * Sanitize user input to prevent injection attacks and filter inappropriate content
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_MESSAGE_LENGTH = exports.MAX_PLAYER_NAME_LENGTH = exports.MAX_CLUE_LENGTH = void 0;
exports.sanitizeClue = sanitizeClue;
exports.containsSpoiler = containsSpoiler;
exports.normalizeString = normalizeString;
exports.sanitizeMessage = sanitizeMessage;
exports.parsePlayerId = parsePlayerId;
exports.escapeHtml = escapeHtml;
// Characters allowed in clues (alphanumeric + accents + basic punctuation)
const ALLOWED_CLUE_PATTERN = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ0-9\s\-]+$/;
// Maximum lengths
exports.MAX_CLUE_LENGTH = 20;
exports.MAX_PLAYER_NAME_LENGTH = 25;
exports.MAX_MESSAGE_LENGTH = 140;
/**
 * Sanitize a clue word - single word only, restricted characters
 */
function sanitizeClue(input) {
    const trimmed = input.trim();
    if (trimmed.length === 0) {
        return { valid: false, sanitized: '', error: 'Clue cannot be empty' };
    }
    // Check for spaces (must be single word)
    if (trimmed.includes(' ')) {
        return { valid: false, sanitized: '', error: 'Clue must be a single word' };
    }
    if (trimmed.length > exports.MAX_CLUE_LENGTH) {
        return {
            valid: false,
            sanitized: '',
            error: `Clue too long (max ${exports.MAX_CLUE_LENGTH} chars)`,
        };
    }
    if (!ALLOWED_CLUE_PATTERN.test(trimmed)) {
        return { valid: false, sanitized: '', error: 'Clue contains invalid characters' };
    }
    return { valid: true, sanitized: trimmed.toLowerCase() };
}
/**
 * Check if a message contains the secret footballer name (spoiler prevention)
 */
function containsSpoiler(message, secretName) {
    const normalizedMessage = normalizeString(message);
    const normalizedSecret = normalizeString(secretName);
    // Check full name
    if (normalizedMessage.includes(normalizedSecret)) {
        return true;
    }
    // Check individual parts of the name (first name, last name)
    const secretParts = normalizedSecret.split(/\s+/).filter((part) => part.length > 2);
    return secretParts.some((part) => normalizedMessage.includes(part));
}
/**
 * Normalize string for comparison (lowercase, tsremove accen)
 */
function normalizeString(str) {
    return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}
/**
 * Sanitize general chat message
 */
function sanitizeMessage(input) {
    return input.trim().substring(0, exports.MAX_MESSAGE_LENGTH);
}
/**
 * Parse player ID from vote command
 */
function parsePlayerId(input) {
    const trimmed = input.trim();
    // Try to parse as number
    const parsed = parseInt(trimmed, 10);
    if (isNaN(parsed) || parsed < 0) {
        return { valid: false, error: 'Invalid player ID' };
    }
    return { valid: true, playerId: parsed };
}
/**
 * Escape HTML-like characters (for any web display)
 */
function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
//# sourceMappingURL=sanitize.js.map