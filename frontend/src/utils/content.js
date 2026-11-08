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

const plainTextBlockTags = new Set(['address', 'article', 'blockquote', 'div', 'dl', 'fieldset', 'footer', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'li', 'main', 'nav', 'ol', 'p', 'pre', 'section', 'table', 'tr', 'ul']);

function decodeHtmlEntities(value) {
  if (typeof document === 'undefined') return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
  const decoder = document.createElement('textarea');
  decoder.innerHTML = value;
  return decoder.value;
}

/** Convert legacy rich-text HTML to readable text without injecting markup. */
export function htmlToPlainText(value) {
  if (typeof value !== 'string' || !value) return '';
  if (!/<[a-z][\s\S]*>/i.test(value)) return decodeHtmlEntities(value).replace(/\u00a0/g, ' ');
  if (typeof document === 'undefined') {
    return decodeHtmlEntities(value
      .replace(/<!--\s*[\s\S]*?-->/g, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|h[1-6]|li|blockquote|tr)>/gi, '\n')
      .replace(/<[^>]*>/g, ''))
      .replace(/\r\n?/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
  const root = document.createElement('div');
  root.innerHTML = value;
  let output = '';
  const appendBreak = () => { if (output && !output.endsWith('\n')) output += '\n'; };
  const visit = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      output += node.nodeValue || '';
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const tag = node.tagName.toLowerCase();
    if (['script', 'style', 'iframe', 'object'].includes(tag)) return;
    if (tag === 'br') { output += '\n'; return; }
    const block = plainTextBlockTags.has(tag);
    if (block) appendBreak();
    [...node.childNodes].forEach(visit);
    if (block) appendBreak();
  };
  [...root.childNodes].forEach(visit);
  return decodeHtmlEntities(output)
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n?/g, '\n')
    .split('\n').map((line) => line.replace(/[ \t]+$/g, '')).join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export const extractStoryText = (value) => {
  if (!value || typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object') {
        const story = parsed.story || parsed.description || '';
        return typeof story === 'string' ? story.trim() : '';
      }
    } catch {
      return '';
    }
  }
  return htmlToPlainText(value);
};

export const cleanExcerpt = (value, maxLength) => {
  const text = extractStoryText(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.!?;:])/g, '$1')
    .trim();
  return Number.isFinite(maxLength) ? text.slice(0, maxLength) : text;
};

// This adapter lets the UI accept different backend DTO field names.
export function normalizeContent(item = {}, fallbackType = 'Article') {
  const author = item.author ?? item.user ?? item.createdBy ?? {};
  const image = item.image ?? item.imageUrl ?? item.image_url ?? item.thumbnail ?? item.thumbnailUrl ?? item.thumbnail_url ?? item.coverImage ?? item.cover_image ?? null;
  return {
    id: item.id ?? item.contentId ?? item._id ?? item.slug ?? `${item.title ?? 'story'}-${item.createdAt ?? Math.random()}`,
    slug: item.slug ?? null,
    type: contentType(item.type ?? item.contentType, fallbackType),
    title: item.title ?? item.name ?? 'Untitled story',
    description: cleanExcerpt(item.description ?? item.summary ?? item.excerpt ?? item.body ?? ''),
    image,
    videoUrl: item.videoUrl ?? item.url ?? item.mediaUrl ?? null,
    author: item.authorName ?? (typeof author === 'string' ? author : author.name ?? author.fullName) ?? 'NutriBot team',
    username: item.authorUsername ?? item.username ?? (typeof author === 'object' ? author.username : '') ?? '',
    avatar: item.avatar ?? item.avatarUrl ?? item.avatar_url ?? item.authorAvatar ?? item.userAvatar ?? author.avatar ?? author.avatarUrl ?? author.avatar_url ?? null,
    createdAt: item.createdAt ?? item.publishedAt ?? item.date ?? '',
    likes: item.likes ?? item.likeCount ?? item.voteCount ?? 0,
    comments: item.comments ?? item.commentCount ?? 0,
    duration: duration(item.duration ?? item.durationSec ?? item.readingTime ?? item.readTime),
    tags: tags(item)
  };
}
export const normalizeCollection = (items, type) => asArray(items).map((item) => normalizeContent(item, type));

export function formatPostDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(date);
}
