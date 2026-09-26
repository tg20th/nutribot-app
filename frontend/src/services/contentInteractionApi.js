import { apiRequest } from './apiClient';

const contentPath = (contentId) => `/api/v1/contents/${encodeURIComponent(contentId)}`;

function responseData(response) {
  if (response?.success !== true || response.data == null) {
    throw new Error(response?.message || 'Invalid response');
  }
  return response.data;
}

export async function getContentComments(contentId, page = 0, signal) {
  const data = responseData(await apiRequest(`${contentPath(contentId)}/comments?page=${page}&size=20`, { signal }));
  if (!Array.isArray(data.content) || !Number.isInteger(data.totalPages) || !Number.isFinite(data.totalElements)) {
    throw new Error('Invalid comments response');
  }
  return data;
}

export async function createContentComment(contentId, body, parentId = null) {
  return responseData(await apiRequest(`${contentPath(contentId)}/comments`, {
    method: 'POST', body: JSON.stringify({ body, parentId }),
  }));
}

export async function getContentVote(contentId, signal) {
  const data = responseData(await apiRequest(`${contentPath(contentId)}/vote`, { signal }));
  if (!Number.isFinite(data.voteCount) || typeof data.isVoted !== 'boolean') {
    throw new Error('Invalid vote response');
  }
  return data;
}

export async function toggleContentVote(contentId) {
  const data = responseData(await apiRequest(`${contentPath(contentId)}/vote`, { method: 'POST' }));
  if (!Number.isFinite(data.voteCount) || typeof data.isVoted !== 'boolean') {
    throw new Error('Invalid vote response');
  }
  return data;
}
