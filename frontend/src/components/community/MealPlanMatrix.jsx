
const slots = ['Breakfast', 'Lunch', 'Dinner'];

export default function MealPlanMatrix({ className = '', days: plannerDays = [] }) {
  return <div className={`planner-matrix ${className}`.trim()}>
    <div className="matrix-labels">
      <div className="matrix-corner" aria-hidden="true"/>
      {slots.map((slot) => <div className="matrix-row-label" key={slot}>{slot}</div>)}
    </div>
    <div className="matrix-scroll">
      <div className="matrix-grid">
        {plannerDays.map((day) => <div className={`matrix-day-head${day.status === 'Today' ? ' is-today' : ''}`} key={day.label}>
          <b>{day.label}</b><span>{day.date.split(' ')[1]}</span>
        </div>)}

        {slots.map((slot) => plannerDays.map((day) => {
          const meal = day.meals.find((item) => item.slot === slot);
          return <button type="button" className="matrix-cell" key={`${day.label}-${slot}`} title={meal ? `${meal.name} · ${meal.protein}g protein` : undefined}>
            {meal ? <>
              <span className="matrix-cell-media">
                <img src={meal.image} alt={meal.name}/>
                {meal.swapped && <i className="matrix-swap-dot" aria-label="Swapped"/>}
              </span>
              <b>{meal.name}</b>
              <small>{meal.kcal} kcal</small>
            </> : <span className="matrix-cell-empty">-</span>}
          </button>;
        }))}
      </div>
    </div>
  </div>;
}
