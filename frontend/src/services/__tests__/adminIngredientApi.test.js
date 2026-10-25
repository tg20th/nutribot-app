import { afterEach, describe, expect, it, vi } from 'vitest';
import { adminIngredientApi } from '../adminIngredientApi';

const ok = (data) => ({ ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => ({ success: true, message: 'Success', data }) });

describe('NB-91 admin ingredient API contract', () => {
  afterEach(() => vi.restoreAllMocks());

  it('lists ingredients with the backend search and status filters', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(ok({ content: [{ ingredientId: 9, name: 'Oats', slug: 'oats', categoryId: 3, active: true }], totalPages: 2 }));
    const page = await adminIngredientApi.getIngredients({ keyword: 'oat', categoryId: 3, active: true, page: 1, size: 10 });
    expect(fetchMock.mock.calls[0][0]).toContain('/api/v1/admin/ingredients?page=1&size=10&keyword=oat&categoryId=3&active=true');
    expect(page.content[0]).toEqual(expect.objectContaining({ id: 9, name: 'Oats', active: true }));
  });

  it('normalizes Vietnamese diacritics before searching the catalog', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(ok({ content: [], totalPages: 0 }));
    await adminIngredientApi.getIngredients({ keyword: 'Phụ gia' });
    expect(fetchMock.mock.calls[0][0]).toContain('keyword=phu+gia');
  });

  it('creates an ingredient and sends only the NB-90 request fields', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(ok({ ingredientId: 9, name: 'Oats', slug: 'oats', categoryId: 3, active: true }));
    await adminIngredientApi.createIngredient({ name: ' Oats ', slug: ' oats ', description: ' Whole grain ', categoryId: '3' });
    expect(fetchMock.mock.calls[0][0]).toContain('/api/v1/admin/ingredients');
    expect(fetchMock.mock.calls[0][1]).toEqual(expect.objectContaining({ method: 'POST', body: JSON.stringify({ name: 'Oats', slug: 'oats', description: 'Whole grain', categoryId: 3 }) }));
  });

  it('uses the soft-status endpoint instead of deleting an ingredient', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(ok({ ingredientId: 9, active: false }));
    await adminIngredientApi.setIngredientStatus(9, false);
    expect(fetchMock.mock.calls[0][0]).toContain('/api/v1/admin/ingredients/9/status');
    expect(fetchMock.mock.calls[0][1]).toEqual(expect.objectContaining({ method: 'PUT', body: JSON.stringify({ active: false }) }));
  });
});
