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
  author: item.authorName ?? item.userName ?? item.author?.fullName ?? item.author?.name ?? item.user?.fullName ?? '',
  avatar: item.avatar ?? item.avatarUrl ?? item.avatar_url ?? item.authorAvatar ?? item.userAvatar ?? item.author?.avatarUrl ?? item.author?.avatar_url ?? item.user?.avatarUrl ?? item.user?.avatar_url ?? null,
  text: item.text ?? item.body ?? item.content ?? '',
  time: item.time ?? item.createdAt ?? '',
  likes: item.likes ?? item.likeCount ?? 0
});

export function stripHtmlToCleanText(html = '') {
  if (!html || typeof html !== 'string') return '';
  if (!/<[a-z][\s\S]*>/i.test(html)) return html.trim();
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n\n');
}

function parseFactLines(lines = [], data = {}) {
  const facts = {};
  for (const line of lines) {
    const idx = line.indexOf(':');
    if (idx !== -1) {
      facts[line.substring(0, idx).trim().toLowerCase()] = line.substring(idx + 1).trim();
    }
  }
  if (facts['calories']) {
    const num = parseInt(facts['calories'].replace(/[^\d]/g, ''), 10);
    if (!isNaN(num)) data.calories = num;
  }
  if (facts['protein']) {
    const num = parseFloat(facts['protein'].replace(/[^\d.]/g, ''));
    if (!isNaN(num)) data.protein = num;
  }
  const nutrition = {};
  if (facts['carbohydrates'] || facts['carbs']) {
    const val = (facts['carbohydrates'] || facts['carbs']).trim();
    nutrition.carbs = /g$/i.test(val) ? val.replace(/\s*g$/i, 'g') : `${val}g`;
  }
  if (facts['fat']) {
    const val = facts['fat'].trim();
    nutrition.fat = /g$/i.test(val) ? val.replace(/\s*g$/i, 'g') : `${val}g`;
  }
  if (facts['fiber']) {
    const val = facts['fiber'].trim();
    nutrition.fiber = /g$/i.test(val) ? val.replace(/\s*g$/i, 'g') : `${val}g`;
  }
  if (facts['sodium']) {
    const val = facts['sodium'].trim();
    nutrition.sodium = /mg$/i.test(val) ? val.replace(/\s*mg$/i, 'mg') : `${val}mg`;
  }
  if (Object.keys(nutrition).length > 0) data.nutrition = nutrition;
  if (facts['servings']) {
    const s = parseInt(facts['servings'], 10);
    if (!isNaN(s)) data.servings = s;
  }
  if (facts['prep time']) data.prepTime = facts['prep time'];
  if (facts['cook time']) data.cookTime = facts['cook time'];
}

