import { describe, expect, it } from 'vitest';
import { getApiAuthFailureState, getLoginErrorMessage, getLoginErrorState, getOAuthErrorState } from '../loginErrorState';

describe('getLoginErrorState', () => {
  it('recognizes only the backend blocked-account login message', () => {
    expect(getLoginErrorState({ status: 400, message: 'Tài khoản đã bị khóa hoặc tạm ngưng hoạt động' })).toBe('ACCOUNT_BLOCKED');
    expect(getLoginErrorMessage('ACCOUNT_BLOCKED')).toMatch(/suspended or locked/i);
  });

  it('keeps credentials and email-verification failures distinct', () => {
    expect(getLoginErrorState({ status: 400, message: 'Tài khoản hoặc mật khẩu không chính xác' })).toBe('INVALID_CREDENTIALS');
    expect(getLoginErrorState({ status: 400, message: 'Tài khoản chưa xác thực email. Vui lòng kiểm tra hộp thư.' })).toBe('PENDING_VERIFY');
  });

  it('does not treat another 400 or network/server failures as blocked accounts', () => {
    expect(getLoginErrorState({ status: 400, message: 'Dữ liệu không hợp lệ' })).toBe('LOGIN_ERROR');
    expect(getLoginErrorState(new Error('Failed to fetch'))).toBe('NETWORK_ERROR');
    expect(getLoginErrorState({ status: 500, message: 'Internal server error' })).toBe('SERVER_ERROR');
  });

  it('centralizes OAuth and expired-session failure states', () => {
    expect(getOAuthErrorState({ error: 'access_denied' })).toBe('OAUTH_FAILED');
    expect(getOAuthErrorState({ token: 'token', username: 'lan', role: 'ROLE_USER' })).toBeNull();
    expect(getApiAuthFailureState(401, true)).toBe('SESSION_EXPIRED');
    expect(getApiAuthFailureState(403, true)).toBeNull();
  });
});
