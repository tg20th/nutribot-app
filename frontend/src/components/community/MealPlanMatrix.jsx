import { Plus } from 'lucide-react';
import { MEAL_SLOTS } from '../../utils/weeklyMenuModel';
import ImageWithFallback from '../ImageWithFallback';

export default function MealPlanMatrix({ className = '', days: plannerDays = [], onSelectMeal }) {
  return <div className={`planner-matrix ${className}`.trim()}>
    <div className="matrix-labels">
      <div className="matrix-corner" aria-hidden="true"/>
      {MEAL_SLOTS.map((slot) => <div className="matrix-row-label" key={slot}>{slot}</div>)}
    </div>
    <div className="matrix-scroll">
      <div className="matrix-grid">
        {plannerDays.map((day) => <div className={`matrix-day-head${day.status === 'Today' ? ' is-today' : ''}`} key={day.isoDate}>
          <b>{day.label.slice(0, 3)}</b><span>{day.date}</span>
        </div>)}

        {MEAL_SLOTS.map((slot) => plannerDays.map((day) => {
          const meals = day.meals.filter((item) => item.slot === slot);
          const totalCalories = meals.reduce((sum, meal) => sum + meal.kcal, 0);
          return <button type="button" className={`matrix-cell${meals.length ? '' : ' is-empty'}`} key={`${day.isoDate}-${slot}`} onClick={() => onSelectMeal?.(day, slot)} title={`Add another ${slot.toLowerCase()} dish for ${day.label}`}>
            {meals.length ? <>
              <span className="matrix-cell-count">{meals.length} {meals.length === 1 ? 'dish' : 'dishes'}</span>
              <span className="matrix-meal-stack">
                {meals.slice(0, 3).map((meal) => <span key={meal.key}><ImageWithFallback className="matrix-meal-image" src={meal.image} alt=""/><b>{meal.name}</b></span>)}
              </span>
              <small>{totalCalories.toLocaleString()} kcal · Add another</small>
            </> : <span className="matrix-cell-empty"><Plus size={15}/> Add a dish</span>}
          </button>;
        }))}
      </div>
    </div>
  </div>;
}
