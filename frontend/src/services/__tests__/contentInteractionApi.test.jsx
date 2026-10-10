import { afterEach, describe, expect, it, vi } from 'vitest';
import { createContentComment, getContentCommentCount, getContentComments, toggleContentVote } from '../contentInteractionApi';

const ok = (data) => ({ ok: true, status: 200, headers: { get: () => 'application/json' },
  json: async () => ({ success: true, message: 'Success', data }) });

describe('content interaction API contract', () => {
  afterEach(() => vi.restoreAllMocks());

  it('reads a page of root comments and their nested replies', async () => {
    const page = { content: [{ commentId: 2, replies: [{ commentId: 3 }] }], totalElements: 1, totalPages: 1 };
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(ok(page));
    await expect(getContentComments(8, 0)).resolves.toEqual(page);
    expect(fetchMock.mock.calls[0][0]).toContain('/api/v1/contents/8/comments?page=0&size=20');
  });

  it('requests only one comment when loading a card comment count', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(ok({ content: [], totalElements: 7, totalPages: 7 }));
    await expect(getContentCommentCount(8)).resolves.toBe(7);
    expect(fetchMock.mock.calls[0][0]).toContain('/api/v1/contents/8/comments?page=0&size=1');
  });

  it('sends parentId for a reply and uses POST to toggle a vote', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(ok({ commentId: 4, parentId: 2, body: 'Reply' }))
      .mockResolvedValueOnce(ok({ contentId: 8, voteCount: 5, isVoted: false }));
    await createContentComment(8, 'Reply', 2);
    await toggleContentVote(8);
    expect(fetchMock.mock.calls[0][1]).toEqual(expect.objectContaining({
      method: 'POST', body: JSON.stringify({ body: 'Reply', parentId: 2 }),
    }));
    expect(fetchMock.mock.calls[1][0]).toContain('/api/v1/contents/8/vote');
    expect(fetchMock.mock.calls[1][1].method).toBe('POST');
  });
});
