import { apiRequest, unwrapData } from './apiClient';

const authorBlogsPath = '/api/v1/author/blogs';

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
