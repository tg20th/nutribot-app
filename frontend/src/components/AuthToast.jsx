import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import '../styles/auth-toast.css';

export default function AuthToast({ error, success }) {
  const message = error || success;
  const [visible, setVisible] = useState(Boolean(message));

  useEffect(() => {
    setVisible(Boolean(message));
    if (!message) return undefined;
    const timer = window.setTimeout(() => setVisible(false), 3000);
    return () => window.clearTimeout(timer);
  }, [message]);

  if (!message && !visible) return null;
  return (
    <div className={`auth-toast ${error ? 'auth-toast-error' : 'auth-toast-success'}${visible ? ' is-visible' : ''}`} role={error ? 'alert' : 'status'}>
      {error ? <AlertCircle size={17} aria-hidden="true" /> : <CheckCircle2 size={17} aria-hidden="true" />}
      <span>{message}</span>
    </div>
  );
}
