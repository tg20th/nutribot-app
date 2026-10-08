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

  it('expands replies, focuses the inline composer, and posts to the correct parent', async () => {
    getContentComments.mockResolvedValue({
      content: [{ commentId: 5, userName: 'Lan', body: 'First comment', replies: [
        { commentId: 6, userName: 'Khanh', body: 'Existing reply' },
      ] }], totalElements: 1, totalPages: 1,
    });
    createContentComment.mockResolvedValue({ commentId: 7, userName: 'Khanh', body: 'New reply', parentId: 5 });
    render(<CommentSection contentId={8}/>);
    await screen.findByText('First comment');
    fireEvent.click(screen.getByRole('button', { name: 'View replies (1)' }));
    expect(await screen.findByText('Existing reply')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Reply' })[0]);
    const replyInput = screen.getByRole('textbox', { name: 'Reply to Lan' });
    expect(replyInput).toHaveFocus();
    fireEvent.change(replyInput, { target: { value: 'New reply' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Post' })[1]);
    await waitFor(() => expect(createContentComment).toHaveBeenCalledWith(8, 'New reply', 5));
    expect(await screen.findByText('New reply')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Reply to Lan' })).not.toBeInTheDocument();
  });

  it('cancels an inline reply without submitting it', async () => {
    getContentComments.mockResolvedValue({
      content: [{ commentId: 5, userName: 'Lan', body: 'First comment', replies: [] }], totalElements: 1, totalPages: 1,
    });
    render(<CommentSection contentId={8}/>);
    await screen.findByText('First comment');
    fireEvent.click(screen.getByRole('button', { name: 'Reply' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Reply to Lan' }), { target: { value: 'Never sent' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('textbox', { name: 'Reply to Lan' })).not.toBeInTheDocument();
    expect(createContentComment).not.toHaveBeenCalled();
  });

  it('keeps a nested reply under its direct parent', async () => {
    getContentComments.mockResolvedValue({
      content: [{ commentId: 5, userName: 'Lan', body: 'First comment', replies: [
        { commentId: 6, userName: 'Khanh', body: 'First reply', replies: [
          { commentId: 7, userName: 'Minh', body: 'Nested reply' },
        ] },
      ] }], totalElements: 1, totalPages: 1,
    });
    createContentComment.mockResolvedValue({ commentId: 8, userName: 'Lan', body: 'Replying in thread', parentId: 6 });
    render(<CommentSection contentId={8}/>);
    await screen.findByText('First comment');
    fireEvent.click(screen.getByRole('button', { name: 'View replies (2)' }));
    fireEvent.click(screen.getByRole('button', { name: 'View replies (1)' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Reply' })[1]);
    fireEvent.change(screen.getByRole('textbox', { name: 'Reply to Khanh' }), { target: { value: 'Replying in thread' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Post' })[1]);
    await waitFor(() => expect(createContentComment).toHaveBeenCalledWith(8, 'Replying in thread', 6));
    expect(await screen.findByText('Replying in thread')).toBeInTheDocument();
  });
});
