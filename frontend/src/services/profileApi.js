import { apiRequest, unwrapData } from './apiClient';
export const getMyProfile = async (signal) => unwrapData(await apiRequest('/api/v1/users/profile', { signal }), {});
export const updateMyProfile = async (payload) => unwrapData(await apiRequest('/api/v1/users/profile', { method: 'PUT', body: JSON.stringify(payload) }), {});
