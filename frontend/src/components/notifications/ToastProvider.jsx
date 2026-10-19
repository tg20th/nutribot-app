import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const ToastContext = createContext(null);
const DURATIONS = { success: 4000, info: 5000, warning: 6000 };
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
  const timers = useRef(new Map());
  const exitTimers = useRef(new Map());

  const dismiss = useCallback((id) => {
    window.clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setItems((current) => {
      if (!current.some((item) => item.id === id)) return current;
      return current.map((item) => item.id === id ? { ...item, exiting: true } : item);
    });
    window.clearTimeout(exitTimers.current.get(id));
    exitTimers.current.set(id, window.setTimeout(() => {
      setItems((current) => current.filter((item) => item.id !== id));
      exitTimers.current.delete(id);
    }, 240));
  }, []);

  const update = useCallback((id, options = {}) => {
    setItems((current) => {
      if (!current.some((item) => item.id === id)) return current;
      return current.map((item) => item.id === id ? { ...item, ...options, exiting: false } : item);
    });
    if (options.type === 'loading') {
      window.clearTimeout(timers.current.get(id));
      timers.current.delete(id);
    }
    if (options.type && DURATIONS[options.type]) {
      window.clearTimeout(timers.current.get(id));
      timers.current.set(id, window.setTimeout(() => dismiss(id), DURATIONS[options.type]));
    }
    return id;
  }, [dismiss]);

  const push = useCallback((type, message, options = {}) => {
    const id = options.id || makeId();
    setItems((current) => {
      const existing = options.id && current.some((item) => item.id === options.id);
      if (existing) return current.map((item) => item.id === id ? { ...item, type, message, ...options, exiting: false } : item);
      return [...current.filter((item) => item.message !== message || item.type !== type), { id, type, message, ...options, exiting: false }].slice(-4);
    });
    if (DURATIONS[type]) timers.current.set(id, window.setTimeout(() => dismiss(id), DURATIONS[type]));
    return id;
  }, [dismiss]);

  useEffect(() => () => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    exitTimers.current.forEach((timer) => window.clearTimeout(timer));
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
