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

const stepText = (step) => {
  if (typeof step === 'string') return step.trim();
  if (!step || typeof step !== 'object') return '';
  return String(step.description ?? step.instruction ?? step.text ?? '').trim();
};

const stripStepPrefix = (value) => value.replace(/^\s*(?:[-*•]\s+|\d{1,2}[.)]\s+)/, '').trim();

const parseNumberedSteps = (value) => {
  const markers = [...value.matchAll(/\b(\d{1,2})[.)]\s+/g)];
  if (markers.length < 2 || markers[0][1] !== '1') return null;
  if (!markers.every((marker, index) => Number(marker[1]) === index + 1)) return null;
  return markers.map((marker, index) => {
    const start = marker.index + marker[0].length;
    const end = markers[index + 1]?.index ?? value.length;
    return value.slice(start, end).trim();
  }).filter(Boolean);
};

export function normalizeCookingSteps(value) {
  if (Array.isArray(value)) {
    const values = value.map(stepText).filter(Boolean);
    return values.length === 1 ? normalizeCookingSteps(values[0]) : values;
  }
  if (typeof value !== 'string' || !value.trim()) return [];
  const text = value.trim();
  const numbered = parseNumberedSteps(text);
  if (numbered) return numbered;
  const lines = text.split(/\r?\n/).map(stripStepPrefix).filter(Boolean);
  return lines.length > 1 ? lines : [text];
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
    steps: normalizeCookingSteps(recipe.steps ?? recipe.instructions)
  };
}
