import { apiRequest, unwrapData } from './apiClient';
export const getMyProfile = async (signal) => unwrapData(await apiRequest('/api/users/me/profile', { signal }), {});
export const updateMyProfile = async (payload) => unwrapData(await apiRequest('/api/users/me/profile', { method: 'PUT', body: JSON.stringify(payload) }), {});
