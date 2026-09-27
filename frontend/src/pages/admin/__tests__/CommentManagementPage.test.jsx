// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import CommentManagementPage from '../CommentManagementPage';
import { adminCommentsApi } from '../../../services/adminCommentsApi';

vi.mock('../../../services/adminCommentsApi', () => ({
  adminCommentsApi: { list: vi.fn(), remove: vi.fn() },
}));

const first = {
  commentId: 11, username: 'minhanh', userEmail: 'minhanh@example.com',
  body: 'This recipe helped me plan lunch.', status: 'published',
  contentId: 8, contentTitle: 'Healthy lunch', contentType: 'BLOG',
  createdAt: '2026-09-26T08:30:00',
};
const second = {
  commentId: 12, username: 'nutribot', body: 'Please check the ingredients.',
  status: 'hidden', contentId: 9, contentTitle: 'Fresh produce',
  contentType: 'VIDEO', createdAt: '2026-09-25T10:15:00',
};

describe('NB-39 comment management', () => {
  beforeEach(() => {
    adminCommentsApi.list.mockResolvedValue({ content: [first, second], totalPages: 1, totalElements: 2 });
    adminCommentsApi.remove.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('shows real backend fields and opens a selected comment', async () => {
    render(<CommentManagementPage />);
    expect((await screen.findAllByText(first.body)).length).toBe(2);
    expect(adminCommentsApi.list).toHaveBeenCalledWith({ page: 0, size: 10 }, expect.any(AbortSignal));
    fireEvent.click(screen.getByRole('button', { name: /Please check the ingredients/ }));
    expect(screen.getByText('Fresh produce', { selector: 'strong' })).toBeTruthy();
    expect(screen.getAllByText('Hidden').length).toBe(2);
  });

  it('requires confirmation before deleting and then refreshes', async () => {
    render(<CommentManagementPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Delete comment' }));
    expect(adminCommentsApi.remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('dialog').querySelector('.admin-btn.danger'));
    await waitFor(() => expect(adminCommentsApi.remove).toHaveBeenCalledWith(11));
    await waitFor(() => expect(adminCommentsApi.list).toHaveBeenCalledTimes(2));
  });

  it('uses server pagination and handles a failed request', async () => {
    adminCommentsApi.list
      .mockResolvedValueOnce({ content: [first], totalPages: 2, totalElements: 11 })
      .mockRejectedValueOnce(new Error('Server unavailable'));
    render(<CommentManagementPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Next page' }));
    await waitFor(() => expect(adminCommentsApi.list).toHaveBeenLastCalledWith({ page: 1, size: 10 }, expect.any(AbortSignal)));
    expect(await screen.findByText('We could not load this page.')).toBeTruthy();
  });
});
