import { apiRequest, unwrapData } from './apiClient';

const itemsFrom = (payload) => {
  const data = payload?.data ?? payload;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.content)) return data.content;
  if (Array.isArray(data?.items)) return data.items;
  return [];
};

const totalFrom = (value, fallback) => {
  if (value == null || value === '') return fallback;
  const total = Number(value);
  return Number.isFinite(total) ? total : fallback;
};

const mojibakePattern = /(?:Ã.|Â.|Ä.|Æ.|áº.|á».)/;

// The seeded SQL data is stored as UTF-8 bytes interpreted as Windows-1252.
// Decode only strings that exhibit that signature; correctly encoded API text
// remains untouched.
export const decodeLegacyText = (value) => {
  const text = String(value ?? '');
  if (!mojibakePattern.test(text)) return text;
  try {
    return new TextDecoder('utf-8').decode(Uint8Array.from(text, (character) => character.charCodeAt(0)));
  } catch {
    return text;
  }
};

export async function searchContent({ keyword, categoryId, contentType, page = 0, size = 12, signal }) {
  const params = new URLSearchParams();
  if (keyword?.trim()) params.append('keyword', keyword.trim());
  if (categoryId) params.append('categoryId', categoryId);
  if (contentType && contentType !== 'All') params.append('contentType', contentType);
  params.append('page', page);
  params.append('size', size);

  const queryString = params.toString();
  const path = `/api/v1/search${queryString ? `?${queryString}` : ''}`;
  const payload = await apiRequest(path, { signal });

  const data = unwrapData(payload, {});
  const items = itemsFrom(data);
  const meta = {
    totalElements: totalFrom(data?.totalElements ?? data?.total, items.length),
    totalPages: data?.totalPages ?? 1,
    page: data?.page ?? data?.number ?? page,
    size: data?.size ?? size,
    last: typeof data?.last === 'boolean' ? data.last : page >= (data?.totalPages ?? 1) - 1,
    source: 'search'
  };

  return { items, meta };
}

const publicCollection = async (path, type, signal) => {
  const payload = await apiRequest(path, { signal });
  const data = unwrapData(payload, {});
  const items = itemsFrom(data).map((item) => ({ ...item, contentType: type }));
  return {
    items,
    totalElements: totalFrom(data?.totalElements, items.length),
    last: typeof data?.last === 'boolean' ? data.last : true
  };
};

// The consolidated search API is intentionally authenticated by the current backend.
// Guests therefore use the two existing public content collections and filter their
// published list in the browser. This keeps the public search usable without changing
// backend security or database data.
export async function searchPublicContent({ keyword, categoryId, contentType, blogPage = 0, videoPage = 0, size = 12, signal }) {
  const categoryQuery = categoryId ? `&categoryId=${encodeURIComponent(categoryId)}` : '';
  const loadBlogs = !contentType || contentType === 'BLOG';
  const loadVideos = !contentType || contentType === 'VIDEO';
  const [blogResult, videoResult] = await Promise.all([
    !loadBlogs || blogPage == null ? null : publicCollection(`/api/v1/blogs?page=${blogPage}&size=${size}${categoryQuery}`, 'BLOG', signal),
    !loadVideos || videoPage == null ? null : publicCollection(`/api/v1/videos?page=${videoPage}&size=${size}${categoryQuery}`, 'VIDEO', signal)
  ]);

  const normalizedKeyword = decodeLegacyText(keyword?.trim()).toLocaleLowerCase();
  const items = [...(blogResult?.items ?? []), ...(videoResult?.items ?? [])].filter((item) => {
    const searchableTitle = decodeLegacyText(item.title).toLocaleLowerCase();
    const matchesKeyword = !normalizedKeyword || searchableTitle.includes(normalizedKeyword);
    const matchesType = !contentType || item.contentType === contentType;
    const matchesCategory = !categoryId || Number(item.categoryId) === Number(categoryId);
    return matchesKeyword && matchesType && matchesCategory;
  });

  const blogLast = !loadBlogs || blogPage == null || Boolean(blogResult?.last);
  const videoLast = !loadVideos || videoPage == null || Boolean(videoResult?.last);

  return {
    items,
    meta: {
      // Public collections do not accept a keyword, so their totals cannot be
      // presented as a keyword-match count.
      totalElements: keyword?.trim() ? null : (blogResult?.totalElements ?? 0) + (videoResult?.totalElements ?? 0),
      page: Math.max(blogPage ?? 0, videoPage ?? 0),
      size,
      blogLast,
      videoLast,
      last: blogLast && videoLast,
      source: 'public'
    }
  };
}

export async function getCategories(signal) {
  const payload = await apiRequest('/api/v1/categories', { signal });
  return itemsFrom(payload).map((item) => ({
    ...item,
    categoryId: item.categoryId ?? item.id,
    name: item.categoryName ?? item.name ?? item.title,
    iconUrl: item.iconUrl ?? item.icon_url ?? item.imageUrl ?? item.image_url
  }));
}
