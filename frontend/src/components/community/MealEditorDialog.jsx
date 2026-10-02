import { useEffect, useMemo, useState } from 'react';
import { Check, Search, X } from 'lucide-react';
import ImageWithFallback from '../ImageWithFallback';

export default function MealEditorDialog({ editor, dishes, onClose, onSubmit }) {
  const [query, setQuery] = useState('');
  // For ADD mode: use existing meal's dishId if editing, otherwise first dish
  // For REPLACE mode: use existing meal's dishId
  const [selectedId, setSelectedId] = useState(() => {
    if (editor?.meal?.dishId) return editor.meal.dishId;
    if (dishes.length > 0) return dishes[0].dishId;
    return null;
  });
  const [servings, setServings] = useState(editor?.meal?.servings ?? 1);
  const [notes, setNotes] = useState(editor?.meal?.notes ?? '');

  // Ensure a valid dish is always selected
  useEffect(() => {
    if (selectedId == null && dishes.length > 0) {
      setSelectedId(dishes[0].dishId);
    }
  }, [dishes, selectedId]);

  useEffect(() => {
    const onKeyDown = (event) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const filteredDishes = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return normalized ? dishes.filter((dish) => dish.name.toLowerCase().includes(normalized)) : dishes;
  }, [dishes, query]);

  const selectedDish = dishes.find((dish) => String(dish.dishId) === String(selectedId));
  const isAddMode = !editor?.meal;

  return <div className="meal-dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="meal-dialog" role="dialog" aria-modal="true" aria-labelledby="meal-dialog-title">
      <header>
        <div>
          <span>{editor.day.label} · {editor.slot}</span>
          <h2 id="meal-dialog-title">{isAddMode ? 'Add a dish' : 'Replace dish'}</h2>
        </div>
        <button type="button" className="meal-dialog-close" onClick={onClose} aria-label="Close meal editor"><X size={18}/></button>
      </header>

      <label className="meal-dialog-search">
        <Search size={15}/>
        <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search dishes"/>
      </label>

      <div className="meal-dialog-list" role="listbox" aria-label="Available dishes">
        {filteredDishes.map((dish) => {
          const selected = String(dish.dishId) === String(selectedId);
          return <button type="button" key={dish.dishId} className={selected ? 'is-selected' : ''} onClick={() => setSelectedId(dish.dishId)} role="option" aria-selected={selected}>
            <ImageWithFallback src={dish.image} alt="" />
            <span><b>{dish.name}</b><small>{dish.calories} kcal · {dish.protein}g protein</small></span>
            {selected && <Check size={16}/>}
          </button>;
        })}
        {!filteredDishes.length && <p className="meal-dialog-empty">{dishes.length ? 'No dishes match your search.' : 'No dishes are available from the database yet. The dish catalog API must be connected before a meal can be added.'}</p>}
      </div>

      <div className="meal-dialog-fields">
        <label>Servings<input type="number" min="0.5" max="10" step="0.5" value={servings} onChange={(event) => setServings(Number(event.target.value))}/></label>
        <label>Note<input value={notes} maxLength={120} onChange={(event) => setNotes(event.target.value)} placeholder="Optional preparation note"/></label>
      </div>

      <footer>
        <button type="button" className="planner-btn-ghost" onClick={onClose}>Cancel</button>
        <button type="button" className="planner-btn-primary" disabled={!selectedDish || servings <= 0} onClick={() => onSubmit({ dish: selectedDish, servings, notes, isAddMode })}>
          {isAddMode ? 'Add dish' : 'Replace dish'}
        </button>
      </footer>
    </section>
  </div>;
}
