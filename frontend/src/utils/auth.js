/**
 * Check whether the current user is authenticated (has a valid auth token).
 */
export function isAuthenticated() {
  return Boolean(localStorage.getItem('nutribot-auth-token'));
}

/**
 * Decode JWT token to get payload (without verification)
 * Used for extracting username from stored auth token
 */
export function decodeJWT(token) {
  if (!token) return null;
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

/**
 * Checks the standard JWT expiry claim before a protected screen renders.
 * The server remains the source of truth, but this prevents an expired token
 * from keeping the admin shell open while every request fails.
 */
export function isTokenExpired(token, now = Date.now()) {
  const expiresAt = Number(decodeJWT(token)?.exp);
  return Number.isFinite(expiresAt) && expiresAt * 1000 <= now;
}

export function clearAuthentication() {
  localStorage.removeItem('nutribot-auth-token');
  localStorage.removeItem('nutribot-user');
  window.dispatchEvent(new CustomEvent('nutribot-auth-changed'));
}

/**
 * Get username from stored JWT token
 */
export function getUsernameFromToken() {
  const token = localStorage.getItem('nutribot-auth-token');
  if (!token) return null;
  const payload = decodeJWT(token);
  return payload?.sub || payload?.username || payload?.preferred_username || null;
}

/**
 * Get current user info from JWT token
 */
export function getCurrentUserFromToken() {
  const token = localStorage.getItem('nutribot-auth-token');
  if (!token || isTokenExpired(token)) return null;
  const payload = decodeJWT(token);
  return {
    username: payload?.sub || payload?.username || payload?.preferred_username || null,
    role: payload?.role || payload?.roles || null,
    userId: payload?.userId || payload?.id || null,
  };
}

/**
 * Check whether a role value represents an administrator role.
 */
export function isAdminRole(role) {
  const normalizedRole = String(role ?? '').trim().toUpperCase();
  return normalizedRole === 'ADMIN' || normalizedRole === 'ROLE_ADMIN';
}
