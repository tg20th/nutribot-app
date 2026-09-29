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

const normalizePost = (item = {}, fallbackType = 'BLOG') => {
  const rawType = item.type ?? item.contentType ?? fallbackType;
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
    prepTime: item.prepTime ?? item.prepTimeMin ?? 0,
    cookTime: item.cookTime ?? item.cookTimeMin ?? 0,
    servings: item.servings ?? 0,
    calories: item.calories ?? 0,
    protein: item.protein ?? item.proteinG ?? 0,
    nutrition: item.nutrition ?? {
      carbs: item.carbs ?? item.carbsG ?? 0,
      fat: item.fat ?? item.fatG ?? 0,
      fiber: item.fiber ?? item.fiberG ?? 0,
      sodium: item.sodium ?? item.sodiumMg ?? 0,
    },
    pantryItems: item.pantryItems ?? item.ingredients ?? [],
    steps: item.steps ?? [],
    likes: item.likes ?? item.likeCount ?? item.voteCount ?? 0,
    comments: typeof item.comments === 'number' ? item.comments : item.commentCount ?? 0,
    commentList: (item.commentList ?? item.commentsList ?? []).map(normalizeComment),
    shares: item.shares ?? item.shareCount ?? 0,
    userVoted: Boolean(item.userVoted)
  };
};

const getCollection = async (path, signal, type) => {
  const data = unwrapData(await apiRequest(path, { signal }), {});
  return {
    posts: (Array.isArray(data?.content) ? data.content : itemsFrom(data)).map((item) => normalizePost(item, type)),
    last: Boolean(data?.last)
  };
};

export async function getPostsPage({ blogPage, videoPage, signal }) {
  const requests = [
    blogPage == null ? null : getCollection(`/api/v1/blogs?page=${blogPage}&size=10`, signal, 'BLOG'),
    videoPage == null ? null : getCollection(`/api/v1/videos?page=${videoPage}&size=10`, signal, 'VIDEO')
  ];
  const results = await Promise.allSettled(requests.map((request) => request ?? Promise.resolve(null)));
  const available = results
    .filter((result) => result.status === 'fulfilled' && result.value)
    .flatMap((result) => result.value.posts);
  if (!available.length && results.every((result) => result.status === 'rejected')) throw results[0].reason;
  return {
    posts: available.sort((a, b) => new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0)),
    blogLast: blogPage == null || (results[0].status === 'fulfilled' && results[0].value?.last),
    videoLast: videoPage == null || (results[1].status === 'fulfilled' && results[1].value?.last)
  };
}

export async function getPosts(signal) {
  const result = await getPostsPage({ blogPage: 0, videoPage: 0, signal });
  return result.posts;
}

export async function getPost(id, signal) {
  try {
    return normalizePost(unwrapData(await apiRequest(`/api/v1/blogs/id/${id}`, { signal }), {}), 'BLOG');
  } catch (blogError) {
    if (blogError.name === 'AbortError') throw blogError;
    if (blogError.status !== 400 && blogError.status !== 404) throw blogError;
    return normalizePost(unwrapData(await apiRequest(`/api/v1/videos/id/${id}`, { signal }), {}), 'VIDEO');
  }
}

export const createPost = async (payload) => normalizePost(unwrapData(await apiRequest('/api/v1/blogs', {
  method: 'POST',
  body: JSON.stringify({ title: payload.title, body: payload.body ?? payload.title })
}), {}));

export const getCommunityFilters = async (signal) => itemsFrom(await apiRequest('/api/v1/categories?type=RECIPE', { signal }))
  .map((item) => item.name ?? item.categoryName ?? item.label)
  .filter(Boolean);
