// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import UserManagementPage from '../UserManagementPage';
import { adminApi } from '../../../services/adminApi';

vi.mock('../../../services/adminApi', () => ({
  adminApi: {
    getUsers: vi.fn(),
    updateUserStatus: vi.fn(),
  },
}));

const member = {
  id: 7,
  username: 'minh',
  email: 'minh@example.com',
  name: 'Minh',
  role: 'MEMBER',
  status: 'ACTIVE',
  joinedAt: '27 Sep 2026',
};

describe('admin member management', () => {
  beforeEach(() => {
    adminApi.getUsers.mockResolvedValue({ content: [member], totalPages: 1 });
    adminApi.updateUserStatus.mockResolvedValue({ ...member, status: 'BANNED' });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    window.history.replaceState({}, '', '/');
  });

  it('accepts typing in the search field and sends the backend keyword', async () => {
    render(<UserManagementPage />);
    const search = screen.getByPlaceholderText('Search name, email, or username...');
    fireEvent.change(search, { target: { value: 'minh@example.com' } });
    expect(search.value).toBe('minh@example.com');
    await waitFor(() => expect(adminApi.getUsers).toHaveBeenCalledWith(
      { keyword: 'minh@example.com', status: '', page: 0, size: 10 },
      expect.any(AbortSignal),
    ));
  });

  it('uses the NB-36 status contract when locking a member', async () => {
    render(<UserManagementPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Lock Minh' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lock Account' }));
    await waitFor(() => expect(adminApi.updateUserStatus).toHaveBeenCalledWith(7, 'BANNED'));
  });

  it('lets reviewers search and lock sample members without the backend', async () => {
    window.history.replaceState({}, '', '/admin/users?preview=1');
    render(<UserManagementPage />);
    expect(await screen.findByText('Nguyen Minh Anh')).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText('Search name, email, or username...'), { target: { value: 'linh.tran' } });
    expect(screen.queryByText('Nguyen Minh Anh')).toBeNull();
    expect(screen.getByText('Tran Gia Linh')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Unlock Tran Gia Linh' }));
    fireEvent.click(screen.getByRole('button', { name: 'Unlock Account' }));
    expect(await screen.findByRole('button', { name: 'Lock Tran Gia Linh' })).toBeTruthy();
    expect(adminApi.getUsers).not.toHaveBeenCalled();
    expect(adminApi.updateUserStatus).not.toHaveBeenCalled();
  });
});
