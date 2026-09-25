import { apiRequest, unwrapData } from './apiClient';
export const getMyProfile = async (signal) => unwrapData(await apiRequest('/api/v1/users/profile', { signal }), {});
export const updateMyProfile = async (payload) => {
  const profile = unwrapData(await apiRequest('/api/v1/users/profile', { method: 'PUT', body: JSON.stringify(payload) }), {});
  if (profile.token) localStorage.setItem('nutribot-auth-token', profile.token);
  return profile;
};
export const updateMyAvatar = async (file) => {
  const body = new FormData();
  body.append('file', file);
  return unwrapData(await apiRequest('/api/v1/users/profile/avatar', { method: 'PUT', body }), {});
};
export const uploadMyAvatar = updateMyAvatar;
export const deleteMyAvatar = async () => unwrapData(await apiRequest('/api/v1/users/profile/avatar', { method: 'DELETE' }), {});
export const getHealthProfile = async (signal) => unwrapData(await apiRequest('/api/v1/users/profile/health', { signal }), {});
export const updateHealthProfile = async (payload) => unwrapData(await apiRequest('/api/v1/users/profile/health', { method: 'PUT', body: JSON.stringify(payload) }), {});
export const getAllergyIngredients = async (signal) => unwrapData(await apiRequest('/api/v1/ingredients', { signal }), []);
