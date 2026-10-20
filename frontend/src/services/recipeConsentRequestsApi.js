import { apiRequest, unwrapData } from './apiClient';

const basePath = '/api/v1/recipe-consent-requests';

const previewMode = () => import.meta.env.DEV && typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).get('preview') === '1';

let previewRequests = [
  {
    requestId: 851, status: 'PENDING', createdAt: '2026-10-20T02:00:00Z', expiresAt: '2026-10-27T02:00:00Z',
    requesterName: 'NutriBot moderation team', post: {
      contentId: 64, title: 'Warm lentil bowl for busy weekdays', contentType: 'BLOG',
      excerpt: 'A practical plant-forward bowl with red lentils, roasted carrots, greens, and a bright lemon dressing.',
      recipeName: 'Warm lentil bowl', imageUrl: '',
    },
  },
  {
    requestId: 852, status: 'APPROVED_BY_USER', createdAt: '2026-10-15T03:10:00Z', respondedAt: '2026-10-16T08:42:00Z',
    requesterName: 'NutriBot moderation team', post: { contentId: 58, title: 'Five-minute tofu breakfast', contentType: 'VIDEO', excerpt: 'A short breakfast recipe with tofu, herbs, and whole-grain toast.', recipeName: 'Herbed tofu toast' },
  },
  {
    requestId: 853, status: 'EXPIRED', createdAt: '2026-10-01T03:10:00Z', expiresAt: '2026-10-08T03:10:00Z',
    requesterName: 'NutriBot moderation team', post: { contentId: 31, title: 'Creamy mushroom barley soup', contentType: 'BLOG', excerpt: 'Comforting mushroom soup submitted by the community.', recipeName: 'Mushroom barley soup' },
  },
];

const object = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const array = (value) => Array.isArray(value) ? value : [];

export function mapRecipeConsentRequest(raw) {
  const value = object(raw);
  const post = object(value.post ?? value.sourceContent ?? value.content);
  return {
    requestId: value.requestId ?? value.id,
    status: String(value.status ?? 'PENDING').toUpperCase(),
    createdAt: value.createdAt ?? value.requestedAt ?? null,
    expiresAt: value.expiresAt ?? value.expiredAt ?? null,
    respondedAt: value.respondedAt ?? value.reviewedAt ?? null,
    requesterName: value.requesterName ?? value.requestedByName ?? value.actorName ?? 'NutriBot team',
    responseReason: value.responseReason ?? value.rejectionReason ?? '',
    post: {
      contentId: post.contentId ?? post.id ?? value.contentId ?? null,
      title: post.title ?? value.contentTitle ?? 'Untitled post',
      contentType: String(post.contentType ?? post.type ?? value.contentType ?? 'BLOG').toUpperCase(),
      excerpt: post.excerpt ?? post.description ?? post.bodyPreview ?? '',
      recipeName: post.recipeName ?? value.recipeName ?? value.dishName ?? 'Recipe from this post',
      imageUrl: post.imageUrl ?? post.thumbnailUrl ?? post.image ?? '',
    },
  };
}

export const recipeConsentRequestsApi = {
  async listMine(signal) {
    if (previewMode()) return previewRequests.map(mapRecipeConsentRequest);
    const result = unwrapData(await apiRequest(`${basePath}/mine`, { signal }), []);
    return array(result.content ?? result.items ?? result).map(mapRecipeConsentRequest);
  },

  async respond(requestId, action) {
    if (previewMode()) {
      const index = previewRequests.findIndex((request) => request.requestId === Number(requestId));
      const request = previewRequests[index];
      if (!request || request.status !== 'PENDING') {
        const error = new Error('This request is no longer available for a response.');
        error.status = 409;
        throw error;
      }
      previewRequests[index] = { ...request, status: action === 'ACCEPT' ? 'APPROVED_BY_USER' : 'REJECTED_BY_USER', respondedAt: new Date().toISOString() };
      return mapRecipeConsentRequest(previewRequests[index]);
    }
    const result = unwrapData(await apiRequest(`${basePath}/${requestId}/response`, {
      method: 'PUT', body: JSON.stringify({ action }),
    }), {});
    return mapRecipeConsentRequest(result);
  },
};
