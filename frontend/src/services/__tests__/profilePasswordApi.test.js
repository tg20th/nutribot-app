import { describe, it, expect, vi, beforeEach } from 'vitest';
import { changeMyPassword } from '../profileApi';
import * as apiClient from '../apiClient';

describe('profileApi - changeMyPassword', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('calls PUT /api/v1/users/profile/password with payload for password change', async () => {
    const payload = {
      currentPassword: 'OldPassword@123',
      newPassword: 'NewPassword@456',
      confirmPassword: 'NewPassword@456',
    };

    const mockResponse = {
      success: true,
      message: 'Đổi mật khẩu thành công.',
      data: {
        userId: 1,
        username: 'jenniekim',
        hasPassword: true,
      },
    };

    vi.spyOn(apiClient, 'apiRequest').mockResolvedValue(mockResponse);

    const result = await changeMyPassword(payload);

    expect(apiClient.apiRequest).toHaveBeenCalledWith('/api/v1/users/profile/password', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    expect(result).toEqual(mockResponse.data);
  });

  it('calls PUT /api/v1/users/profile/password with null currentPassword for Google OAuth user setting password', async () => {
    const payload = {
      currentPassword: null,
      newPassword: 'MyNewPassword@123',
      confirmPassword: 'MyNewPassword@123',
    };

    const mockResponse = {
      success: true,
      message: 'Thiết lập mật khẩu thành công. Bạn có thể đăng nhập bằng Google hoặc mật khẩu.',
      data: {
        userId: 61,
        username: 'truong_google',
        hasPassword: true,
        authProvider: 'GOOGLE',
      },
    };

    vi.spyOn(apiClient, 'apiRequest').mockResolvedValue(mockResponse);

    const result = await changeMyPassword(payload);

    expect(apiClient.apiRequest).toHaveBeenCalledWith('/api/v1/users/profile/password', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    expect(result).toEqual(mockResponse.data);
  });
});
