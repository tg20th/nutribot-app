import { apiRequest, unwrapData } from './apiClient';

export const getCurrentWeeklyMenu = async (signal, startDate) => {
  const query = startDate ? `?startDate=${encodeURIComponent(startDate)}` : '';
  return unwrapData(await apiRequest(`/api/v1/weekly-menus/current${query}`, { signal }), {});
};

export const getWeeklyMenuDishes = async (signal) => {
  const data = unwrapData(await apiRequest('/api/v1/dishes', { signal }), []);
  return Array.isArray(data) ? data : data.content ?? data.items ?? [];
};

export const createWeeklyMenu = async (payload) =>
  unwrapData(await apiRequest('/api/v1/weekly-menus', {
    method: 'POST',
    body: JSON.stringify(payload)
  }), {});

export const updateWeeklyMenu = async (id, payload) =>
  unwrapData(await apiRequest(`/api/v1/weekly-menus/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  }), {});

export const addWeeklyMenuItem = async (menuId, payload) =>
  unwrapData(await apiRequest(`/api/v1/weekly-menus/${menuId}/items`, {
    method: 'POST',
    body: JSON.stringify(payload)
  }), {});

export const deleteWeeklyMenuItem = async (menuId, itemId) =>
  unwrapData(await apiRequest(`/api/v1/weekly-menus/${menuId}/items/${itemId}`, {
    method: 'DELETE'
  }), {});
