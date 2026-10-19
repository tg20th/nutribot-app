import { StrictMode, useEffect } from 'react';
import { render, screen } from '@testing-library/react';
import { ToastProvider, useToast } from '../ToastProvider';
import ToastViewport from '../ToastViewport';

function EffectNotification({ message }) {
  const { toast } = useToast();
  useEffect(() => {
    toast.success(message);
  }, [message, toast]);
  return null;
}

function renderNotification(message = 'Profile saved.') {
  return render(<StrictMode><ToastProvider><EffectNotification message={message}/><ToastViewport/></ToastProvider></StrictMode>);
}

describe('ToastProvider', () => {
  it('keeps the toast API stable for effects under StrictMode', () => {
    renderNotification();
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getByRole('status')).toHaveTextContent('Profile saved.');
  });
});
