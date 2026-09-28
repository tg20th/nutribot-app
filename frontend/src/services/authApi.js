import { apiRequest, unwrapData } from './apiClient';

export async function registerAccount(payload) {
  const response = await apiRequest('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  return unwrapData(response, {});
}

export async function loginAccount(payload) {
  const response = await apiRequest('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  return unwrapData(response, {});
}

export async function verifyRegistrationOtp({ email, otpCode }) {
  const response = await apiRequest('/api/v1/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ email, otpCode })
  });

  return unwrapData(response, {});
}

export async function resendRegistrationOtp(email) {
  const response = await apiRequest(`/api/v1/auth/resend-otp?email=${encodeURIComponent(email)}`, {
    method: 'POST'
  });

  return unwrapData(response, null);
}
