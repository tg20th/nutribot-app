import { apiRequest, unwrapData } from './apiClient';

export function sendContentEngagement(contentId, payload, options = {}) {
  return apiRequest(`/api/v1/contents/${encodeURIComponent(contentId)}/engagement`, {
    method: 'POST',
    body: JSON.stringify(payload),
    ...options,
  }).then((response) => unwrapData(response, response));
}
