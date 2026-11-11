const LOGIN_MESSAGES = {
  INVALID_CREDENTIALS: 'Incorrect email or password.',
  PENDING_VERIFY: 'Your account is not verified. Please verify your email address.',
  ACCOUNT_BLOCKED: 'Your account has been locked. You cannot sign in.'
};

function normalizeMessage(message) {
  return String(message ?? '').normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

const normalizedMessages = Object.fromEntries(
  Object.entries(LOGIN_MESSAGES).map(([state, message]) => [state, normalizeMessage(message)])
);

/** Maps only the current login API's exact 400 messages to presentation states. */
export function getLoginErrorState(error) {
  if (error?.status === 400) {
    const message = normalizeMessage(error.message);
    if (message.includes('account has been suspended') || message.includes('account has been banned') || message.includes('account has been locked')) return 'ACCOUNT_BLOCKED';
    for (const [state, expectedMessage] of Object.entries(normalizedMessages)) {
      if (message === expectedMessage) return state;
    }
  }

  if (error?.status == null) return 'NETWORK_ERROR';
  if (error.status >= 500) return 'SERVER_ERROR';
  return 'LOGIN_ERROR';
}

export function getLoginErrorMessage(state) {
  switch (state) {
    case 'ACCOUNT_BLOCKED': return 'Your account has been suspended or locked. Please contact support for assistance.';
    case 'PENDING_VERIFY': return 'Please verify your email address before signing in.';
    case 'INVALID_CREDENTIALS': return 'Incorrect email or password.';
    case 'NETWORK_ERROR': return 'Unable to connect. Please check your connection and try again.';
    case 'SERVER_ERROR': return 'Something went wrong. Please try again later.';
    default: return 'We could not sign you in. Please try again.';
  }
}

export function getOAuthErrorState({ error, token, username, role }) {
  if (String(error || '').trim().toUpperCase() === 'ACCOUNT_BANNED') return 'ACCOUNT_BLOCKED';
  return error || !token || !username || !role ? 'OAUTH_FAILED' : null;
}

export function getApiAuthFailureState(status, hasAuthToken) {
  return status === 401 && hasAuthToken ? 'SESSION_EXPIRED' : null;
}

export function getAuthFailureMessage(state) {
  switch (state) {
    case 'OAUTH_FAILED': return 'Google sign-in could not be completed. Please try again or use email sign-in.';
    case 'SESSION_EXPIRED': return 'Your session has expired. Please sign in again.';
    default: return getLoginErrorMessage(state);
  }
}
