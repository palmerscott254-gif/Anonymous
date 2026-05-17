import { describe, it, expect } from 'vitest';
import { normalizeRoomCode } from '../../server/lib/sanitize.js';

describe('sanitize utils', () => {
  it('normalizes room code format', () => {
    expect(normalizeRoomCode('ab-1234')).toBe('AB-1234');
    expect(normalizeRoomCode('ab1234')).toBe('AB-1234');
    expect(normalizeRoomCode('!@ab##1234')).toBe('AB-1234');
  });
});
