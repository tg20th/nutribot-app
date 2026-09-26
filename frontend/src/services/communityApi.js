import { apiRequest, unwrapData } from './apiClient';

const itemsFrom = (payload) => {
  const data = unwrapData(payload);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.content)) return data.content;
  return [];
};

const normalizeComment = (item = {}) => ({
  ...item,
  id: item.id ?? item.commentId,
  author: item.authorName ?? item.author?.fullName ?? item.author?.name ?? item.user?.fullName ?? '',
  avatar: item.avatar ?? item.avatarUrl ?? item.avatar_url ?? item.author?.avatarUrl ?? item.author?.avatar_url ?? item.user?.avatarUrl ?? item.user?.avatar_url ?? null,
  text: item.text ?? item.body ?? item.content ?? '',
  time: item.time ?? item.createdAt ?? '',
  likes: item.likes ?? item.likeCount ?? 0
});

const normalizePost = (item = {}) => {
  const rawType = item.type ?? item.contentType ?? 'BLOG';
  const author = item.author ?? item.user ?? {};
  return {
    ...item,
    id: item.id ?? item.contentId,
    type: String(rawType).toUpperCase() === 'VIDEO' ? 'video' : 'blog',
    author: item.authorName ?? author.fullName ?? author.name ?? (typeof author === 'string' ? author : ''),
    username: item.username ?? author.username ?? '',
    avatar: item.avatar ?? item.avatarUrl ?? item.avatar_url ?? author.avatarUrl ?? author.avatar_url ?? null,
    image: item.image ?? item.imageUrl ?? item.image_url ?? item.thumbnailUrl ?? item.thumbnail_url ?? null,
    images: item.images ?? item.imageUrls ?? item.image_urls ?? [],
    description: item.description ?? item.summary ?? item.body ?? '',
    videoUrl: item.videoUrl ?? item.mediaUrl ?? null,
    likes: item.likes ?? item.likeCount ?? item.voteCount ?? 0,
    comments: typeof item.comments === 'number' ? item.comments : item.commentCount ?? 0,
    commentList: (item.commentList ?? item.commentsList ?? []).map(normalizeComment),
    shares: item.shares ?? item.shareCount ?? 0,
    userVoted: Boolean(item.userVoted)
  };
};

const getCollection = async (path, signal) => itemsFrom(await apiRequest(path, { signal })).map(normalizePost);

export async function getPosts(signal) {
  const results = await Promise.allSettled([
    getCollection('/api/v1/blogs?page=0&size=10', signal),
    getCollection('/api/v1/videos?page=0&size=10', signal)
  ]);
  const available = results.filter((result) => result.status === 'fulfilled').flatMap((result) => result.value);
  if (!available.length && results.every((result) => result.status === 'rejected')) throw results[0].reason;
  return available.sort((a, b) => new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0));
}

export async function getPost(id, signal) {
  try {
    return normalizePost(unwrapData(await apiRequest(`/api/v1/blogs/${id}`, { signal }), {}));
  } catch (blogError) {
    if (blogError.name === 'AbortError') throw blogError;
    return normalizePost(unwrapData(await apiRequest(`/api/v1/videos/${id}`, { signal }), {}));
  }
}

export const createPost = async (payload) => normalizePost(unwrapData(await apiRequest('/api/v1/blogs', {
  method: 'POST',
  body: JSON.stringify({ title: payload.title, body: payload.body ?? payload.title })
}), {}));

export const getPostComments = async (id, signal) => itemsFrom(await apiRequest(`/api/v1/contents/${id}/comments`, { signal })).map(normalizeComment);
export const createPostComment = async (id, payload) => normalizeComment(unwrapData(await apiRequest(`/api/v1/contents/${id}/comments`, {
  method: 'POST',
  body: JSON.stringify({ body: payload.body ?? payload.content, parentId: payload.parentId ?? null })
}), {}));
export const votePost = (id) => apiRequest(`/api/v1/contents/${id}/vote`, { method: 'POST' });
export const removeVote = (id) => apiRequest(`/api/v1/contents/${id}/vote`, { method: 'DELETE' });
export const getCommunityFilters = async (signal) => itemsFrom(await apiRequest('/api/v1/categories?type=RECIPE', { signal }))
  .map((item) => item.name ?? item.categoryName ?? item.label)
  .filter(Boolean);
