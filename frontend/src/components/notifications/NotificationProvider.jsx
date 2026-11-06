import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getUnreadNotificationCount } from '../../services/notificationsApi';

const defaultNotificationContext = {
  unreadCount: 0,
  refreshUnreadCount: async () => {},
  changeUnreadCount: () => {}
};
const NotificationContext = createContext(defaultNotificationContext);
const AUTH_TOKEN_KEY = 'nutribot-auth-token';
const POLL_INTERVAL_MS = 30000;

export function NotificationProvider({ children }) {
  const [authToken, setAuthToken] = useState(() => localStorage.getItem(AUTH_TOKEN_KEY) || '');
  const [unreadCount, setUnreadCount] = useState(0);
  const requestController = useRef(null);
  const requestInFlight = useRef(false);
  const requestVersion = useRef(0);
  const mutationVersion = useRef(0);

  const refreshUnreadCount = useCallback(async ({ force = false } = {}) => {
    if (!authToken) {
      setUnreadCount(0);
      return;
    }
    if (force) {
      requestController.current?.abort();
      requestInFlight.current = false;
      requestVersion.current += 1;
    }
    if (requestInFlight.current) return;

    requestInFlight.current = true;
    const version = ++requestVersion.current;
    const mutationAtRequest = mutationVersion.current;
    const controller = new AbortController();
    requestController.current = controller;

    try {
      const count = await getUnreadNotificationCount(controller.signal);
      const tokenStillActive = localStorage.getItem(AUTH_TOKEN_KEY) === authToken;
      if (!controller.signal.aborted
        && tokenStillActive
        && version === requestVersion.current
        && mutationAtRequest === mutationVersion.current) {
        setUnreadCount(count);
      }
    } catch (error) {
      if (error.name !== 'AbortError') return;
    } finally {
      if (requestController.current === controller) requestInFlight.current = false;
    }
  }, [authToken]);

  const changeUnreadCount = useCallback((updater) => {
    mutationVersion.current += 1;
    setUnreadCount(updater);
  }, []);

  useEffect(() => {
    requestController.current?.abort();
    requestController.current = null;
    requestInFlight.current = false;
    requestVersion.current += 1;
    mutationVersion.current += 1;
    setUnreadCount(0);

    if (!authToken) return undefined;

    refreshUnreadCount();
    const refreshWhenActive = () => {
      if (document.visibilityState === 'visible') refreshUnreadCount({ force: true });
    };
    const timer = window.setInterval(() => refreshUnreadCount(), POLL_INTERVAL_MS);
    window.addEventListener('focus', refreshWhenActive);
    document.addEventListener('visibilitychange', refreshWhenActive);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshWhenActive);
      document.removeEventListener('visibilitychange', refreshWhenActive);
      requestController.current?.abort();
    };
  }, [authToken, refreshUnreadCount]);

  useEffect(() => {
    const syncAuth = () => {
      const nextToken = localStorage.getItem(AUTH_TOKEN_KEY) || '';
      setAuthToken((currentToken) => nextToken === currentToken ? currentToken : nextToken);
      if (nextToken === authToken && nextToken) refreshUnreadCount({ force: true });
    };
    const handleStorage = (event) => {
      if (event.key === AUTH_TOKEN_KEY) syncAuth();
    };
    window.addEventListener('nutribot-auth-changed', syncAuth);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('nutribot-auth-changed', syncAuth);
      window.removeEventListener('storage', handleStorage);
    };
  }, [authToken, refreshUnreadCount]);

  const value = useMemo(() => ({ unreadCount, refreshUnreadCount, changeUnreadCount }), [unreadCount, refreshUnreadCount, changeUnreadCount]);
  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotificationUnreadCount() {
  return useContext(NotificationContext);
}
