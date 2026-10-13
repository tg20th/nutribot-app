import { useEffect } from 'react';

const getFocusable = (element) => Array.from(element?.querySelectorAll(
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
) ?? []);

export default function useDialogAccessibility(dialogRef, onClose, { enabled = true, closeOnEscape = true } = {}) {
  useEffect(() => {
    if (!enabled || !dialogRef.current) return undefined;
    const dialog = dialogRef.current;
    const previous = document.activeElement;
    const focusable = getFocusable(dialog);
    (focusable[0] ?? dialog).focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && closeOnEscape) {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const currentFocusable = getFocusable(dialog);
      if (!currentFocusable.length) {
        event.preventDefault();
        return;
      }
      const first = currentFocusable[0];
      const last = currentFocusable[currentFocusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    dialog.addEventListener('keydown', handleKeyDown);
    return () => {
      dialog.removeEventListener('keydown', handleKeyDown);
      if (previous && typeof previous.focus === 'function') previous.focus();
    };
  }, [dialogRef, onClose, enabled, closeOnEscape]);
}
