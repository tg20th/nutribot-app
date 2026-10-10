import { apiRequest, unwrapData } from './apiClient';

// The catalog endpoint intentionally contains lightweight dish options and
// does not include recipe ingredients. Compatibility checks must use the
// canonical ingredient ids from the detail endpoint instead of guessing from
// display names.
export async function getDishCompatibilityDetails(dishId, signal) {
  const data = unwrapData(await apiRequest(`/api/v1/dishes/${encodeURIComponent(dishId)}`, { signal }), {});
  const recipe = data.recipe;
  if (!recipe || !Array.isArray(recipe.ingredients)) {
    return { ingredientIds: null, ingredients: null };
  }

  const ingredients = recipe.ingredients;
  const ingredientIds = ingredients.map((ingredient) => ingredient?.ingredientId ?? ingredient?.id ?? ingredient);
  const hasReliableIds = ingredientIds.every((ingredientId) => ingredientId !== null && ingredientId !== undefined && ingredientId !== '');
  return {
    ingredientIds: hasReliableIds ? ingredientIds.map(String) : null,
    ingredients: hasReliableIds ? ingredients : null
  };
}

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
