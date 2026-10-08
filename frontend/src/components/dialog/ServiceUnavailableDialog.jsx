import { RefreshCw, WifiOff, X } from 'lucide-react';

export default function ServiceUnavailableDialog({ onRetry, onUseDraft, onClose, draftExists }) {
  return (
    <div className="meal-dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="meal-dialog service-unavailable-dialog" role="alertdialog" aria-modal="true" aria-labelledby="service-unavailable-title">
        <header>
          <div><WifiOff size={20} color="var(--color-error, #ef4444)"/><h2 id="service-unavailable-title">Service Unavailable</h2></div>
          <button type="button" className="meal-dialog-close" onClick={onClose} aria-label="Close"><X size={18}/></button>
        </header>
        <div className="service-unavailable-body">
          <p>The AI Meal Planner service is temporarily unavailable. Your changes can still be saved locally on this device.</p>
          {draftExists && <p className="service-unavailable-draft-note">A local draft from a previous session is available.</p>}
        </div>
        <footer>
          {draftExists && <button type="button" className="planner-btn-ghost" onClick={onUseDraft}>Use Local Draft</button>}
          <button type="button" className="planner-btn-primary" onClick={onRetry}><RefreshCw size={15}/> Try Again</button>
        </footer>
      </section>
    </div>
  );
}
