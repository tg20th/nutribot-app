import { describe, expect, it } from 'vitest';
import { getEmailChangeOtpErrorMessage } from '../profileApi';

describe('Edit Profile email-change OTP errors', () => {
  it('maps an invalid backend OTP response', () => {
    expect(getEmailChangeOtpErrorMessage({ payload: { message: 'Invalid verification code. Please try again.' } }))
      .toBe('Invalid verification code. Please try again.');
  });

  it('keeps expired and used responses distinct', () => {
    expect(getEmailChangeOtpErrorMessage({ message: 'This verification code has expired. Please request a new one.' }))
      .toBe('This verification code has expired. Please request a new one.');
    expect(getEmailChangeOtpErrorMessage({ message: 'This verification code has already been used.' }))
      .toBe('This verification code has already been used.');
  });
});
