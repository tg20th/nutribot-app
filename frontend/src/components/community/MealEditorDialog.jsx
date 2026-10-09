import { useEffect, useMemo, useState } from 'react';
import { Check, Search, X } from 'lucide-react';
import ImageWithFallback from '../ImageWithFallback';

export default function MealEditorDialog({ editor, dishes, onClose, onSubmit }) {
  const isAddMode = !editor?.meal;
  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const existingIds = useMemo(() => new Set((editor?.day?.meals ?? []).filter((meal) => meal.slot === editor?.slot).map((meal) => String(meal.dishId))), [editor]);
  const available = useMemo(() => dishes.filter((dish) => dish.name.toLowerCase().includes(query.trim().toLowerCase())), [dishes, query]);
  const selectedDishes = dishes.filter((dish) => selectedIds.has(String(dish.dishId)));
  const totalCalories = selectedDishes.reduce((total, dish) => total + (Number(dish.calories) || 0), 0);
  const toggle = (dish) => {
    if (existingIds.has(String(dish.dishId))) return;
    setSelectedIds((current) => {
      if (!isAddMode) return new Set([String(dish.dishId)]);
      const next = new Set(current); next.has(String(dish.dishId)) ? next.delete(String(dish.dishId)) : next.add(String(dish.dishId)); return next;
    });
  };
  useEffect(() => { const escape = (event) => event.key === 'Escape' && onClose(); window.addEventListener('keydown', escape); return () => window.removeEventListener('keydown', escape); }, [onClose]);
  const submit = () => { if (isAddMode) onSubmit({ dishes: selectedDishes, isAddMode: true }); else onSubmit({ dish: selectedDishes[0], servings: 1, notes: '', isAddMode: false }); };
  return <div className="meal-dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className={`meal-dialog meal-picker-dialog${isAddMode ? ' is-add' : ' is-replace'}`} role="dialog" aria-modal="true" aria-labelledby="meal-dialog-title"><header><div><span>{editor.day.label} · {editor.slot}</span><h2 id="meal-dialog-title">{isAddMode ? 'Add dishes' : 'Replace dish'}</h2><p>{isAddMode ? 'Select the dishes you want to add' : 'Choose one dish to replace the current meal'}</p></div><button type="button" className="meal-dialog-close" onClick={onClose} aria-label="Close meal editor"><X size={18}/></button></header><label className="meal-dialog-search"><Search size={15}/><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search dishes..."/></label><div className="meal-dialog-list" role="listbox">{available.map((dish) => { const id = String(dish.dishId); const added = existingIds.has(id); const selected = selectedIds.has(id); return <button type="button" key={id} className={`${selected ? 'is-selected' : ''}${added ? ' is-added' : ''}`} onClick={() => toggle(dish)} disabled={added} role="option" aria-selected={selected}><ImageWithFallback src={dish.image} alt=""/><span><b>{dish.name}</b><small>{dish.calories} kcal · P {dish.protein}g · C {dish.carbsG ?? 0}g · F {dish.healthyFatsG ?? 0}g</small></span>{added ? <em>Added</em> : selected ? <Check size={16}/> : <i/>}</button>; })}{!available.length && <p className="meal-dialog-empty">No dishes match your search.</p>}</div><footer>{isAddMode && <div className="meal-picker-summary"><b>{selectedDishes.length} dish{selectedDishes.length === 1 ? '' : 'es'} selected</b><span>{totalCalories} kcal total</span><button type="button" onClick={() => setSelectedIds(new Set())}>Clear selection</button></div>}<div><button type="button" className="planner-btn-ghost" onClick={onClose}>Cancel</button><button type="button" className="planner-btn-primary" disabled={!selectedDishes.length} onClick={submit}>{isAddMode ? `Add ${selectedDishes.length} dish${selectedDishes.length === 1 ? '' : 'es'}` : 'Replace dish'}</button></div></footer></section></div>;
}
