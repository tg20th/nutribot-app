import { apiRequest, unwrapData } from './apiClient';

export const adminCommentsApi = {
  async list({ page = 0, size = 10 } = {}, signal) {
    const params = new URLSearchParams({ page: String(page), size: String(size) });
    const payload = await apiRequest(`/api/v1/admin/comments?${params}`, { signal });
    return unwrapData(payload, {});
  },
  remove(commentId) {
    return apiRequest(`/api/v1/admin/comments/${commentId}`, { method: 'DELETE' });
  },
};
