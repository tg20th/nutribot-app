import { apiRequest, unwrapData } from './apiClient';
import { normalizePost } from './communityApi';

// Backend contract (PublicUserController):
//   GET /api/v1/users/{idOrUsername}            -> PublicUserProfileResponse (không email/health/chat)
//   GET /api/v1/users/{idOrUsername}/posts?type=BLOG|VIDEO&page&size -> PagedResponse<ContentListResponse>
// `type` là tham số bắt buộc; chỉ trả bài published. Backend nhận cả userId số lẫn username.

const fetchPage = async (path, { page, size, type, signal }) => {
  const data = unwrapData(await apiRequest(
    `${path}?type=${encodeURIComponent(type)}&page=${page}&size=${size}`,
    { signal }
  ), {});
  const items = Array.isArray(data) ? data : data.content ?? data.items ?? [];
  return { items, last: Boolean(data.last) };
};

export async function getPublicProfile(userIdOrUsername, signal) {
  const data = unwrapData(await apiRequest(`/api/v1/users/${encodeURIComponent(userIdOrUsername)}`, { signal }), {});
  const stats = data.stats ?? {};
  const blogCount = stats.publishedBlogCount ?? 0;
  const videoCount = stats.publishedVideoCount ?? 0;
  return {
    ...data,
    userId: data.userId ?? data.id ?? userIdOrUsername,
    displayName: data.displayName ?? data.fullName ?? data.name ?? data.username ?? '',
    username: data.username ?? '',
    avatarUrl: data.avatarUrl ?? data.avatar ?? null,
    bio: data.bio ?? '',
    joinedAt: data.joinedAt ?? data.createdAt ?? null,
    stats: {
      ...stats,
      posts: blogCount + videoCount,
      approvedRecipeContributions: stats.verifiedRecipeCount ?? 0
    }
  };
}

export async function getPublicProfileContent(userIdOrUsername, { page = 0, size = 18, signal } = {}) {
  const path = `/api/v1/users/${encodeURIComponent(userIdOrUsername)}/posts`;
  const [blogs, videos] = await Promise.all([
    fetchPage(path, { page, size, type: 'BLOG', signal }),
    fetchPage(path, { page, size, type: 'VIDEO', signal })
  ]);
  const posts = [...blogs.items, ...videos.items]
    .map((item) => normalizePost(item, item.contentType))
    .sort((a, b) => new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0));
  return { posts, last: blogs.last && videos.last };
}

export async function getPublicProfileRecipes(userIdOrUsername, { signal } = {}) {
  void userIdOrUsername;
  void signal;
  // Backend chưa có endpoint public recipe theo user (recipe chỉ hiển thị qua stats verifiedRecipeCount).
  return { recipes: [], last: true, unavailable: true };
}
