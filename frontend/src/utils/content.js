const asArray = (value) => Array.isArray(value) ? value : [];

const contentType = (value, fallback) => {
  if (value === 'BLOG') return 'Article';
  if (value === 'VIDEO') return 'Video';
  return value ?? fallback;
};

const duration = (value) => {
  if (!Number.isFinite(Number(value))) return value ?? '';
  const totalSeconds = Number(value);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const tags = (item) => asArray(item.tags ?? item.categories)
  .map((tag) => typeof tag === 'string' ? tag : tag?.name)
  .filter(Boolean);

// This adapter lets the UI accept different backend DTO field names.
export function normalizeContent(item = {}, fallbackType = 'Article') {
  const author = item.author ?? item.user ?? item.createdBy ?? {};
  const image = item.image ?? item.imageUrl ?? item.image_url ?? item.thumbnail ?? item.thumbnailUrl ?? item.thumbnail_url ?? item.coverImage ?? item.cover_image ?? null;
  return {
    id: item.id ?? item.contentId ?? item._id ?? item.slug ?? `${item.title ?? 'story'}-${item.createdAt ?? Math.random()}`,
    slug: item.slug ?? null,
    type: contentType(item.type ?? item.contentType, fallbackType),
    title: item.title ?? item.name ?? 'Untitled story',
    description: item.description ?? item.summary ?? item.excerpt ?? item.body ?? '',
    image,
    videoUrl: item.videoUrl ?? item.url ?? item.mediaUrl ?? null,
    author: item.authorName ?? (typeof author === 'string' ? author : author.name ?? author.fullName) ?? 'NutriBot team',
    username: item.username ?? (typeof author === 'object' ? author.username : '') ?? '',
    avatar: item.avatar ?? item.avatarUrl ?? item.avatar_url ?? author.avatar ?? author.avatarUrl ?? author.avatar_url ?? null,
    createdAt: item.createdAt ?? item.publishedAt ?? item.date ?? '',
    likes: item.likes ?? item.likeCount ?? item.voteCount ?? 0,
    comments: item.comments ?? item.commentCount ?? 0,
    duration: duration(item.duration ?? item.durationSec ?? item.readingTime ?? item.readTime),
    tags: tags(item)
  };
}
export const normalizeCollection = (items, type) => asArray(items).map((item) => normalizeContent(item, type));
