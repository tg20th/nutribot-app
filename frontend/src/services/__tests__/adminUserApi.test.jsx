import { afterEach, describe, expect, it, vi } from 'vitest';
import { adminApi } from '../adminApi';

const ok = (data) => ({
  ok: true,
  status: 200,
  headers: { get: () => 'application/json' },
  json: async () => ({ success: true, message: 'Success', data }),
});

describe('NB-36 admin user API contract', () => {
  afterEach(() => vi.restoreAllMocks());

  it('reads the backend page and maps its user fields', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(ok({
      content: [{ userId: 7, username: 'minh', email: 'minh@example.com', fullName: 'Minh', roleName: 'MEMBER', status: 'ACTIVE', strikeCount: 0, createdAt: '2026-09-27T08:00:00' }],
      totalPages: 2,
      totalElements: 11,
    }));
    const page = await adminApi.getUsers({ keyword: 'minh@example.com', status: 'ACTIVE', page: 1, size: 10 });
    expect(fetchMock.mock.calls[0][0]).toContain('/api/v1/admin/users?page=1&size=10&keyword=minh%40example.com&status=ACTIVE');
    expect(page.content[0]).toEqual(expect.objectContaining({ id: 7, name: 'Minh', role: 'MEMBER', status: 'ACTIVE' }));
    expect(page.totalPages).toBe(2);
  });

  it('updates the backend status with PUT', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(ok({ userId: 7, username: 'minh', status: 'BANNED' }));
    await adminApi.updateUserStatus(7, 'BANNED');
    expect(fetchMock.mock.calls[0][0]).toContain('/api/v1/admin/users/7/status');
    expect(fetchMock.mock.calls[0][1]).toEqual(expect.objectContaining({
      method: 'PUT',
      body: JSON.stringify({ status: 'BANNED' }),
    }));
  });
});