export function parseBodyRecipeData(body = '') {
  if (!body || typeof body !== 'string') return {};
  const data = {};

  const isHtml = /<h2[^>]*>\s*(?:Recipe details|Ingredients|Steps)\s*<\/h2>/i.test(body);

  if (isHtml) {
    const extractHtmlSection = (title) => {
      const match = new RegExp(`<h2[^>]*>\\s*${title}\\s*<\\/h2>\\s*<ul[^>]*>([\\s\\S]*?)<\\/ul>`, 'i').exec(body);
      if (!match) return [];
      const ulContent = match[1];
      const items = [];
      const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
      let liMatch;
      while ((liMatch = liRegex.exec(ulContent)) !== null) {
        items.push(liMatch[1].replace(/<[^>]+>/g, '').trim());
      }
      return items;
    };

    const detailsLines = extractHtmlSection('Recipe details');
    if (detailsLines.length) {
      parseFactLines(detailsLines, data);
    }
    const ingredientsLines = extractHtmlSection('Ingredients');
    if (ingredientsLines.length) {
      data.pantryItems = ingredientsLines.filter(Boolean);
    }
    const stepsLines = extractHtmlSection('Steps');
    if (stepsLines.length) {
      data.steps = stepsLines.map((s) => s.replace(/^Step \d+:\s*/i, '').trim()).filter(Boolean);
    }

    const storyHtml = body.split(/<h2[^>]*>\s*(?:Recipe details|Ingredients|Steps)\s*<\/h2>/i)[0].trim();
    const clean = stripHtmlToCleanText(storyHtml);
    if (clean) data.cleanBody = clean;
  } else {
    const sectionMatch = (title) => new RegExp(`## ${title}\\n([\\s\\S]*?)(?=\\n\\n## |$)`, 'i').exec(body)?.[1] ?? '';
    const recipeDetailsText = sectionMatch('Recipe details');
    if (recipeDetailsText) {
      const lines = recipeDetailsText.split('\n').map((l) => l.replace(/^-\s*/, '').trim()).filter(Boolean);
      parseFactLines(lines, data);
    }
    const ingredientsText = sectionMatch('Ingredients');
    if (ingredientsText) {
      data.pantryItems = ingredientsText.split('\n').map((l) => l.replace(/^-\s*/, '').trim()).filter(Boolean);
    }
    const stepsText = sectionMatch('Steps');
    if (stepsText) {
      data.steps = stepsText.split('\n').map((l) => l.replace(/^-\s*(?:Step \d+:\s*)?/i, '').trim()).filter(Boolean);
    }
    const story = body.split(/\n\n## (?:Recipe details|Ingredients|Steps)/i)[0].trim();
    const clean = stripHtmlToCleanText(story);
    if (clean && clean !== body) data.cleanBody = clean;
    else if (story && story !== body) data.cleanBody = story;
    else if (clean) data.cleanBody = clean;
  }

  return data;
}

const firstDefined = (...values) => values.find((value) => value != null && value !== '');

const normalizeNutrition = (item = {}, parsedRecipe = {}) => {
  const metrics = item.nutrition ?? item.nutritionSummary ?? item.nutritionMetrics ?? {};
  return {
    calories: firstDefined(item.calories, item.caloriesKcal, metrics.calories, metrics.totalCalories, parsedRecipe.calories, null),
    protein: firstDefined(item.protein, item.proteinG, metrics.protein, metrics.proteinG, parsedRecipe.protein, null),
    carbs: firstDefined(metrics.carbs, metrics.carbsG, item.carbs, item.carbsG, parsedRecipe.nutrition?.carbs, null),
    fat: firstDefined(metrics.fat, metrics.fatG, metrics.healthyFatsG, item.fat, item.fatG, parsedRecipe.nutrition?.fat, null),
    fiber: firstDefined(metrics.fiber, metrics.fiberG, item.fiber, item.fiberG, parsedRecipe.nutrition?.fiber, null),
    sodium: firstDefined(metrics.sodium, metrics.sodiumMg, item.sodium, item.sodiumMg, parsedRecipe.nutrition?.sodium, null),
  };
};

export const normalizePost = (item = {}, fallbackType = 'BLOG') => {
  const rawType = item.type ?? item.contentType ?? fallbackType;
  const author = item.author ?? item.user ?? {};
  const parsedRecipe = parseBodyRecipeData(item.body);
  const cleanBody = parsedRecipe.cleanBody || stripHtmlToCleanText(item.body) || '';
  const captionSource = firstDefined(item.caption, item.story, item.description, item.summary, typeof item.content === 'string' ? item.content : null, cleanBody);
  const cleanDescription = stripHtmlToCleanText(captionSource);
  const nutrition = normalizeNutrition(item, parsedRecipe);

  return {
    ...item,
    calories: nutrition.calories,
    protein: nutrition.protein,
    nutrition,
    pantryItems: item.pantryItems ?? parsedRecipe.pantryItems ?? null,
    steps: item.steps ?? parsedRecipe.steps ?? null,
    servings: item.servings ?? parsedRecipe.servings ?? null,
    prepTime: item.prepTime ?? parsedRecipe.prepTime ?? null,
    cookTime: item.cookTime ?? parsedRecipe.cookTime ?? null,
    cleanBody,
    body: cleanBody,
    description: cleanDescription,
    id: item.id ?? item.contentId,
    type: String(rawType).toUpperCase() === 'VIDEO' ? 'video' : 'blog',
    author: item.authorName ?? author.fullName ?? author.name ?? (typeof author === 'string' ? author : ''),
    username: item.authorUsername ?? item.username ?? author.username ?? '',
    avatar: item.avatar ?? item.avatarUrl ?? item.avatar_url ?? item.authorAvatar ?? item.userAvatar ?? author.avatar ?? author.avatarUrl ?? author.avatar_url ?? null,
    image: item.image ?? item.imageUrl ?? item.image_url ?? item.thumbnailUrl ?? item.thumbnail_url ?? null,
    images: item.images ?? item.imageUrls ?? item.image_urls ?? [],
    videoUrl: item.videoUrl ?? item.mediaUrl ?? null,
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

export const personalizedPostKey = (post = {}) => {
  const id = post.contentId ?? post.id;
  const type = post.contentType ?? post.type;
  return id == null || !type ? null : `${String(type).toUpperCase()}:${id}`;
};

export const appendUniquePersonalizedPosts = (existingPosts, nextPosts) => {
  const seen = new Set(existingPosts.map(personalizedPostKey).filter(Boolean));
  return [...existingPosts, ...nextPosts.filter((post) => {
    const key = personalizedPostKey(post);
    if (!key || !seen.has(key)) {
      if (key) seen.add(key);
      return true;
    }
    return false;
  })];
};

export const contentIdOf = (post = {}) => post.contentId ?? post.id;

// This only changes the client's first render after publishing. The backend
// remains the source of truth for the ranked snapshot and cursor pagination.
export const prioritizePersonalizedPost = (posts, priorityPost) => {
  const priorityId = contentIdOf(priorityPost);
  if (priorityId == null) return posts;
  return [priorityPost, ...posts.filter((post) => String(contentIdOf(post)) !== String(priorityId))];
};

export async function getPersonalizedPostsPage({ cursor, signal, limit = 20 } = {}) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set('cursor', cursor);
  const data = unwrapData(await apiRequest(`/api/v1/feed/home?${params}`, { signal }), {});
  const items = Array.isArray(data?.items) ? data.items : [];
  return {
    posts: items.map((item) => normalizePost(item, item?.contentType)),
    nextCursor: typeof data?.nextCursor === 'string' && data.nextCursor ? data.nextCursor : null,
    hasMore: Boolean(data?.nextCursor),
    total: typeof data?.total === 'number' ? data.total : null,
    fallback: Boolean(data?.fallback)
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
