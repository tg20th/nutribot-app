import { apiRequest, unwrapData } from './apiClient';

const authorBlogsPath = '/api/v1/author/blogs';
const baseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

export async function getBlogCategories(signal) {
  const items = unwrapData(await apiRequest('/api/v1/blogs/categories', { signal }), []);
  if (!Array.isArray(items)) throw new Error('Invalid blog categories response');
  return items;
}

export async function uploadBlogThumbnail(file) {
  const body = new FormData();
  body.append('file', file);
  const token = localStorage.getItem('nutribot-auth-token');
  const response = await fetch(`${baseUrl}/api/v1/blogs/thumbnails`, {
    method: 'POST', body,
    headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  const payload = await response.json();
  if (!response.ok || !payload?.success) {
    const error = new Error(payload?.message ?? 'Could not upload image');
    error.status = response.status;
    throw error;
  }
  return new URL(payload.data.thumbnailUrl, baseUrl || window.location.origin).href;
}

export async function createMyBlog(values) {
  const data = unwrapData(await apiRequest(authorBlogsPath, { method: 'POST', body: JSON.stringify(values) }), {});
  if (data.contentId == null) throw new Error('Invalid create blog response');
  return data;
}

export async function getMyBlogs(page = 0, size = 6, signal) {
  const data = unwrapData(await apiRequest(`${authorBlogsPath}?page=${page}&size=${size}`, { signal }), {});
  if (!Array.isArray(data.content) || !Number.isInteger(data.totalPages) || !Number.isFinite(data.totalElements)) {
    throw new Error('Invalid author blog list response');
  }
  return data;
}

export async function getMyBlog(id, signal) {
  const data = unwrapData(await apiRequest(`${authorBlogsPath}/${id}`, { signal }), {});
  if (data.contentId == null) throw new Error('Invalid author blog response');
  return data;
}

export async function updateMyBlog(id, values) {
  return unwrapData(await apiRequest(`${authorBlogsPath}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(values),
  }), {});
}

export const deleteMyBlog = (id) => apiRequest(`${authorBlogsPath}/${id}`, { method: 'DELETE' });
