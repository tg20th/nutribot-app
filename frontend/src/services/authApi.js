import { apiRequest, unwrapData } from './apiClient';

export async function registerAccount(payload) {
  const response = await apiRequest('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  return unwrapData(response, {});
}
