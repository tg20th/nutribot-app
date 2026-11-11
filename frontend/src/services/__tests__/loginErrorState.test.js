import { describe, expect, it } from 'vitest';
import { getApiAuthFailureState, getLoginErrorMessage, getLoginErrorState, getOAuthErrorState } from '../loginErrorState';

describe('getLoginErrorState', () => {
  it('recognizes only the backend blocked-account login message', () => {
    expect(getLoginErrorState({ status: 400, message: 'Your account has been locked. You cannot sign in.' })).toBe('ACCOUNT_BLOCKED');
    expect(getLoginErrorMessage('ACCOUNT_BLOCKED')).toMatch(/suspended or locked/i);
  });

  it('keeps credentials and email-verification failures distinct', () => {
    expect(getLoginErrorState({ status: 400, message: 'Incorrect email or password.' })).toBe('INVALID_CREDENTIALS');
    expect(getLoginErrorState({ status: 400, message: 'Your account is not verified. Please verify your email address.' })).toBe('PENDING_VERIFY');
  });

  it('does not treat another 400 or network/server failures as blocked accounts', () => {
    expect(getLoginErrorState({ status: 400, message: 'Invalid request data.' })).toBe('LOGIN_ERROR');
    expect(getLoginErrorState(new Error('Failed to fetch'))).toBe('NETWORK_ERROR');
    expect(getLoginErrorState({ status: 500, message: 'Internal server error' })).toBe('SERVER_ERROR');
  });

  it('centralizes OAuth and expired-session failure states', () => {
    expect(getOAuthErrorState({ error: 'access_denied' })).toBe('OAUTH_FAILED');
    expect(getOAuthErrorState({ error: 'ACCOUNT_BANNED' })).toBe('ACCOUNT_BLOCKED');
    expect(getOAuthErrorState({ token: 'token', username: 'lan', role: 'ROLE_USER' })).toBeNull();
    expect(getApiAuthFailureState(401, true)).toBe('SESSION_EXPIRED');
    expect(getApiAuthFailureState(403, true)).toBeNull();
  });
});
