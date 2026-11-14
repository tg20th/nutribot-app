import { describe, expect, it } from 'vitest';
import { otpErrorState } from '../AuthModal';

describe('email verification error mapping', () => {
  it('maps an invalid verification code to invalid', () => {
    expect(otpErrorState({ message: 'Invalid verification code. Please try again.' })).toBe('invalid');
  });

  it('keeps expired and already-used codes distinct', () => {
    expect(otpErrorState({ payload: { message: 'This verification code has expired. Please request a new one.' } })).toBe('expired');
    expect(otpErrorState({ message: 'This verification code has already been used.' })).toBe('alreadyUsed');
  });
});
