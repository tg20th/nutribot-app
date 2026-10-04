import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '../apiClient';
import { appendUniquePersonalizedPosts, getPersonalizedPostsPage } from '../communityApi';

vi.mock('../apiClient', () => ({
  apiRequest: vi.fn(),
  unwrapData: (payload, fallback = {}) => payload?.data ?? fallback
}));

describe('personalized community feed API', () => {
  beforeEach(() => vi.resetAllMocks());

  it('uses the backend feed endpoint and preserves its unified ranked order', async () => {
    apiRequest.mockResolvedValue({ data: {
      items: [
        { contentId: 3, contentType: 'VIDEO', title: 'Video C' },
        { contentId: 1, contentType: 'BLOG', title: 'Blog A' },
        { contentId: 2, contentType: 'VIDEO', title: 'Video B' }
      ],
      nextCursor: 'cursor-2'
    } });

    const result = await getPersonalizedPostsPage({ limit: 20 });

    expect(apiRequest).toHaveBeenCalledWith('/api/v1/feed/home?limit=20', { signal: undefined });
    expect(result.posts.map((post) => post.title)).toEqual(['Video C', 'Blog A', 'Video B']);
    expect(result.posts.map((post) => post.type)).toEqual(['video', 'blog', 'video']);
    expect(result.nextCursor).toBe('cursor-2');
    expect(result.hasMore).toBe(true);
  });

  it('passes the opaque backend cursor without interpreting it', async () => {
    apiRequest.mockResolvedValue({ data: { items: [], nextCursor: null, fallback: true } });

    const result = await getPersonalizedPostsPage({ cursor: 'cursor+/=', limit: 20 });

    expect(apiRequest).toHaveBeenCalledWith('/api/v1/feed/home?limit=20&cursor=cursor%2B%2F%3D', { signal: undefined });
    expect(result.hasMore).toBe(false);
    expect(result.fallback).toBe(true);
  });

  it('deduplicates repeated typed content while preserving first-seen server order', () => {
    const pageOne = [
      { id: 1, type: 'blog', title: 'A' },
      { id: 2, type: 'video', title: 'B' },
      { id: 3, type: 'blog', title: 'C' }
    ];
    const pageTwo = [
      { id: 3, type: 'blog', title: 'C' },
      { id: 4, type: 'video', title: 'D' },
      { id: 5, type: 'blog', title: 'E' }
    ];

    expect(appendUniquePersonalizedPosts(pageOne, pageTwo).map((post) => post.title)).toEqual(['A', 'B', 'C', 'D', 'E']);
  });
});
