// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminLayout from '../AdminLayout';
import * as apiClient from '../../services/apiClient';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../services/profileApi', () => ({
  getMyProfile: vi.fn().mockResolvedValue({ fullName: 'System Admin', avatarUrl: '' }),
}));

describe('AdminLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('nutribot-auth-token', 'mock-admin-token');
    localStorage.setItem('nutribot-user', JSON.stringify({ username: 'admin' }));
    localStorage.setItem('nutribot-dev-role', 'ADMIN');
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('renders admin shell and triggers full logout on clicking logout button', async () => {
    const apiRequestSpy = vi.spyOn(apiClient, 'apiRequest').mockResolvedValue({ success: true });
    const authChangedListener = vi.fn();
    window.addEventListener('nutribot-auth-changed', authChangedListener);

    render(
      <MemoryRouter>
        <AdminLayout />
      </MemoryRouter>
    );

    const logoutButton = screen.getByRole('button', { name: /log out/i });
    expect(logoutButton).toBeInTheDocument();

    fireEvent.click(logoutButton);

    await waitFor(() => {
      expect(apiRequestSpy).toHaveBeenCalledWith('/api/v1/auth/logout', { method: 'POST' });
    });

    expect(localStorage.getItem('nutribot-auth-token')).toBeNull();
    expect(localStorage.getItem('nutribot-user')).toBeNull();
    expect(localStorage.getItem('nutribot-dev-role')).toBeNull();
    expect(authChangedListener).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });

    window.removeEventListener('nutribot-auth-changed', authChangedListener);
  });
});
