import { apiRequest, unwrapData } from './apiClient';
import { normalizePost } from './communityApi';
import { getMockPublicProfile, getMockPublicProfileContent, getMockPublicProfileRecipes } from './mockPublicProfileData';

export const isMockPublicProfileEnabled = import.meta.env.VITE_USE_MOCK_PUBLIC_PROFILE === 'true';

// The public profile contract is intentionally isolated. The current backend
// does not expose this resource yet; keeping the adapter here makes the
// dependency explicit and prevents the UI from treating private profile data
// as public content.
export async function getPublicProfile(userId, signal) {
  if (isMockPublicProfileEnabled) return getMockPublicProfile(userId, signal);
  const data = unwrapData(await apiRequest(`/api/v1/users/${encodeURIComponent(userId)}/public-profile`, { signal }), {});
  return {
    ...data,
    userId: data.userId ?? data.id ?? userId,
    displayName: data.displayName ?? data.fullName ?? data.name ?? data.username ?? '',
    username: data.username ?? '',
    avatarUrl: data.avatarUrl ?? data.avatar ?? null,
    bio: data.bio ?? '',
    joinedAt: data.joinedAt ?? data.createdAt ?? null,
    stats: data.stats ?? {}
  };
}

export async function getPublicProfileContent(userId, { page = 0, size = 18, signal } = {}) {
  if (isMockPublicProfileEnabled) return getMockPublicProfileContent(userId, { page, size, signal });
  const data = unwrapData(await apiRequest(`/api/v1/users/${encodeURIComponent(userId)}/public-content?page=${page}&size=${size}`, { signal }), {});
  const posts = (Array.isArray(data) ? data : data.content ?? data.items ?? []).map((item) => normalizePost(item, item.contentType));
  return { posts, last: Boolean(data.last ?? !data.nextPage) };
}

export async function getPublicProfileRecipes(userId, { page = 0, size = 12, signal } = {}) {
  if (isMockPublicProfileEnabled) return getMockPublicProfileRecipes(userId, { page, size, signal });
  const data = unwrapData(await apiRequest(`/api/v1/users/${encodeURIComponent(userId)}/public-recipes?page=${page}&size=${size}`, { signal }), {});
  return { recipes: Array.isArray(data) ? data : data.content ?? data.items ?? [], last: Boolean(data.last ?? !data.nextPage) };
}
