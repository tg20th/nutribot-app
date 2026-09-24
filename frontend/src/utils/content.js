const asArray = (value) => Array.isArray(value) ? value : [];

// This adapter lets the UI accept different backend DTO field names.
export function normalizeContent(item = {}, fallbackType = 'Article') {
  const author = item.author ?? item.user ?? item.createdBy ?? {};
  const image = item.image ?? item.imageUrl ?? item.thumbnail ?? item.thumbnailUrl ?? item.coverImage ?? null;
  return { id: item.id ?? item._id ?? item.slug ?? `${item.title ?? 'story'}-${item.createdAt ?? Math.random()}`, type: item.type ?? item.contentType ?? fallbackType, title: item.title ?? item.name ?? 'Untitled story', description: item.description ?? item.summary ?? item.excerpt ?? '', image, videoUrl: item.videoUrl ?? item.url ?? item.mediaUrl ?? null, author: typeof author === 'string' ? author : author.name ?? author.fullName ?? 'NutriBot team', username: item.username ?? (typeof author === 'object' ? author.username : '') ?? '', avatar: item.avatar ?? author.avatar ?? author.avatarUrl ?? null, createdAt: item.createdAt ?? item.publishedAt ?? item.date ?? '', likes: item.likes ?? item.likeCount ?? 0, comments: item.comments ?? item.commentCount ?? 0, duration: item.duration ?? item.readingTime ?? item.readTime ?? '', tags: asArray(item.tags ?? item.categories) };
}
export const normalizeCollection = (items, type) => asArray(items).map((item) => normalizeContent(item, type));
