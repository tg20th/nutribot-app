import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpenText, Clock3, Loader2, Sparkles, UserRound, UsersRound, X } from 'lucide-react';
import { getDishDetail } from '../../services/dishService';
import UserProfileLink from '../UserProfileLink';
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
  const isCommunityRecipe = Boolean(dish?.sourceAuthorId || dish?.sourceAuthorName || dish?.sourceContentId);
  const canOpenSourcePost = Boolean(isCommunityRecipe && dish?.sourceContentId && dish?.sourceContentPublic);

  return <div className="dish-detail-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="dish-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="dish-detail-title">
      <button className="dish-detail-close" type="button" onClick={onClose} aria-label="Close dish details"><X size={18} /></button>
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
          <section className="dish-detail-attribution" aria-label="Recipe source">
            {isCommunityRecipe ? (
              <>
                {dish.sourceAuthorAvatar
                  ? <img className="dish-detail-attribution-avatar" src={dish.sourceAuthorAvatar} alt="" aria-hidden="true" />
                  : <span className="dish-detail-attribution-icon" aria-hidden="true"><UserRound size={14} /></span>}
                <div className="dish-detail-attribution-copy">
                  <span className="dish-detail-attribution-label">Community contribution</span>
                  {dish.sourceAuthorName && dish.sourceAuthorId != null
                    ? <UserProfileLink userId={dish.sourceAuthorId} className="dish-detail-attribution-author">By {dish.sourceAuthorName}</UserProfileLink>
                    : <span className="dish-detail-attribution-fallback">Contributor details are unavailable.</span>}
                </div>
                {canOpenSourcePost && <Link className="dish-detail-attribution-link" to={`/community/posts/${dish.sourceContentId}`}>View original post <BookOpenText size={14} /></Link>}
              </>
            ) : (
              <>
                <span className="dish-detail-attribution-icon" aria-hidden="true"><Sparkles size={14} /></span>
                <div className="dish-detail-attribution-copy"><span className="dish-detail-attribution-label">NutriBot recipe</span><span className="dish-detail-attribution-fallback">Created by the NutriBot recipe catalog.</span></div>
              </>
            )}
          </section>
          {facts.length > 0 && <section className="dish-detail-nutrition">{facts.map(([label, value, unit]) => <div key={label}><b><span className="dish-detail-nutrition-value">{value}</span><small className="dish-detail-nutrition-unit">{unit}</small></b><span>{label}</span></div>)}</section>}
          {(dish.ingredients.length > 0 || dish.steps.length > 0) && <section className="detail-content-grid dish-detail-recipe-grid">
            {dish.ingredients.length > 0 && <article className="detail-ingredients"><div className="detail-section-head"><span>What you need</span><h2>Ingredients</h2>{dish.servings != null && <small>Serves {dish.servings}</small>}</div><ul>{dish.ingredients.map((item, index) => <li key={item.ingredientId ?? index}><i>{String(index + 1).padStart(2, '0')}</i>{[item.quantity, item.unit, item.name ?? item.ingredientName].filter((value) => value !== null && value !== undefined && String(value).trim() !== '').join(' ')}</li>)}</ul></article>}
            {dish.steps.length > 0 && <article className="detail-method"><div className="detail-section-head"><span>Make it yours</span><h2>Method</h2>{(dish.prepTimeMinutes != null || dish.cookTimeMinutes != null) && <small>{dish.prepTimeMinutes != null ? `${dish.prepTimeMinutes} prep` : ''}{dish.prepTimeMinutes != null && dish.cookTimeMinutes != null ? ' / ' : ''}{dish.cookTimeMinutes != null ? `${dish.cookTimeMinutes} cook` : ''}</small>}</div><ol>{dish.steps.map((step, index) => <li key={index}><b>{index + 1}</b><p>{step.description ?? step.instruction ?? step}</p></li>)}</ol></article>}
          </section>}
          {!dish.ingredients.length && !dish.steps.length && <p className="dish-detail-empty">Recipe instructions are not available for this dish yet.</p>}
        </div>}
      </div>
    </section>
  </div>;
}
