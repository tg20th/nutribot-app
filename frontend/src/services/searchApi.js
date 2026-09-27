import { apiRequest, unwrapData } from './apiClient';

const itemsFrom = (payload) => {
  const data = payload?.data ?? payload;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.content)) return data.content;
  if (Array.isArray(data?.items)) return data.items;
  return [];
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
    totalElements: data?.totalElements ?? data?.total ?? items.length,
    totalPages: data?.totalPages ?? 1,
    page: data?.page ?? data?.number ?? page,
    size: data?.size ?? size
  };

  return { items, meta };
}

const publicCollection = async (path, type, signal) => {
  const payload = await apiRequest(path, { signal });
  const data = unwrapData(payload, {});
  return itemsFrom(data).map((item) => ({ ...item, contentType: type }));
};

// The consolidated search API is intentionally authenticated by the current backend.
// Guests therefore use the two existing public content collections and filter their
// published list in the browser. This keeps the public search usable without changing
// backend security or database data.
export async function searchPublicContent({ keyword, categoryId, contentType, signal }) {
  const [blogs, videos] = await Promise.all([
    publicCollection('/api/v1/blogs?page=0&size=100', 'BLOG', signal),
    publicCollection('/api/v1/videos?page=0&size=100', 'VIDEO', signal)
  ]);

  const normalizedKeyword = decodeLegacyText(keyword?.trim()).toLocaleLowerCase();
  const items = [...blogs, ...videos].filter((item) => {
    const searchableTitle = decodeLegacyText(item.title).toLocaleLowerCase();
    const matchesKeyword = !normalizedKeyword || searchableTitle.includes(normalizedKeyword);
    const matchesType = !contentType || item.contentType === contentType;
    const matchesCategory = !categoryId || Number(item.categoryId) === Number(categoryId);
    return matchesKeyword && matchesType && matchesCategory;
  });

  return {
    items,
    meta: { totalElements: items.length, totalPages: 1, page: 0, size: items.length }
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
