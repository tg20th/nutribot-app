import { act, fireEvent, render, screen } from '@testing-library/react';
import { StrictMode, useEffect } from 'react';
import { ToastProvider, TOAST_DURATIONS, useToast } from '../ToastProvider';
import ToastViewport from '../ToastViewport';

let api;

function Harness({ action }) {
  const { toast } = useToast();
  api = toast;
  useEffect(() => { action?.(toast); }, [action, toast]);
  return <ToastViewport />;
}

function renderToast(action) {
  return render(<ToastProvider><Harness action={action} /></ToastProvider>);
}

function expire(duration) {
  act(() => { vi.advanceTimersByTime(duration + 240); });
}

describe('ToastProvider lifecycle', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.runOnlyPendingTimers(); vi.useRealTimers(); });

  it.each([
    ['success', 'Saved.', TOAST_DURATIONS.success],
    ['info', 'Heads up.', TOAST_DURATIONS.info],
    ['warning', 'Careful.', TOAST_DURATIONS.warning],
    ['error', 'Failed.', TOAST_DURATIONS.error],
    ['loading', 'Working.', TOAST_DURATIONS.loading],
  ])('%s toasts disappear after their finite duration', (type, message, duration) => {
    renderToast((toast) => toast[type](message));
    expect(screen.getByText(message)).toBeInTheDocument();
    expire(duration);
    expect(screen.queryByText(message)).not.toBeInTheDocument();
  });

  it('gives updated loading success and error toasts fresh timers', () => {
    renderToast((toast) => {
      const id = toast.loading('Working.');
      toast.update(id, { type: 'success', message: 'Done.' });
    });
    act(() => { vi.advanceTimersByTime(TOAST_DURATIONS.success - 1); });
    expect(screen.getByText('Done.')).toBeInTheDocument();
    expire(1);
    expect(screen.queryByText('Done.')).not.toBeInTheDocument();

    renderToast((toast) => {
      const id = toast.loading('Retrying.');
      toast.update(id, { type: 'error', message: 'Failed.' });
    });
    expire(TOAST_DURATIONS.error);
    expect(screen.queryByText('Failed.')).not.toBeInTheDocument();
  });

  it('manual dismissal cancels the timer and waits for the exit animation', () => {
    renderToast((toast) => toast.success('Dismiss me.'));
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }));
    expect(screen.getByText('Dismiss me.')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(239); });
    expect(screen.getByText('Dismiss me.')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(1); });
    expect(screen.queryByText('Dismiss me.')).not.toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(TOAST_DURATIONS.success); });
    expect(screen.queryByText('Dismiss me.')).not.toBeInTheDocument();
  });

  it('removes duplicates and caps visible notifications without orphaning timers', () => {
    renderToast((toast) => {
      toast.success('Same.');
      toast.success('Same.');
      ['One', 'Two', 'Three', 'Four', 'Five'].forEach((message) => toast.info(message));
    });
    expect(screen.getAllByRole('status')).toHaveLength(4);
    act(() => { vi.advanceTimersByTime(TOAST_DURATIONS.info + 240); });
    expect(screen.queryByText('Same.')).not.toBeInTheDocument();
    expect(screen.queryByText('One')).not.toBeInTheDocument();
  });

  it('dismisses the account suspension notification once per incident', () => {
    const message = 'Your account has been suspended or locked. Please contact support for assistance.';
    renderToast((toast) => {
      toast.error(message);
      toast.error(message);
    });
    expect(screen.getAllByText(message)).toHaveLength(1);
    act(() => { vi.advanceTimersByTime(TOAST_DURATIONS.error - 1); });
    expect(screen.getByText(message)).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(1 + 240); });
    expect(screen.queryByText(message)).not.toBeInTheDocument();
  });

  it('allows a new suspension notification after the previous incident has ended', () => {
    const message = 'Your account has been suspended or locked. Please contact support for assistance.';
    renderToast((toast) => toast.error(message));
    expire(TOAST_DURATIONS.error);
    expect(screen.queryByText(message)).not.toBeInTheDocument();
    act(() => { api.error(message); });
    expect(screen.getByText(message)).toBeInTheDocument();
  });

  it('dismisses the exact account suspension toast through its DOM close button', () => {
    const message = 'Your account has been suspended or locked. Please contact support for assistance.';
    renderToast((toast) => toast.error(message));
    const toast = screen.getByText(message).closest('.global-toast');
    fireEvent.click(toast.querySelector('[aria-label="Dismiss notification"]'));
    expect(screen.getByText(message)).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(240); });
    expect(screen.queryByText(message)).not.toBeInTheDocument();
  });

  it('does not let an old timer dismiss a newer update with the same id', () => {
    renderToast((toast) => {
      const id = toast.success('First.');
      toast.update(id, { type: 'error', message: 'Second.' });
    });
    act(() => { vi.advanceTimersByTime(TOAST_DURATIONS.success + 240); });
    expect(screen.getByText('Second.')).toBeInTheDocument();
    expire(TOAST_DURATIONS.error - TOAST_DURATIONS.success);
    expect(screen.queryByText('Second.')).not.toBeInTheDocument();
  });

  it('cleans timers when the provider unmounts', () => {
    const view = renderToast((toast) => toast.loading('Unmount me.'));
    view.unmount();
    act(() => { vi.advanceTimersByTime(TOAST_DURATIONS.loading + 240); });
    expect(screen.queryByText('Unmount me.')).not.toBeInTheDocument();
  });

  it('keeps dismissal active through React StrictMode effect probing', () => {
    render(<StrictMode><ToastProvider><Harness action={(toast) => toast.error('Strict mode error.')} /></ToastProvider></StrictMode>);
    expect(screen.getByText('Strict mode error.')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(TOAST_DURATIONS.error + 240); });
    expect(screen.queryByText('Strict mode error.')).not.toBeInTheDocument();
  });
});
