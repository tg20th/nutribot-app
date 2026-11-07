import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const ToastContext = createContext(null);
export const TOAST_DURATIONS = {
  success: 3000,
  info: 4000,
  warning: 5000,
  error: 6000,
  loading: 30000,
};
const fallbackToast = {
  success: () => undefined,
  error: () => undefined,
  warning: () => undefined,
  info: () => undefined,
  loading: () => undefined,
  dismiss: () => undefined,
  update: () => undefined,
};

function makeId() {
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const itemsRef = useRef([]);
  const timers = useRef(new Map());
  const exitTimers = useRef(new Map());
  const mounted = useRef(true);
  const generations = useRef(new Map());
  const dismissRef = useRef(() => undefined);

  const clearTimer = useCallback((id) => {
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const clearExitTimer = useCallback((id) => {
    const timer = exitTimers.current.get(id);
    if (timer) window.clearTimeout(timer);
    exitTimers.current.delete(id);
  }, []);

  const scheduleDismiss = useCallback((id, type) => {
    clearTimer(id);
    const duration = TOAST_DURATIONS[type];
    if (!duration) return;
    const generation = (generations.current.get(id) || 0) + 1;
    generations.current.set(id, generation);
    timers.current.set(id, window.setTimeout(() => {
      if (!mounted.current || generations.current.get(id) !== generation) return;
      timers.current.delete(id);
      dismissRef.current(id);
    }, duration));
  }, [clearTimer]);

  const dismiss = useCallback((id) => {
    clearTimer(id);
    generations.current.delete(id);
    if (!mounted.current) return;
    if (exitTimers.current.has(id)) return;

    const currentItem = itemsRef.current.find((item) => item.id === id);
    if (!currentItem) return;
    setItems((current) => {
      const item = current.find((entry) => entry.id === id);
      if (!item) return current;
      if (item.exiting) return current;
      const next = current.map((entry) => entry.id === id ? { ...entry, exiting: true } : entry);
      itemsRef.current = next;
      return next;
    });

    const exitTimer = window.setTimeout(() => {
      if (!mounted.current) return;
      setItems((current) => {
        const next = current.filter((item) => item.id !== id);
        itemsRef.current = next;
        return next;
      });
      exitTimers.current.delete(id);
    }, 240);
    exitTimers.current.set(id, exitTimer);
  }, [clearExitTimer, clearTimer]);

  dismissRef.current = dismiss;

  const update = useCallback((id, options = {}) => {
    clearTimer(id);
    clearExitTimer(id);
    if (!mounted.current) return id;
    setItems((current) => {
      if (!current.some((item) => item.id === id)) return current;
      const next = current.map((item) => item.id === id ? { ...item, ...options, exiting: false } : item);
      itemsRef.current = next;
      return next;
    });
    if (options.type) scheduleDismiss(id, options.type);
    return id;
  }, [clearExitTimer, clearTimer, scheduleDismiss]);

  const push = useCallback((type, message, options = {}) => {
    const id = options.id || makeId();
    const duplicate = !options.id && itemsRef.current.find((item) => item.message === message && item.type === type);
    if (duplicate) return duplicate.id;
    const duplicateIds = [];
    setItems((current) => {
      current.forEach((item) => {
        if (item.message === message && item.type === type && item.id !== id) duplicateIds.push(item.id);
      });
      const existing = options.id && current.some((item) => item.id === options.id);
      if (existing) {
        const next = current.map((item) => item.id === id ? { ...item, type, message, ...options, exiting: false } : item);
        itemsRef.current = next;
        return next;
      }
      const next = [...current.filter((item) => item.message !== message || item.type !== type), { id, type, message, ...options, exiting: false }];
      const removed = next.slice(0, Math.max(0, next.length - 4));
      removed.forEach((item) => duplicateIds.push(item.id));
      const visible = next.slice(-4);
      itemsRef.current = visible;
      return visible;
    });
    [...new Set(duplicateIds)].forEach((removedId) => {
      clearTimer(removedId);
      clearExitTimer(removedId);
      generations.current.delete(removedId);
    });
    clearExitTimer(id);
    scheduleDismiss(id, type);
    return id;
  }, [clearExitTimer, clearTimer, scheduleDismiss]);

  useEffect(() => {
    // React StrictMode intentionally runs effect cleanup/setup once in development.
    // Re-arm the provider so timers and manual dismissals are not treated as
    // updates after an unmount that was only part of that probe.
    mounted.current = true;

    return () => {
    mounted.current = false;
    // StrictMode immediately performs setup again after this cleanup. Defer
    // destructive timer cleanup by one microtask so that probe cleanup does
    // not cancel live timers; a real unmount still clears everything before
    // the next task can observe the provider.
    queueMicrotask(() => {
      if (mounted.current) return;
      timers.current.forEach((timer) => window.clearTimeout(timer));
      exitTimers.current.forEach((timer) => window.clearTimeout(timer));
      timers.current.clear();
      exitTimers.current.clear();
      generations.current.clear();
    });
    };
  }, []);

  const toast = useMemo(() => ({
    success: (message, options) => push('success', message, options),
    error: (message, options) => push('error', message, options),
    warning: (message, options) => push('warning', message, options),
    info: (message, options) => push('info', message, options),
    loading: (message, options) => push('loading', message, options),
    dismiss,
    update,
  }), [dismiss, push, update]);

  const value = useMemo(() => ({
    toast,
    toasts: items,
  }), [items, toast]);

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast() {
  return useContext(ToastContext) || { toast: fallbackToast, toasts: [] };
}
