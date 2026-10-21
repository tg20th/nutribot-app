import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '../apiClient';
import { getPublicProfileRecipes } from '../publicProfileApi';

vi.mock('../apiClient', () => ({
  apiRequest: vi.fn(),
  unwrapData: (payload, fallback = {}) => payload?.data ?? fallback
}));

describe('public profile recipes API', () => {
  beforeEach(() => vi.resetAllMocks());

  it('loads recipes from the real public endpoint without mock references', async () => {
    apiRequest.mockResolvedValue({ data: [{ id: 12, name: 'Bowl' }] });

    await expect(getPublicProfileRecipes('lan', { signal: undefined })).resolves.toEqual({
      recipes: [{ id: 12, name: 'Bowl' }],
      last: true
    });
    expect(apiRequest).toHaveBeenCalledWith('/api/v1/users/lan/recipes', { signal: undefined });
  });
});
