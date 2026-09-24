import { apiRequest, unwrapData } from './apiClient';
export const getCurrentWeeklyMenu = async (signal) => unwrapData(await apiRequest('/api/v1/weekly-menus/current', { signal }), {});
export const updateWeeklyMenu = async (id, payload) => unwrapData(await apiRequest(`/api/weekly-menus/${id}`, { method: 'PUT', body: JSON.stringify(payload) }), {});
