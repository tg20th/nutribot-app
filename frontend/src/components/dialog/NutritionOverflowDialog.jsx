import { AlertTriangle, X } from 'lucide-react';

export default function NutritionOverflowDialog({ overflow, isAddMode, onKeep, onCancel }) {
  if (!overflow) return null;
  const { details } = overflow;
  return (
    <div className="meal-dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <section className="meal-dialog nutrition-overflow-dialog" role="alertdialog" aria-modal="true" aria-labelledby="overflow-title" aria-describedby="overflow-description">
        <header>
          <div><AlertTriangle size={20} color="var(--color-warning, #f59e0b)"/><h2 id="overflow-title">Nutrition Target Exceeded</h2></div>
          <button type="button" className="meal-dialog-close" onClick={onCancel} aria-label="Close"><X size={18}/></button>
        </header>
        <div className="overflow-body">
          <p id="overflow-description">Adding this dish will exceed your daily nutrition targets.</p>
          <div className="overflow-metrics">
            <div className="overflow-row">
              <span>Calories</span>
              <span><b>{details.calorie.actual}</b> / {details.calorie.goal} kcal <em>exceeded by {details.calorie.excess}</em></span>
            </div>
            {details.protein && (
              <div className="overflow-row">
                <span>Protein</span>
                <span><b>{details.protein.actual}</b> / {details.protein.goal}g <em>exceeded by {details.protein.excess}g</em></span>
              </div>
            )}
            {details.carbs && (
              <div className="overflow-row">
                <span>Carbs</span>
                <span><b>{details.carbs.actual}</b> / {details.carbs.goal}g <em>exceeded by {details.carbs.excess}g</em></span>
              </div>
            )}
            {details.fats && (
              <div className="overflow-row">
                <span>Fat</span>
                <span><b>{details.fats.actual}</b> / {details.fats.goal}g <em>exceeded by {details.fats.excess}g</em></span>
              </div>
            )}
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
