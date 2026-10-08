import { apiRequest, unwrapData } from './apiClient';

export async function getDishDetail(dishId, signal) {
  const data = unwrapData(await apiRequest(`/api/v1/dishes/${encodeURIComponent(dishId)}`, { signal }), {});
  const recipe = data.recipe ?? {};
  return {
    dishId: data.dishId ?? data.id,
    name: data.name ?? data.dishName ?? '',
    imageUrl: data.imageUrl ?? data.image ?? null,
    calories: data.calories ?? data.kcal ?? null,
    proteinG: data.proteinG ?? data.protein ?? null,
    carbsG: data.carbsG ?? null,
    fatG: data.healthyFatsG ?? data.fatG ?? null,
    servings: recipe.servings ?? null,
    prepTimeMinutes: recipe.prepTimeMin ?? null,
    cookTimeMinutes: recipe.cookTimeMin ?? null,
    ingredients: Array.isArray(recipe.ingredients) ? recipe.ingredients : [],
    steps: Array.isArray(recipe.steps) ? recipe.steps
         : (recipe.instructions ? [{ description: recipe.instructions }] : [])
  };
}
