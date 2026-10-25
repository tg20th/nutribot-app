import { apiRequest, unwrapData } from './apiClient';

const mapIngredient = (ingredient = {}) => ({
  id: ingredient.ingredientId,
  name: ingredient.name ?? '',
  slug: ingredient.slug ?? '',
  description: ingredient.description ?? '',
  categoryId: ingredient.categoryId ?? '',
  active: Boolean(ingredient.active),
  createdAt: ingredient.createdAt ?? null,
  allergyReferenceCount: Number(ingredient.allergyReferenceCount ?? 0),
  recipeReferenceCount: Number(ingredient.recipeReferenceCount ?? 0),
});

const normalizeSearchKeyword = (value = '') => value.trim().toLowerCase().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');

const query = ({ keyword = '', categoryId = '', active = '', page = 0, size = 10 } = {}) => {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (keyword.trim()) params.set('keyword', normalizeSearchKeyword(keyword));
  if (categoryId !== '') params.set('categoryId', String(categoryId));
  if (active !== '') params.set('active', String(active));
  return params.toString();
};

const payloadFor = ({ name, slug, description, categoryId }) => ({
  name: name.trim(), slug: slug.trim(), description: description.trim() || null, categoryId: Number(categoryId),
});

export const adminIngredientApi = {
  async getIngredients(params, signal) {
    const payload = await apiRequest(`/api/v1/admin/ingredients?${query(params)}`, { signal });
    const page = unwrapData(payload, {});
    return { ...page, content: (page.content ?? []).map(mapIngredient) };
  },
  async getCategories(signal) {
    const payload = await apiRequest('/api/v1/categories', { signal });
    return unwrapData(payload, []).filter((category) => category.categoryType === 'INGREDIENT' && category.active !== false)
      .map((category) => ({ id: category.categoryId, name: category.categoryName }));
  },
  async createIngredient(data) {
    const payload = await apiRequest('/api/v1/admin/ingredients', { method: 'POST', body: JSON.stringify(payloadFor(data)) });
    return mapIngredient(unwrapData(payload, {}));
  },
  async updateIngredient(id, data) {
    const payload = await apiRequest(`/api/v1/admin/ingredients/${id}`, { method: 'PUT', body: JSON.stringify(payloadFor(data)) });
    return mapIngredient(unwrapData(payload, {}));
  },
  async setIngredientStatus(id, active) {
    const payload = await apiRequest(`/api/v1/admin/ingredients/${id}/status`, { method: 'PUT', body: JSON.stringify({ active }) });
    return mapIngredient(unwrapData(payload, {}));
  },
};
