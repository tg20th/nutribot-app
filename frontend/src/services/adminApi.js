import { apiRequest, unwrapData } from './apiClient';
const list = (path) => async (signal) => unwrapData(await apiRequest(path, { signal }));
const one = (path) => async (id, signal) => unwrapData(await apiRequest(`${path}/${id}`, { signal }), {});
const status = (path) => (id, value) => apiRequest(`${path}/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: value }) }).then((payload) => unwrapData(payload, {}));
export const adminApi = {
  getDashboard: (range, signal) => apiRequest(`/api/admin/dashboard?range=${encodeURIComponent(range ?? '7d')}`, { signal }).then((payload) => unwrapData(payload, {})),
  getUsers: list('/api/admin/users'), getUserById: one('/api/admin/users'), updateUserStatus: status('/api/admin/users'), lockUser: (id) => status('/api/admin/users')(id, 'Locked'),
  getCategories: list('/api/admin/categories'), createCategory: (data) => apiRequest('/api/admin/categories', { method: 'POST', body: JSON.stringify(data) }).then((p) => unwrapData(p, {})), updateCategory: (id, data) => apiRequest(`/api/admin/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }).then((p) => unwrapData(p, {})), deleteCategory: (id) => apiRequest(`/api/admin/categories/${id}`, { method: 'DELETE' }),
  getBlogs: list('/api/admin/blogs'), getBlogById: one('/api/admin/blogs'), hideBlog: (id) => status('/api/admin/blogs')(id, 'Hidden'), deleteBlog: (id) => apiRequest(`/api/admin/blogs/${id}`, { method: 'DELETE' }),
  getVideos: list('/api/admin/videos'), getVideoById: one('/api/admin/videos'), hideVideo: (id) => status('/api/admin/videos')(id, 'Hidden'), deleteVideo: (id) => apiRequest(`/api/admin/videos/${id}`, { method: 'DELETE' }),
  getComments: list('/api/admin/comments'), deleteComment: (id) => apiRequest(`/api/admin/comments/${id}`, { method: 'DELETE' })
};
