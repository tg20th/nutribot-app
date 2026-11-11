import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CommentSection from '../CommentSection';

afterEach(() => cleanup());

const comment = (userId) => ({ commentId: 1, userId, userName: 'Member', body: 'My comment', createdAt: '2026-11-11T10:00:00Z', replies: [] });

describe('CommentSection ownership actions', () => {
  it.each([
    ['number', 42, '42'],
    ['string', '42', 42],
  ])('shows Delete for the owner when IDs differ by %s type', async (_label, currentUserId, commentUserId) => {
    render(<MemoryRouter><CommentSection contentId={195} currentUser={{ userId: currentUserId }} loadComments={vi.fn().mockResolvedValue({ content: [comment(commentUserId)], totalPages: 1, totalElements: 1 })} /></MemoryRouter>);
    expect(await screen.findByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('does not show Delete for another user', async () => {
    render(<MemoryRouter><CommentSection contentId={195} currentUser={{ userId: 7 }} loadComments={vi.fn().mockResolvedValue({ content: [comment(42)], totalPages: 1, totalElements: 1 })} /></MemoryRouter>);
    await screen.findByText('My comment');
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });

  it('opens the custom confirmation dialog and does not call delete until confirmed', async () => {
    const deleteComment = vi.fn().mockResolvedValue(true);
    render(<MemoryRouter><CommentSection contentId={195} currentUser={{ userId: 42 }} deleteComment={deleteComment} loadComments={vi.fn().mockResolvedValue({ content: [comment(42)], totalPages: 1, totalElements: 1 })} /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(screen.getByRole('dialog', { name: 'Delete comment?' })).toBeInTheDocument();
    expect(deleteComment).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(deleteComment).not.toHaveBeenCalled();
  });
});
