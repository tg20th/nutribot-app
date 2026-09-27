import { afterEach, describe, expect, it, vi } from 'vitest';
import { adminApi } from '../adminApi';

const ok = (data) => ({
  ok: true,
  status: 200,
  headers: { get: () => 'application/json' },
  json: async () => ({ success: true, message: 'Success', data }),
});

describe('NB-38 moderation API contract', () => {
  afterEach(() => vi.restoreAllMocks());

  it('loads the paged moderation queue and maps backend fields', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(ok({
      content: [{ contentId: 41, contentType: 'VIDEO', title: 'Review this clip', slug: 'review-this-clip', status: 'pending', authorUsername: 'khanh', authorEmail: 'khanh@example.com', viewCount: 0, createdAt: '2026-09-26T10:00:00' }],
      page: 0,
      size: 10,
      totalElements: 1,
      totalPages: 1,
    }));
    const page = await adminApi.getModerationQueue({ contentType: 'VIDEO', page: 0, size: 10 });
    expect(fetchMock.mock.calls[0][0]).toContain('/api/v1/admin/moderation?page=0&size=10&contentType=VIDEO');
    expect(page.content[0]).toEqual(expect.objectContaining({
      id: 41, type: 'VIDEO', author: 'khanh', authorEmail: 'khanh@example.com',
      status: 'pending', submittedAt: '2026-09-26T10:00:00',
    }));
    expect(page.totalElements).toBe(1);
  });

  it('sends the moderation action with PUT', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(ok({
      contentId: 41, contentType: 'VIDEO', title: 'Review this clip', status: 'rejected',
    }));
    await adminApi.moderateContent(41, 'REJECT');
    expect(fetchMock.mock.calls[0][0]).toContain('/api/v1/admin/moderation/41/action');
    expect(fetchMock.mock.calls[0][1]).toEqual(expect.objectContaining({
      method: 'PUT',
      body: JSON.stringify({ action: 'REJECT' }),
    }));
  });
});
