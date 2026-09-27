import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminCommentsApi } from '../adminCommentsApi';
import { apiRequest } from '../apiClient';

vi.mock('../apiClient', () => ({
  apiRequest: vi.fn(),
  unwrapData: (payload, fallback = []) => payload?.data ?? fallback,
}));

describe('NB-39 backend contract', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reads the ApiResponse paged data', async () => {
    const signal = new AbortController().signal;
    const data = { content: [{ commentId: 7, body: 'A comment' }], totalPages: 2, totalElements: 11 };
    apiRequest.mockResolvedValue({ success: true, data });
    expect(await adminCommentsApi.list({ page: 1, size: 10 }, signal)).toEqual(data);
    expect(apiRequest).toHaveBeenCalledWith('/api/v1/admin/comments?page=1&size=10', { signal });
  });

  it('deletes by commentId through the admin endpoint', async () => {
    apiRequest.mockResolvedValue({ success: true, data: null });
    await adminCommentsApi.remove(7);
    expect(apiRequest).toHaveBeenCalledWith('/api/v1/admin/comments/7', { method: 'DELETE' });
  });
});
