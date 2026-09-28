import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '../apiClient';
import { searchContent, searchPublicContent } from '../searchApi';

vi.mock('../apiClient', () => ({
  apiRequest: vi.fn(),
  unwrapData: (payload, fallback = {}) => payload?.data ?? fallback
}));

describe('searchPublicContent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads page zero independently for blogs and videos', async () => {
    apiRequest
      .mockResolvedValueOnce({ data: { content: [{ contentId: 1, title: 'Tofu salad' }], totalElements: 13, last: false } })
      .mockResolvedValueOnce({ data: { content: [{ contentId: 2, title: 'Tofu video' }], totalElements: 2, last: true } });

    const result = await searchPublicContent({ keyword: 'tofu', blogPage: 0, videoPage: 0, size: 12 });

    expect(apiRequest).toHaveBeenNthCalledWith(1, '/api/v1/blogs?page=0&size=12', { signal: undefined });
    expect(apiRequest).toHaveBeenNthCalledWith(2, '/api/v1/videos?page=0&size=12', { signal: undefined });
    expect(result.items).toHaveLength(2);
    expect(result.meta).toMatchObject({ totalElements: null, blogLast: false, videoLast: true, last: false });
  });

  it('uses public totals only when they describe the active type and filters', async () => {
    apiRequest.mockResolvedValueOnce({ data: { content: [{ contentId: 1, title: 'Salad' }], totalElements: 13, last: true } });

    const result = await searchPublicContent({ contentType: 'BLOG', categoryId: 4, blogPage: 0, videoPage: 0, size: 12 });

    expect(apiRequest).toHaveBeenCalledTimes(1);
    expect(apiRequest).toHaveBeenCalledWith('/api/v1/blogs?page=0&size=12&categoryId=4', { signal: undefined });
    expect(result.meta.totalElements).toBe(13);
    expect(result.meta).toMatchObject({ blogLast: true, videoLast: true, last: true });
  });

  it('does not request a source that has already reached its last page', async () => {
    apiRequest.mockResolvedValueOnce({ data: { content: [{ contentId: 3, title: 'Tofu bowl' }], totalElements: 13, last: true } });

    const result = await searchPublicContent({ keyword: 'tofu', blogPage: 1, videoPage: null, size: 12 });

    expect(apiRequest).toHaveBeenCalledTimes(1);
    expect(apiRequest).toHaveBeenCalledWith('/api/v1/blogs?page=1&size=12', { signal: undefined });
    expect(result.meta).toMatchObject({ blogLast: true, videoLast: true, last: true });
  });
});

describe('searchContent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('keeps the authenticated search page cursor and last flag from the API', async () => {
    apiRequest.mockResolvedValueOnce({ data: { content: [{ contentId: 9, title: 'Tofu recipe' }], currentPage: 1, totalPages: 4, last: false } });

    const result = await searchContent({ keyword: 'tofu', page: 1, size: 12 });

    expect(apiRequest).toHaveBeenCalledWith('/api/v1/search?keyword=tofu&page=1&size=12', { signal: undefined });
    expect(result.meta).toMatchObject({ page: 1, totalPages: 4, last: false, source: 'search' });
  });

  it('keeps the API total for the active content type', async () => {
    apiRequest.mockResolvedValueOnce({ data: { content: [{ contentId: 10, title: 'Tofu video' }], totalElements: 7, last: true } });

    const result = await searchContent({ keyword: 'tofu', contentType: 'VIDEO', page: 0, size: 12 });

    expect(apiRequest).toHaveBeenCalledWith('/api/v1/search?keyword=tofu&contentType=VIDEO&page=0&size=12', { signal: undefined });
    expect(result.meta.totalElements).toBe(7);
  });
});
