import { AlertCircle, CheckCircle2, Info, LoaderCircle, TriangleAlert, X } from 'lucide-react';
import { useToast } from './ToastProvider';

const icons = { success: CheckCircle2, error: AlertCircle, warning: TriangleAlert, info: Info, loading: LoaderCircle };
const labels = { success: 'Success', error: 'Something went wrong', warning: 'Please note', info: 'For your information', loading: 'Working' };

export default function ToastViewport() {
  const { toasts, toast } = useToast();
  return <div className="toast-viewport" aria-label="Notifications">
    {toasts.map((item) => {
      const Icon = icons[item.type] || Info;
      const critical = item.type === 'error';
      return <div key={item.id} className={`global-toast global-toast--${item.type}${item.exiting ? ' is-exiting' : ''}`} role={critical ? 'alert' : 'status'} aria-live={critical ? 'assertive' : 'polite'}>
        <span className="global-toast__icon"><Icon className={item.type === 'loading' ? 'global-toast-spinner' : ''} size={16} strokeWidth={1.8} aria-hidden="true" /></span>
        <span className="global-toast__content">
          <strong>{item.title || labels[item.type] || 'Notification'}</strong>
          <span>{item.message}</span>
        </span>
        <button type="button" onClick={() => toast.dismiss(item.id)} aria-label="Dismiss notification"><X size={15} strokeWidth={1.8}/></button>
      </div>;
    })}
  </div>;
}
