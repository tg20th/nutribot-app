import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '../apiClient';
import { appendUniquePersonalizedPosts, getPersonalizedPostsPage, normalizePost, prioritizePersonalizedPost } from '../communityApi';

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

  it('moves a newly published post to the front without leaving a duplicate behind', () => {
    const priority = { id: 2, type: 'blog', title: 'New post' };
    const rankedPosts = [{ id: 1, type: 'blog' }, priority, { id: 3, type: 'video' }];

    expect(prioritizePersonalizedPost(rankedPosts, priority).map((post) => post.id)).toEqual([2, 1, 3]);
  });

  it('preserves an API caption and nested nutrition metrics for the feed card', () => {
    const post = normalizePost({
      contentId: 9,
      contentType: 'BLOG',
      title: 'Bữa trưa xanh',
      story: 'Rau theo mùa, thêm một chút chanh.\nĂn ngon nhé.',
      nutrition: { calories: 420, proteinG: 24, carbsG: 38 }
    });

    expect(post.description).toBe('Rau theo mùa, thêm một chút chanh.\nĂn ngon nhé.');
    expect(post.calories).toBe(420);
    expect(post.protein).toBe(24);
    expect(post.nutrition.carbs).toBe(38);
  });

  it('does not invent a caption or nutrition for the real Snack chay feed contract', () => {
    const snackFeedItem = {
      contentId: 125,
      contentType: 'BLOG',
      title: 'Snack chay',
      thumbnailUrl: 'https://cdn.example.test/snack.jpg',
      authorUsername: 'lan_tuyt',
      authorName: 'Lan Tuyết',
      createdAt: '2026-10-08T18:51:01.794Z'
    };

    const post = normalizePost(snackFeedItem, snackFeedItem.contentType);
    expect(post.description).toBe('');
    expect(post.calories).toBeNull();
    expect(post.protein).toBeNull();
  });

  it('maps Snack chay detail body into its story and nutrition without including recipe sections', () => {
    const post = normalizePost({
      contentId: 125,
      contentType: 'BLOG',
      title: 'Snack chay',
      body: 'snack chay ngon ngon\n\n## Recipe details\n- Calories: 23 kcal\n- Protein: 2.9 g\n- Carbohydrates: 3.6 g\n- Fat: 0.4 g\n\n## Ingredients\n- 100 g Cải bó xôi\n\n## Steps\n- Step 1: Trộn thui'
    }, 'BLOG');

    expect(post.description).toBe('snack chay ngon ngon');
    expect(post.description).not.toContain('Ingredients');
    expect(post.calories).toBe(23);
    expect(post.protein).toBe(2.9);
  });
});
