import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  captureFeedAnchor,
  clearFeedSnapshots,
  getActiveFeedSnapshot,
  getFeedSnapshot,
  getFeedScrollContainer,
  restoreFeedAnchor,
  saveActiveFeedSnapshot,
  saveFeedSnapshot,
  updateCachedFeedPost
} from '../feedStateCache';

describe('Feed state cache and scroll restoration', () => {
  beforeEach(() => {
    clearFeedSnapshots();
    localStorage.removeItem('nutribot-auth-token');
    document.body.innerHTML = '';
  });

  it('keeps the ordered posts and pagination when a Feed component unmounts', () => {
    const snapshot = {
      posts: [{ id: 1 }, { id: 2 }, { id: 3 }],
      pagination: { cursor: 'cursor-3', hasMore: true },
      filter: 'Recipes',
      anchor: { postId: '2', scrollTop: 820, anchorTop: 180 }
    };

    saveFeedSnapshot('guest:home:Recipes::', snapshot);

    expect(getFeedSnapshot('guest:home:Recipes::')).toMatchObject(snapshot);
  });

  it('restores the explicitly active Feed snapshot without falling back to another filter', () => {
    saveFeedSnapshot('guest:home:All::', { posts: [{ id: 1 }] });
    saveActiveFeedSnapshot('home', 'guest:home:Recipes::', {
      posts: [{ id: 10 }, { id: 11 }],
      pagination: { cursor: 'recipe-cursor', hasMore: true },
      filter: 'Recipes'
    });

    expect(getActiveFeedSnapshot('home')).toMatchObject({
      posts: [{ id: 10 }, { id: 11 }],
      pagination: { cursor: 'recipe-cursor', hasMore: true },
      filter: 'Recipes'
    });
  });

  it('updates an interacted post in every in-memory Feed snapshot without refetching', () => {
    saveFeedSnapshot('guest:home:All::', { posts: [{ id: 7, liked: false }] });
    saveFeedSnapshot('guest:home:Recipes::', { posts: [{ id: 7, liked: false }] });

    updateCachedFeedPost(7, { liked: true, likeCount: 4 });

    expect(getFeedSnapshot('guest:home:All::').posts[0]).toMatchObject({ liked: true, likeCount: 4 });
    expect(getFeedSnapshot('guest:home:Recipes::').posts[0]).toMatchObject({ liked: true, likeCount: 4 });
  });

  it('captures and restores the nearest overflow scroll container, not window.scrollY', () => {
    const shell = document.createElement('div');
    shell.style.overflowY = 'auto';
    shell.scrollTop = 420;
    const post = document.createElement('article');
    post.dataset.feedPostId = '30';
    post.getBoundingClientRect = vi.fn(() => ({ top: 120, bottom: 520 }));
    shell.append(post);
    document.body.append(shell);

    expect(getFeedScrollContainer(shell)).toBe(shell);
    const anchor = captureFeedAnchor(null, shell);
    expect(anchor).toMatchObject({ postId: '30', scrollTop: 420, anchorTop: 120 });

    post.getBoundingClientRect = vi.fn(() => ({ top: 40, bottom: 440 }));
    shell.scrollTop = 200;
    restoreFeedAnchor(anchor, shell);

    expect(shell.scrollTop).toBe(120);
  });
});
