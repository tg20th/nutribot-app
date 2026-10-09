import { X } from 'lucide-react';

export default function NutritionOverflowDialog({ overflow, isAddMode, onKeep, onCancel }) {
  if (!overflow) return null;
  const { details } = overflow;
  const metrics = [
    { label: 'Calories', value: details.calorie, unit: 'kcal' },
    { label: 'Protein', value: details.protein, unit: 'g' },
    { label: 'Carbs', value: details.carbs, unit: 'g' },
    { label: 'Fat', value: details.fats, unit: 'g' }
  ];

  return (
    <div className="meal-dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <section className="meal-dialog nutrition-overflow-dialog" role="alertdialog" aria-modal="true" aria-labelledby="overflow-title" aria-describedby="overflow-description">
        <header>
          <h2 id="overflow-title">Nutrition Target Exceeded</h2>
          <button type="button" className="meal-dialog-close" onClick={onCancel} aria-label="Close"><X size={18}/></button>
        </header>
        <div className="overflow-body">
          <p id="overflow-description">This dish goes over your daily target.</p>
          <div className="overflow-metrics" aria-label="Nutrition target comparison">
            {metrics.map(({ label, value, unit }) => (
              <div className={`overflow-row${value ? ' is-exceeded' : ''}`} key={label}>
                <span>{label}</span>
                {value ? (
                  <span className="overflow-values"><b>{value.actual}</b> / {value.goal} {unit}<em>+{value.excess} {unit}</em></span>
                ) : <span className="overflow-within">Within target</span>}
              </div>
            ))}
          </div>
        </div>
        <footer>
          <button type="button" className="planner-btn-ghost" onClick={onCancel}>Cancel</button>
          <button type="button" className="planner-btn-primary overflow-confirm-btn" onClick={onKeep}>
            {isAddMode ? 'Choose Another Dish' : 'Keep Replacement'}
          </button>
        </footer>
      </section>
    </div>
  );
}
