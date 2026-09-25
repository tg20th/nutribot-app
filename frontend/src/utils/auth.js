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
  if (!token) return null;
  const payload = decodeJWT(token);
  return {
    username: payload?.sub || payload?.username || payload?.preferred_username || null,
    role: payload?.role || payload?.roles || null,
    userId: payload?.userId || payload?.id || null,
  };
}
