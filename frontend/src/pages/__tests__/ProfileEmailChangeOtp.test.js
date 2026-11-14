import { describe, expect, it } from 'vitest';
import { normalizeEmailChangeVerificationError } from '../ProfilePage';

describe('Edit Profile email-change verification flow', () => {
  it('normalizes an invalid OTP rejection for the verification state machine', () => {
    expect(normalizeEmailChangeVerificationError({
      payload: { message: 'Invalid verification code. Please try again.' },
    }).message).toBe('Invalid verification code. Please try again.');
  });

  it('preserves the expired message and server failures', () => {
    expect(normalizeEmailChangeVerificationError({ message: 'This verification code has expired. Please request a new one.' }).message)
      .toBe('This verification code has expired. Please request a new one.');
    expect(normalizeEmailChangeVerificationError({ message: 'Service temporarily unavailable.' }).message)
      .toBe('Service temporarily unavailable.');
    expect(normalizeEmailChangeVerificationError({ status: 400, message: 'Database constraint failure.' }).message)
      .toBe('Database constraint failure.');
  });
});
