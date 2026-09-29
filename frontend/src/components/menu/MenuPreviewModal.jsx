import { AlertTriangle, CheckCircle2, Loader2, Save, X } from 'lucide-react';

const MEALS = [['breakfast', 'Breakfast'], ['lunch', 'Lunch'], ['dinner', 'Dinner']];

const nutrition = (value, unit) => Number.isFinite(Number(value)) ? `${Math.round(Number(value))}${unit}` : 'Unknown';

export default function MenuPreviewModal({ preview, dishes, isSaving, saveError, onClose, onSave, onUse, onReplace }) {
  const unresolved = preview.weeklyPlan.some((day) => MEALS.some(([field]) => !Number.isInteger(day[field]?.dishId)));
  const total = preview.weeklyPlan.reduce((sum, day) => {
    const dayCalories = MEALS.map(([field]) => day[field]?.calories).every((value) => Number.isFinite(Number(value)))
      ? MEALS.reduce((value, [field]) => value + (Number(day[field].calories) * Number(day[field].servings ?? 1)), 0)
      : null;
    return sum == null || dayCalories == null ? null : sum + dayCalories;
  }, 0);

  return <div className="meal-dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !isSaving && onClose()}>
    <section className="meal-dialog ai-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="ai-preview-title">
      <header><div><span>Unsaved AI preview</span><h2 id="ai-preview-title">{preview.suggestedMenuTitle || 'Your seven-day menu'}</h2><p>This preview has not been saved. Choose a catalog dish to replace any meal before saving.</p></div><button type="button" className="meal-dialog-close" onClick={onClose} disabled={isSaving} aria-label="Close meal preview"><X size={18}/></button></header>
      <div className="ai-preview-summary"><span>Preview nutrition</span><b>{total == null ? 'Unknown' : `${Math.round(total / 7)} kcal per day`}</b><small>Totals use known canonical dish nutrition only.</small></div>
      <div className="ai-preview-days">{preview.weeklyPlan.slice(0, 7).map((day, dayIndex) => <article key={`${day.day}-${dayIndex}`}><header><span>{String(dayIndex + 1).padStart(2, '0')}</span><b>{day.day || `Day ${dayIndex + 1}`}</b></header><div className="ai-preview-meals">{MEALS.map(([field, label]) => {
        const meal = day[field] ?? {};
        const canonical = Number.isInteger(meal.dishId);
        return <label key={field}><span>{label}</span><select value={canonical ? String(meal.dishId) : ''} onChange={(event) => { const dish = dishes.find((item) => String(item.dishId) === event.target.value); if (dish) onReplace(dayIndex, field, dish); }} disabled={isSaving}><option value="">{canonical ? meal.dishName : 'Custom or unresolved suggestion'}</option>{dishes.map((dish) => <option key={dish.dishId} value={dish.dishId}>{dish.name}</option>)}</select><small>{canonical ? `${nutrition(meal.calories, ' kcal')} · ${nutrition(meal.proteinG, 'g protein')}` : 'Custom text cannot be saved until replaced with a catalog dish.'}</small></label>;
      })}</div></article>)}</div>
      {(unresolved || saveError) && <div className="ai-preview-warning" role="alert"><AlertTriangle size={16}/><span>{saveError || 'Replace every unresolved suggestion with a valid catalog dish before saving.'}</span></div>}
      <footer><button type="button" className="planner-btn-ghost" onClick={onClose} disabled={isSaving}>Edit request</button><button type="button" className="planner-btn-ghost" onClick={onSave} disabled={isSaving || unresolved}>{isSaving ? <Loader2 size={15} className="is-spinning"/> : <Save size={15}/>} {isSaving ? 'Saving...' : 'Save to my plans'}</button><button type="button" className="planner-btn-primary" onClick={onUse} disabled={isSaving || unresolved}><CheckCircle2 size={15}/> Use this plan</button></footer>
    </section>
  </div>;
}
