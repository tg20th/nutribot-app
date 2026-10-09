import { useEffect, useState } from 'react';
import { ChevronDown, Loader2, Sparkles, X } from 'lucide-react';

const MEALS = [['breakfast', 'Breakfast'], ['lunch', 'Lunch'], ['dinner', 'Dinner']];

export default function MenuPreviewModal({ preview, isSaving, saveError, onDismissError, onClose, onSave, onRequestReplace }) {
  const [expandedDay, setExpandedDay] = useState(null);
  const calories = Math.round(preview.weeklyPlan.reduce((total, day) => total + MEALS.reduce((sum, [field]) => sum + ((Number(day[field]?.calories) || 0) * (Number(day[field]?.servings) || 1)), 0), 0) / 7);
  const target = Number(preview.nutritionTarget?.calories);
  const onTarget = Number.isFinite(target) && target > 0 && calories <= target;
  useEffect(() => {
    if (!saveError) return undefined;
    const timer = window.setTimeout(onDismissError, 4000);
    return () => window.clearTimeout(timer);
  }, [saveError, onDismissError]);

  return <div className="meal-dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !isSaving && onClose()}>
    <section className="meal-dialog ai-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="ai-preview-title">
      <header className="ai-preview-header"><div><span><Sparkles size={12}/> AI MEAL PLANNER</span><h2 id="ai-preview-title">Your weekly menu</h2><p>{preview.vegetarianType || preview.dietaryGoal || 'Personalized menu'} · 7 days</p></div><div><em>Preview</em><button type="button" className="meal-dialog-close" onClick={onClose} disabled={isSaving} aria-label="Close meal preview"><X size={18}/></button></div></header>
      <div className="ai-preview-summary"><div><span>DAILY AVERAGE</span><b>{calories.toLocaleString()} <small>/ {Number.isFinite(target) ? Math.round(target).toLocaleString() : '—'} kcal</small></b></div>{onTarget && <strong>On target</strong>}</div>
      <div className="ai-preview-days">{preview.weeklyPlan.slice(0, 7).map((day, dayIndex) => { const open = expandedDay === dayIndex; const names = MEALS.map(([field]) => day[field]?.dishName || 'Unresolved dish').join(' · '); return <article className={open ? 'is-open' : ''} key={`${day.day}-${dayIndex}`}><button type="button" className="ai-preview-day-toggle" onClick={() => setExpandedDay(open ? null : dayIndex)} aria-expanded={open}><span>{String(dayIndex + 1).padStart(2, '0')}</span><b>{day.day || `Day ${dayIndex + 1}`}</b><div><strong>{names}</strong><small>Breakfast · Lunch · Dinner</small></div><ChevronDown size={16}/></button>{open && <div className="ai-preview-day-meals">{MEALS.map(([field, label]) => <div key={field}><span>{label}</span><b>{day[field]?.dishName || 'Unresolved dish'}</b><button type="button" onClick={() => onRequestReplace(dayIndex, field, label)} disabled={isSaving}>Replace</button></div>)}</div>}</article>; })}</div>
      {saveError && <div className="ai-preview-error" role="alert"><span>{saveError}</span><button type="button" onClick={onDismissError} aria-label="Dismiss warning"><X size={15}/></button></div>}
      <footer><button type="button" className="planner-btn-ghost" onClick={() => setExpandedDay(null)} disabled={isSaving}>Collapse all</button><button type="button" className="planner-btn-primary" onClick={onSave} disabled={isSaving}>{isSaving ? <><Loader2 size={15} className="is-spinning"/> Saving...</> : 'Save meal plan'}</button></footer>
    </section>
  </div>;
}
