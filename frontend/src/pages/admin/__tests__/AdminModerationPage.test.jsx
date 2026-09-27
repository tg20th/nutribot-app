// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AdminModerationPage from '../AdminModerationPage';
import { adminApi } from '../../../services/adminApi';

vi.mock('../../../services/adminApi', () => ({
  adminApi: {
    getModerationQueue: vi.fn(),
    moderateContent: vi.fn(),
  },
}));

const first = { id: 1, type: 'BLOG', title: 'Healthy lunch ideas', status: 'pending', author: 'minhanh', submittedAt: '2026-09-26T08:30:00', body: 'A short article preview.' };
const second = { id: 2, type: 'VIDEO', title: 'Prep fresh produce', status: 'pending', author: 'nutribot', submittedAt: '2026-09-25T10:15:00' };

describe('admin moderation screen', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/admin/moderation');
    adminApi.getModerationQueue.mockResolvedValue({ content: [first, second], totalElements: 2, totalPages: 1 });
    adminApi.moderateContent.mockResolvedValue({ ...first, status: 'rejected' });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('searches loaded queue entries and keeps title and submission text separate', async () => {
    render(<AdminModerationPage />);
    expect(await screen.findByText('A short article preview.')).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: 'Search title or author' }), { target: { value: 'produce' } });
    expect(screen.getByRole('heading', { level: 2, name: 'Prep fresh produce' })).toBeTruthy();
    expect(screen.queryByText('Healthy lunch ideas')).toBeNull();
  });

  it('confirms rejection and sends the backend action code', async () => {
    render(<AdminModerationPage />);
    fireEvent.click(await screen.findByRole('button', { name: /Reject/ }));
    const rejectionButtons = screen.getAllByRole('button', { name: 'Reject' });
    fireEvent.click(rejectionButtons[rejectionButtons.length - 1]);
    await waitFor(() => expect(adminApi.moderateContent).toHaveBeenCalledWith(1, 'REJECT'));
  });
});
