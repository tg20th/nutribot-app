import { Sparkles, X } from 'lucide-react';

export default function PlanExistsDialog({ onConfirm, onCancel }) {
  return (
    <div className="meal-dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <section className="meal-dialog plan-exists-dialog" role="alertdialog" aria-modal="true" aria-labelledby="plan-exists-title" aria-describedby="plan-exists-description">
        <header>
          <div><Sparkles size={20} color="var(--color-primary, #22c55e)"/><h2 id="plan-exists-title">You Already Have a Plan</h2></div>
          <button type="button" className="meal-dialog-close" onClick={onCancel} aria-label="Close"><X size={18}/></button>
        </header>
        <div className="plan-exists-body">
          <p id="plan-exists-description">Generating a new preview will not replace your saved plan until you choose "Use this plan" or save it. Continue?</p>
        </div>
        <footer>
          <button type="button" className="planner-btn-ghost" onClick={onCancel}>Cancel</button>
          <button type="button" className="planner-btn-primary" onClick={onConfirm}><Sparkles size={15}/> Generate Preview</button>
        </footer>
      </section>
    </div>
  );
}
