import { apiRequest, unwrapData } from './apiClient';
export const getRestaurants = async (signal) => unwrapData(await apiRequest('/api/restaurants', { signal }));
