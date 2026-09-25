import { apiRequest, unwrapData } from './apiClient';
export const getMyProfile = async (signal) => unwrapData(await apiRequest('/api/v1/users/profile', { signal }), {});
export const updateMyProfile = async (payload) => {
  const profile = unwrapData(await apiRequest('/api/v1/users/profile', { method: 'PUT', body: JSON.stringify(payload) }), {});
  if (profile.token) localStorage.setItem('nutribot-auth-token', profile.token);
  return profile;
};

export const uploadMyAvatar = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return unwrapData(await apiRequest('/api/v1/users/profile/avatar', { method: 'PUT', body: formData }), {});
};
