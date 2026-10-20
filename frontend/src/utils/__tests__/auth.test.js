import { afterEach, describe, expect, it } from 'vitest';
import { getCurrentUserFromToken, isTokenExpired } from '../auth';

const tokenWithPayload = (payload) => `header.${btoa(JSON.stringify(payload))}.signature`;

describe('JWT session helpers', () => {
  afterEach(() => localStorage.clear());

  it('recognizes an expired JWT before a protected route loads', () => {
    const token = tokenWithPayload({ sub: 'admin', role: 'ADMIN', exp: 100 });

    expect(isTokenExpired(token, 100_000)).toBe(true);
  });

  it('does not expose an expired token as the current user', () => {
    localStorage.setItem('nutribot-auth-token', tokenWithPayload({ sub: 'admin', role: 'ADMIN', exp: 100 }));

    expect(getCurrentUserFromToken()).toBeNull();
  });
});
