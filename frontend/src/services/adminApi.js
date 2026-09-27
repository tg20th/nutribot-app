import { apiRequest, unwrapData } from './apiClient';
const list = (path) => async (signal) => unwrapData(await apiRequest(path, { signal }));
const one = (path) => async (id, signal) => unwrapData(await apiRequest(`${path}/${id}`, { signal }), {});
const status = (path) => (id, value) => apiRequest(`${path}/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: value }) }).then((payload) => unwrapData(payload, {}));
const mapAdminUser = (user) => ({ id: user.userId, username: user.username, email: user.email, name: user.fullName || user.username, role: user.roleName, status: user.status, joinedAt: user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '', strikeCount: user.strikeCount });
const mapAdminUserPage = (page) => ({ ...page, content: (page.content ?? []).map(mapAdminUser) });
const adminUserQuery = ({ keyword = '', status = '', page = 0, size = 10 } = {}) => {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (keyword.trim()) params.set('keyword', keyword.trim());
  if (status) params.set('status', status);
  return `/api/v1/admin/users?${params}`;
};
export const adminApi = {
  getDashboard: (range, signal) => apiRequest(`/api/admin/dashboard?range=${encodeURIComponent(range ?? '7d')}`, { signal }).then((payload) => unwrapData(payload, {})),
  getUsers: (params, signal) => apiRequest(adminUserQuery(params), { signal }).then((payload) => mapAdminUserPage(unwrapData(payload, {}))), getUserById: one('/api/admin/users'), updateUserStatus: (id, value) => apiRequest(`/api/v1/admin/users/${id}/status`, { method: 'PUT', body: JSON.stringify({ status: value }) }).then((payload) => mapAdminUser(unwrapData(payload, {}))), lockUser: (id) => apiRequest(`/api/v1/admin/users/${id}/status`, { method: 'PUT', body: JSON.stringify({ status: 'BANNED' }) }),
  getCategories: list('/api/admin/categories'), createCategory: (data) => apiRequest('/api/admin/categories', { method: 'POST', body: JSON.stringify(data) }).then((p) => unwrapData(p, {})), updateCategory: (id, data) => apiRequest(`/api/admin/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }).then((p) => unwrapData(p, {})), deleteCategory: (id) => apiRequest(`/api/admin/categories/${id}`, { method: 'DELETE' }),
  getBlogs: list('/api/admin/blogs'), getBlogById: one('/api/admin/blogs'), hideBlog: (id) => status('/api/admin/blogs')(id, 'Hidden'), deleteBlog: (id) => apiRequest(`/api/admin/blogs/${id}`, { method: 'DELETE' }),
  getVideos: list('/api/admin/videos'), getVideoById: one('/api/admin/videos'), hideVideo: (id) => status('/api/admin/videos')(id, 'Hidden'), deleteVideo: (id) => apiRequest(`/api/admin/videos/${id}`, { method: 'DELETE' }),
  getComments: list('/api/admin/comments'), deleteComment: (id) => apiRequest(`/api/admin/comments/${id}`, { method: 'DELETE' })
};
