const baseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message, status, payload) { super(message); this.name = 'ApiError'; this.status = status; this.payload = payload; }
}

export async function apiRequest(path, options = {}) {
  const { body, headers, signal, token, ...requestOptions } = options;
  const authToken = token ?? (typeof window !== 'undefined' ? localStorage.getItem('nutribot-auth-token') : null);
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const response = await fetch(`${baseUrl}${path}`, { ...requestOptions, signal, headers: { Accept: 'application/json', ...(body && !isFormData ? { 'Content-Type': 'application/json' } : {}), ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}), ...headers }, body });
  if (response.status === 204) return null;
  const contentType = response.headers.get('content-type') ?? '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) throw new ApiError(payload?.message || `Request failed (${response.status})`, response.status, payload);
  return payload;
}
export const unwrapData = (payload, fallback = []) => Array.isArray(payload) ? payload : payload?.data ?? payload?.items ?? payload?.results ?? fallback;
