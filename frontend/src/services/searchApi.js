import { apiRequest, unwrapData } from './apiClient';

const itemsFrom = (payload) => {
  const data = payload?.data ?? payload;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.content)) return data.content;
  if (Array.isArray(data?.items)) return data.items;
  return [];
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

export async function getCategories(signal) {
  const payload = await apiRequest('/api/v1/categories', { signal });
  return itemsFrom(payload);
}
