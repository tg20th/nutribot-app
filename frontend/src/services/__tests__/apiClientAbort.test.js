import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiRequest } from '../apiClient';

describe('apiClient AbortError & network handling', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('re-throws native AbortError without wrapping it into ApiError', async () => {
    const abortError = new DOMException('The user aborted a request.', 'AbortError');
    globalThis.fetch = vi.fn().mockRejectedValue(abortError);

    const controller = new AbortController();
    controller.abort();

    await expect(apiRequest('/api/v1/users/profile/health', { signal: controller.signal }))
      .rejects.toSatisfy((err) => {
        expect(err.name).toBe('AbortError');
        expect(err instanceof ApiError).toBe(false);
        return true;
      });
  });

  it('wraps generic network offline errors into ApiError with friendly message', async () => {
    const networkFail = new TypeError('Failed to fetch');
    globalThis.fetch = vi.fn().mockRejectedValue(networkFail);

    await expect(apiRequest('/api/v1/users/profile'))
      .rejects.toSatisfy((err) => {
        expect(err instanceof ApiError).toBe(true);
        expect(err.name).toBe('ApiError');
        expect(err.message).toContain('Không thể kết nối đến máy chủ');
        return true;
      });
  });

  it('preserves the backend message for an upload-size response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: false,
      message: 'Dung lượng tệp tải lên không được vượt quá 25 MB.',
    }), {
      status: 413,
      headers: { 'Content-Type': 'application/json' },
    }));

    await expect(apiRequest('/api/v1/author/videos/upload', { method: 'POST', body: new FormData() }))
      .rejects.toSatisfy((err) => {
        expect(err instanceof ApiError).toBe(true);
        expect(err.status).toBe(413);
        expect(err.message).toBe('Dung lượng tệp tải lên không được vượt quá 25 MB.');
        return true;
      });
  });
});
