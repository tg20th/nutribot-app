import { apiRequest, unwrapData } from './apiClient';

export async function getDishDetail(dishId, signal) {
  const data = unwrapData(await apiRequest(`/api/v1/dishes/${encodeURIComponent(dishId)}`, { signal }), {});
  return {
    dishId: data.dishId ?? data.id,
    name: data.name ?? data.dishName ?? '', imageUrl: data.imageUrl ?? data.image ?? null,
    calories: data.calories ?? data.kcal ?? null, proteinG: data.proteinG ?? data.protein ?? null,
    carbsG: data.carbsG ?? null, fatG: data.fatG ?? null, servings: data.servings ?? null,
    prepTimeMinutes: data.prepTimeMinutes ?? null, cookTimeMinutes: data.cookTimeMinutes ?? null,
    ingredients: Array.isArray(data.ingredients) ? data.ingredients : [],
    steps: Array.isArray(data.steps ?? data.recipeSteps) ? (data.steps ?? data.recipeSteps) : []
  };
}
