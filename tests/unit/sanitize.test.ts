/**
 * Unit Tests for Input Sanitization
 */

import {
  sanitizeClue,
  containsSpoiler,
  normalizeString,
  sanitizeMessage,
  parsePlayerId,
  MAX_CLUE_LENGTH,
} from '../../src/utils/sanitize';

describe('Sanitize Utils', () => {
  describe('sanitizeClue', () => {
    it('should accept valid single-word clues', () => {
      const result = sanitizeClue('argentina');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('argentina');
    });

    it('should reject empty clues', () => {
      const result = sanitizeClue('');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('should reject multi-word clues', () => {
      const result = sanitizeClue('two words');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('single word');
    });

    it('should reject clues exceeding max length', () => {
      const longClue = 'a'.repeat(MAX_CLUE_LENGTH + 1);
      const result = sanitizeClue(longClue);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('long');
    });

    it('should accept clues with accents', () => {
      const result = sanitizeClue('fútbol');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('fútbol');
    });

    it('should reject clues with special characters', () => {
      const result = sanitizeClue('test@123');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('invalid characters');
    });

    it('should trim whitespace', () => {
      const result = sanitizeClue('  argentina  ');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('argentina');
    });
  });

  describe('containsSpoiler', () => {
    it('should detect full name match', () => {
      expect(containsSpoiler('I think its Lionel Messi', 'Lionel Messi')).toBe(true);
    });

    it('should detect partial name match (last name)', () => {
      expect(containsSpoiler('definitely messi', 'Lionel Messi')).toBe(true);
    });

    it('should detect partial name match (first name)', () => {
      expect(containsSpoiler('its lionel for sure', 'Lionel Messi')).toBe(true);
    });

    it('should be case insensitive', () => {
      expect(containsSpoiler('MESSI is the answer', 'Lionel Messi')).toBe(true);
    });

    it('should ignore accents', () => {
      expect(containsSpoiler('Pérez', 'Perez')).toBe(true);
    });

    it('should not detect unrelated text', () => {
      expect(containsSpoiler('argentina barcelona goal', 'Lionel Messi')).toBe(false);
    });

    it('should ignore short name parts (2 chars or less)', () => {
      expect(containsSpoiler('he is good', 'Di María')).toBe(false);
    });
  });

  describe('normalizeString', () => {
    it('should lowercase strings', () => {
      expect(normalizeString('HELLO')).toBe('hello');
    });

    it('should remove accents', () => {
      expect(normalizeString('áéíóú')).toBe('aeiou');
    });

    it('should handle ñ', () => {
      expect(normalizeString('señor')).toBe('senor');
    });
  });

  describe('sanitizeMessage', () => {
    it('should trim whitespace', () => {
      expect(sanitizeMessage('  hello  ')).toBe('hello');
    });

    it('should truncate long messages', () => {
      const longMessage = 'a'.repeat(200);
      expect(sanitizeMessage(longMessage).length).toBe(140);
    });
  });

  describe('parsePlayerId', () => {
    it('should parse valid numeric IDs', () => {
      const result = parsePlayerId('5');
      expect(result.valid).toBe(true);
      expect(result.playerId).toBe(5);
    });

    it('should reject non-numeric input', () => {
      const result = parsePlayerId('abc');
      expect(result.valid).toBe(false);
    });

    it('should reject negative numbers', () => {
      const result = parsePlayerId('-1');
      expect(result.valid).toBe(false);
    });

    it('should handle whitespace', () => {
      const result = parsePlayerId('  3  ');
      expect(result.valid).toBe(true);
      expect(result.playerId).toBe(3);
    });
  });
});
