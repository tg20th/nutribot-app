import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import CommentSection from '../CommentSection';
import VoteButton from '../VoteButton';
import { createContentComment, getContentComments, getContentVote, toggleContentVote } from '../../../services/contentInteractionApi';

vi.mock('../../../services/contentInteractionApi', () => ({
  createContentComment: vi.fn(),
  getContentComments: vi.fn(),
  getContentVote: vi.fn(),
  toggleContentVote: vi.fn(),
}));

describe('content interactions', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it('uses the server response for Like state and count', async () => {
    getContentVote.mockResolvedValue({ contentId: 8, voteCount: 2, isVoted: false });
    toggleContentVote.mockResolvedValue({ contentId: 8, voteCount: 3, isVoted: true });
    render(<VoteButton contentId={8}/>);
    const button = await screen.findByRole('button', { name: 'Like this post, 2 likes' });
    fireEvent.click(button);
    await waitFor(() => expect(button).toHaveAttribute('aria-pressed', 'true'));
    expect(button).toHaveTextContent('3');
    expect(toggleContentVote).toHaveBeenCalledWith(8);
  });

  it('renders nested replies and posts a reply to the correct parent', async () => {
    getContentComments.mockResolvedValue({
      content: [{ commentId: 5, userName: 'Lan', body: 'First comment', replies: [
        { commentId: 6, userName: 'Khanh', body: 'Existing reply' },
      ] }], totalElements: 1, totalPages: 1,
    });
    createContentComment.mockResolvedValue({ commentId: 7, userName: 'Khanh', body: 'New reply', parentId: 5 });
    render(<CommentSection contentId={8}/>);
    expect(await screen.findByText('Existing reply')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reply' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Write a reply' }), { target: { value: 'New reply' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post reply' }));
    await waitFor(() => expect(createContentComment).toHaveBeenCalledWith(8, 'New reply', 5));
    expect(await screen.findByText('New reply')).toBeInTheDocument();
  });
});
