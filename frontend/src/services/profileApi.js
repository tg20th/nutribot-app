import { apiRequest, unwrapData } from './apiClient';
export const getMyProfile = async (signal) => unwrapData(await apiRequest('/api/v1/users/profile', { signal }), {});
export const updateMyProfile = async (payload) => unwrapData(await apiRequest('/api/v1/users/profile', { method: 'PUT', body: JSON.stringify(payload) }), {});
export const updateMyAvatar = async (file) => {
  const body = new FormData();
  body.append('avatar', file);
  return unwrapData(await apiRequest('/api/v1/users/profile/avatar', { method: 'PUT', body }), {});
};
export const deleteMyAvatar = async () => unwrapData(await apiRequest('/api/v1/users/profile/avatar', { method: 'DELETE' }), {});
