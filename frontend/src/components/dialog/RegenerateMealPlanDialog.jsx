import { useRef } from 'react';
import { AlertTriangle, Loader2, RefreshCw, X } from 'lucide-react';
import useDialogAccessibility from '../../hooks/useDialogAccessibility';

export default function RegenerateMealPlanDialog({
  status = 'confirm',
  errorMessage = '',
  onConfirm,
  onRetry,
  onCancel
}) {
  const dialogRef = useRef(null);
  const isLoading = status === 'loading';
  const isError = status === 'error';
  const title = isLoading ? 'Generating Your Meal Plan' : isError ? 'Meal Plan Could Not Be Generated' : 'Generate a New Meal Plan?';
  const description = isLoading
    ? "We're creating a new meal plan for you. This may take a moment."
    : isError
      ? errorMessage || 'We could not generate a new meal plan. Please try again.'
      : 'This will generate a new meal plan preview. Your current plan will remain unchanged until you choose to use the new one.';

  useDialogAccessibility(dialogRef, onCancel, { closeOnEscape: !isLoading });

  const handleBackdropClick = (event) => {
    if (!isLoading && event.target === event.currentTarget) onCancel();
  };

  return (
    <div className="meal-dialog-backdrop" role="presentation" onMouseDown={handleBackdropClick}>
      <section
        ref={dialogRef}
        tabIndex="-1"
        className={`meal-dialog plan-exists-dialog regenerate-plan-dialog is-${status}`}
        role="alertdialog"
        aria-modal="true"
        aria-busy={isLoading}
        aria-labelledby="regenerate-plan-title"
        aria-describedby="regenerate-plan-description"
      >
        <header className="regenerate-plan-header">
          <div className="planner-dialog-heading">
            <span className={`planner-dialog-icon${isError ? ' is-error' : ''}`} aria-hidden="true">
              {isLoading ? <Loader2 size={16} className="is-spinning"/> : isError ? <AlertTriangle size={16}/> : <RefreshCw size={16}/>}
            </span>
            <div className="regenerate-plan-heading-copy">
              <span>AI MEAL PLANNER</span>
              <h2 id="regenerate-plan-title">{title}</h2>
            </div>
          </div>
          <button type="button" className="meal-dialog-close" onClick={onCancel} disabled={isLoading} aria-label="Close">
            <X size={18}/>
          </button>
        </header>

        <div className={`plan-exists-body regenerate-plan-body${isError ? ' has-error' : ''}`}>
          <p id="regenerate-plan-description">{description}</p>
        </div>

        <footer className="regenerate-plan-footer">
          {isLoading ? (
            <>
              <button type="button" className="planner-btn-ghost" disabled>Cancel</button>
              <button type="button" className="planner-btn-primary" disabled><Loader2 size={15} className="is-spinning"/> Generating...</button>
            </>
          ) : isError ? (
            <>
              <button type="button" className="planner-btn-ghost" onClick={onCancel}>Close</button>
              <button type="button" className="planner-btn-primary" onClick={onRetry}><RefreshCw size={15}/> Try Again</button>
            </>
          ) : (
            <>
              <button type="button" className="planner-btn-ghost" onClick={onCancel}>Cancel</button>
              <button type="button" className="planner-btn-primary" onClick={onConfirm}><RefreshCw size={15}/> Re-generate</button>
            </>
          )}
        </footer>
      </section>
    </div>
  );
}
