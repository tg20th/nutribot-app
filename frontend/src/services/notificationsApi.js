import { apiRequest, unwrapData } from './apiClient';

const normalizePage = (payload) => {
  const data = unwrapData(payload, {});
  return {
    items: Array.isArray(data?.content) ? data.content : [],
    page: Number(data?.page ?? data?.currentPage ?? 0),
    size: Number(data?.size ?? 10),
    totalPages: Number(data?.totalPages ?? 1),
    last: Boolean(data?.last ?? true)
  };
};

export async function getNotifications({ page = 0, size = 10, signal } = {}) {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  return normalizePage(await apiRequest(`/api/v1/notifications?${params.toString()}`, { signal }));
}

export async function getUnreadNotificationCount(signal) {
  const data = unwrapData(await apiRequest('/api/v1/notifications/unread-count', { signal }), 0);
  return Number(data) || 0;
}

export function markNotificationAsRead(notificationId, signal) {
  return apiRequest(`/api/v1/notifications/${encodeURIComponent(notificationId)}/read`, { method: 'PATCH', signal });
}

export function markAllNotificationsAsRead(signal) {
  return apiRequest('/api/v1/notifications/read-all', { method: 'PATCH', signal });
}
