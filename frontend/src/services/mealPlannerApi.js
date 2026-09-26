import { apiRequest, unwrapData } from './apiClient';

export const generateMealPlan = async (payload, signal) =>
  unwrapData(await apiRequest('/api/v1/meal-planner/generate', {
    method: 'POST',
    body: JSON.stringify(payload),
    signal,
  }), {});
