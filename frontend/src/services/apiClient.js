import { getApiAuthFailureState } from './loginErrorState';

const baseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message, status, payload) { super(message); this.name = 'ApiError'; this.status = status; this.payload = payload; }
}

export async function apiRequest(path, options = {}) {
  const { body, headers, signal, token, ...requestOptions } = options;
  const authToken = token ?? (typeof window !== 'undefined' ? localStorage.getItem('nutribot-auth-token') : null);
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

  let response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...requestOptions,
      signal,
      headers: {
        Accept: 'application/json',
        ...(body && !isFormData ? { 'Content-Type': 'application/json' } : {}),
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...headers
      },
      body
    });
  } catch (networkError) {
    // Giữ nguyên AbortError để các component phân biệt được request bị hủy vòng đời
    if (networkError.name === 'AbortError') {
      throw networkError;
    }
    throw new ApiError(
      `Không thể kết nối đến máy chủ. Vui lòng kiểm tra:\n1. Backend server đang chạy trên port 8080\n2. Kết nối mạng ổn định\n3. Không có VPN/Firewall chặn kết nối`,
      0,
      { originalError: networkError.message }
    );
  }

  if (response.status === 204) return null;
  const contentType = response.headers.get('content-type') ?? '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    const authFailureState = getApiAuthFailureState(response.status, Boolean(authToken));
    if (authFailureState && typeof window !== 'undefined') {
      localStorage.removeItem('nutribot-auth-token');
      localStorage.removeItem('nutribot-user');
      window.dispatchEvent(new CustomEvent('nutribot-auth-changed'));
      window.dispatchEvent(new CustomEvent('nutribot-auth-failure', { detail: { state: authFailureState } }));
    }
    throw new ApiError(payload?.message || `Yêu cầu thất bại (${response.status})`, response.status, payload);
  }
  return payload;
}
export const unwrapData = (payload, fallback = []) => Array.isArray(payload) ? payload : payload?.data ?? payload?.items ?? payload?.results ?? fallback;
