import { afterEach, describe, expect, it, vi } from 'vitest';
import { mapRecipeConsentRequest, recipeConsentRequestsApi } from '../recipeConsentRequestsApi';

const ok = (data) => ({
  ok: true,
  status: 200,
  headers: { get: () => 'application/json' },
  json: async () => ({ success: true, message: 'Success', data }),
});

describe('NB-85 recipe consent request API adapter', () => {
  afterEach(() => vi.restoreAllMocks());

  it('maps a user-owned request with post and expiry details', () => {
    expect(mapRecipeConsentRequest({
      requestId: 85, status: 'PENDING', expiresAt: '2026-10-27T02:00:00Z', requestedByName: 'Admin',
      sourceContent: { contentId: 12, title: 'A balanced bowl', contentType: 'BLOG', recipeName: 'Balanced bowl' },
    })).toMatchObject({
      requestId: 85, status: 'PENDING', requesterName: 'Admin',
      post: { contentId: 12, title: 'A balanced bowl', recipeName: 'Balanced bowl' },
    });
  });

  it('sends the user decision through the consent response endpoint', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(ok({
      requestId: 85, status: 'APPROVED_BY_USER', sourceContent: { contentId: 12, title: 'A balanced bowl' },
    }));

    await recipeConsentRequestsApi.respond(85, 'ACCEPT');

    expect(fetchMock.mock.calls[0][0]).toContain('/api/v1/recipe-consent-requests/85/response');
    expect(fetchMock.mock.calls[0][1]).toEqual(expect.objectContaining({
      method: 'PUT', body: JSON.stringify({ action: 'ACCEPT' }),
    }));
  });
});
