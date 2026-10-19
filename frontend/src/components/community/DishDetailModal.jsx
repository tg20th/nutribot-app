import { useEffect, useState } from 'react';
import { Clock3, Loader2, UserRound, UsersRound, X } from 'lucide-react';
import { getDishDetail } from '../../services/dishService';
import '../../styles/dish-detail.css';
import '../../styles/dish-detail-fixes.css';

export default function DishDetailModal({ meal, onClose, initialDish = null }) {
  const [dish, setDish] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    if (initialDish) { setDish(initialDish); setError(''); return undefined; }
    setDish(null);
    setError('');
    getDishDetail(meal.dishId, controller.signal)
      .then(setDish)
      .catch((failure) => {
        if (!controller.signal.aborted) setError(failure.status === 404 ? 'This dish is no longer available.' : 'We could not load this dish right now.');
      });
    return () => controller.abort();
  }, [initialDish, meal.dishId]);

  const facts = dish && [['Calories', dish.calories, 'kcal'], ['Protein', dish.proteinG, 'g'], ['Carbs', dish.carbsG, 'g'], ['Fat', dish.healthyFatsG, 'g']].filter(([, value]) => value != null);

  return <div className="dish-detail-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="dish-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="dish-detail-title">
      <header className="dish-detail-topbar">
        <button type="button" onClick={onClose} aria-label="Close dish details"><X size={18} /></button>
      </header>
      <div className="dish-detail-scroll">
        {!dish && !error && <div className="dish-detail-state"><Loader2 className="is-spinning" size={22} /><span>Loading dish details...</span></div>}
        {error && <div className="dish-detail-state dish-detail-state--error" role="alert"><p>{error}</p><button type="button" onClick={onClose}>Return to weekly menu</button></div>}
        {dish && <div className="dish-detail-content">
          <header className="dish-detail-hero">
            <div>
              <span>Recipe detail</span>
              <h2 id="dish-detail-title">{dish.name}</h2>
              <div className="dish-detail-facts">
                {dish.servings != null && <span><UsersRound size={15} />{dish.servings} servings</span>}
                {dish.prepTimeMinutes != null && <span><Clock3 size={15} />{dish.prepTimeMinutes} min prep</span>}
                {dish.cookTimeMinutes != null && <span><Clock3 size={15} />{dish.cookTimeMinutes} min cook</span>}
              </div>
            </div>
            {dish.imageUrl && <img src={dish.imageUrl} alt={dish.name} />}
          </header>
          {dish.sourceAuthorName && (
            <p className="dish-detail-attribution">
              {dish.sourceAuthorAvatar
                ? <img className="dish-detail-attribution-avatar" src={dish.sourceAuthorAvatar} alt="" aria-hidden="true" />
                : <span className="dish-detail-attribution-icon" aria-hidden="true"><UserRound size={14} /></span>}
              <span>Community recipe shared by <b>{dish.sourceAuthorName}</b></span>
            </p>
          )}
          {facts.length > 0 && <section className="dish-detail-nutrition">{facts.map(([label, value, unit]) => <div key={label}><b><span className="dish-detail-nutrition-value">{value}</span><small className="dish-detail-nutrition-unit">{unit}</small></b><span>{label}</span></div>)}</section>}
          <div className="dish-detail-grid">
            {dish.ingredients.length > 0 && <section><span>Ingredients</span><h3>What you need</h3><ul>{dish.ingredients.map((item, index) => <li key={index}>{[item.quantity, item.unit, item.name ?? item.ingredientName].filter(Boolean).join(' ')}</li>)}</ul></section>}
            {dish.steps.length > 0 && <section><span>Method</span><h3>Cook step by step</h3><ol className="detail-method-steps">{dish.steps.map((step, index) => <li key={index}><b>{String(index + 1).padStart(2, '0')}</b><p>{step.description ?? step.instruction ?? step}</p></li>)}</ol></section>}
          </div>
          {!dish.ingredients.length && !dish.steps.length && <p className="dish-detail-empty">Recipe instructions are not available for this dish yet.</p>}
        </div>}
      </div>
    </section>
  </div>;
}
