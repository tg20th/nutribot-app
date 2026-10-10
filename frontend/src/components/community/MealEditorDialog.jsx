import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Plus, Search, X } from 'lucide-react';
import ImageWithFallback from '../ImageWithFallback';
import { getDishCompatibility } from '../../utils/weeklyMenuModel';

const DishRow = memo(function DishRow({ dish, added, selected, result, onToggle }) {
  const statusClass = added ? 'is-added' : result?.status === 'unknown' ? 'is-unknown' : result?.status === 'incompatible' ? 'is-incompatible' : 'is-compatible';
  const statusMessage = added ? 'Already added' : result?.status === 'compatible' ? 'Suitable' : result?.status === 'unknown' ? 'Compatibility not verified' : result?.reason;
  return <button type="button" className={`meal-picker-dish-row ${selected ? 'is-selected ' : ''}${statusClass} ${added ? 'is-disabled' : ''}`} onClick={() => onToggle(dish)} disabled={added} role="option" aria-selected={selected} title={statusMessage}>
    <ImageWithFallback src={dish.image} alt={dish.name} loading="lazy" decoding="async"/>
    <span><b>{dish.name}</b><small>{dish.calories} kcal · P {dish.protein}g</small>{statusMessage && <em>{statusMessage}</em>}</span>
    {!added && <span className="meal-picker-choice-indicator" aria-hidden="true">{selected ? <Check size={16} strokeWidth={2.4}/> : <Plus size={17} strokeWidth={2}/>}</span>}
  </button>;
});

const DISH_BATCH_SIZE = 10;
const DISH_ROW_HEIGHT = 72;
const VIRTUAL_OVERSCAN = 4;

export default function MealEditorDialog({ editor, dishes, vegetarianType, allergyIngredientIds = [], onClose, onSubmit }) {
  const isAddMode = !editor?.meal;
  const [query, setQuery] = useState('');
  const [filterMode, setFilterMode] = useState('suitable');
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [riskAcknowledged, setRiskAcknowledged] = useState(false);
  const [selectionOpen, setSelectionOpen] = useState(false);
  const [displayedCount, setDisplayedCount] = useState(DISH_BATCH_SIZE);
  const [virtualStart, setVirtualStart] = useState(0);
  const browseListRef = useRef(null);
  const loadMoreSentinelRef = useRef(null);
  const loadMoreScheduledRef = useRef(false);

  const existingIds = useMemo(
    () => new Set((editor?.day?.meals ?? []).filter((meal) => meal.slot === editor?.slot && meal.key !== editor?.meal?.key).map((meal) => String(meal.dishId))),
    [editor],
  );
  const compatibility = useMemo(
    () => new Map(dishes.map((dish) => [String(dish.dishId), getDishCompatibility(dish, vegetarianType, allergyIngredientIds)])),
    [dishes, vegetarianType, allergyIngredientIds],
  );
  const available = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return dishes.filter((dish) => {
      const matchesSearch = dish.name.toLowerCase().includes(normalizedQuery);
      const isSuitable = compatibility.get(String(dish.dishId))?.status === 'compatible';
      return matchesSearch && (filterMode === 'all' || isSuitable);
    });
  }, [dishes, query, filterMode, compatibility]);
  const selectedDishes = dishes.filter((dish) => selectedIds.has(String(dish.dishId)));
  const totalCalories = selectedDishes.reduce((total, dish) => total + (Number(dish.calories) || 0), 0);
  const allergyRiskDishes = selectedDishes.filter((dish) => compatibility.get(String(dish.dishId))?.reason?.toLowerCase().includes('allerg'));
  const hasAllergyRisk = allergyRiskDishes.length > 0;
  const viewportRowCount = Math.ceil((browseListRef.current?.clientHeight || 420) / DISH_ROW_HEIGHT);
  const safeVirtualStart = Math.min(virtualStart, Math.max(0, displayedCount - 1));
  const virtualEnd = Math.min(displayedCount, safeVirtualStart + viewportRowCount + VIRTUAL_OVERSCAN * 2);
  const visibleDishes = available.slice(safeVirtualStart, virtualEnd);
  const hasMoreDishes = displayedCount < available.length;
  const virtualTop = safeVirtualStart * DISH_ROW_HEIGHT;
  const virtualBottom = Math.max(0, (displayedCount - virtualEnd) * DISH_ROW_HEIGHT);
  const loadMoreDishes = useCallback(() => {
    if (loadMoreScheduledRef.current) return;
    loadMoreScheduledRef.current = true;
    setDisplayedCount((current) => Math.min(current + DISH_BATCH_SIZE, available.length));
  }, [available.length]);

  const handleBrowseScroll = useCallback((event) => {
    const nextStart = Math.max(0, Math.floor(event.currentTarget.scrollTop / DISH_ROW_HEIGHT) - VIRTUAL_OVERSCAN);
    setVirtualStart((current) => current === nextStart ? current : nextStart);
  }, []);

  const toggle = useCallback((dish) => {
    const id = String(dish.dishId);
    if (existingIds.has(id)) return;
    setRiskAcknowledged(false);
    setSelectedIds((current) => {
      if (!isAddMode) return new Set([id]);
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, [existingIds, isAddMode]);

  const removeSelected = (dishId) => {
    setRiskAcknowledged(false);
    setSelectedIds((current) => {
      const next = new Set(current);
      next.delete(String(dishId));
      return next;
    });
  };

  useEffect(() => {
    const escape = (event) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [onClose]);

  useEffect(() => {
    if (browseListRef.current) browseListRef.current.scrollTop = 0;
    setDisplayedCount(DISH_BATCH_SIZE);
    setVirtualStart(0);
    loadMoreScheduledRef.current = false;
  }, [query, filterMode]);

  useEffect(() => {
    loadMoreScheduledRef.current = false;
  }, [displayedCount]);

  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    const scrollRoot = browseListRef.current;
    if (!sentinel || !scrollRoot || !hasMoreDishes) return undefined;

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadMoreDishes();
    }, { root: scrollRoot, rootMargin: '0px 0px 160px 0px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [displayedCount, hasMoreDishes, loadMoreDishes]);

  const submit = () => {
    if (!selectedDishes.length || (hasAllergyRisk && !riskAcknowledged)) return;
    if (isAddMode) onSubmit({ dishes: selectedDishes, isAddMode: true });
    else onSubmit({ dish: selectedDishes[0], servings: 1, notes: '', isAddMode: false });
  };

  const selectedCountLabel = `${selectedDishes.length} ${selectedDishes.length === 1 ? 'dish' : 'dishes'}`;

  return <div className="meal-dialog-backdrop meal-picker-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className={`meal-dialog meal-picker-dialog meal-picker-workspace${isAddMode ? ' is-add' : ' is-replace'}`} role="dialog" aria-modal="true" aria-labelledby="meal-dialog-title">
      <header className="meal-picker-header">
        <div>
          <span>{editor.day.label.toUpperCase()} / {editor.slot.toUpperCase()}</span>
          <h2 id="meal-dialog-title">{isAddMode ? `Build your ${editor.slot.toLowerCase()}` : `Replace your ${editor.slot.toLowerCase()}`}</h2>
        </div>
        <button type="button" className="meal-dialog-close" onClick={onClose} aria-label="Close meal editor"><X size={17}/></button>
      </header>

      <div className="meal-picker-workspace-body">
        <section className="meal-picker-browse" aria-labelledby="browse-dishes-title">
          <div className="meal-picker-section-heading"><div><span>Browse dishes</span><h3 id="browse-dishes-title">Choose from your catalog</h3></div><small>{available.length} available</small></div>
          <label className="meal-dialog-search"><Search size={15}/><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search dishes..."/></label>
          <div className="meal-picker-filters" role="group" aria-label="Dish compatibility filter"><button type="button" className={filterMode === 'suitable' ? 'is-active' : ''} onClick={() => setFilterMode('suitable')}>Suitable only</button><button type="button" className={filterMode === 'all' ? 'is-active' : ''} onClick={() => setFilterMode('all')}>All dishes</button></div>
          <div ref={browseListRef} onScroll={handleBrowseScroll} className="meal-dialog-list meal-picker-browse-list" role="listbox" aria-label="Available dishes">
            {virtualTop > 0 && <div className="meal-picker-virtual-spacer" style={{ height: virtualTop }} />}
            {visibleDishes.map((dish) => <DishRow key={dish.dishId} dish={dish} added={existingIds.has(String(dish.dishId))} selected={selectedIds.has(String(dish.dishId))} result={compatibility.get(String(dish.dishId))} onToggle={toggle}/>) }
            {virtualBottom > 0 && <div className="meal-picker-virtual-spacer" style={{ height: virtualBottom }} />}
            {hasMoreDishes && <div ref={loadMoreSentinelRef} className="meal-picker-load-more-sentinel" aria-hidden="true"/>}
            {!available.length && <p className="meal-dialog-empty">No dishes match this filter or search.</p>}
          </div>
        </section>

        <aside className={`meal-picker-selection${selectionOpen ? ' is-open' : ''}`} aria-labelledby="selection-title">
          <div className="meal-picker-selection-heading"><div><span>Your selection</span><h3 id="selection-title">{selectedCountLabel}</h3></div>{!isAddMode && <small>Choose one replacement</small>}<button type="button" className="meal-picker-selection-toggle" onClick={() => setSelectionOpen((open) => !open)} aria-expanded={selectionOpen}>{selectionOpen ? 'Hide' : 'View selection'}</button></div>
          <div className="meal-picker-selected-list">
            {selectedDishes.length ? selectedDishes.map((dish) => <div className="meal-picker-selected-item" key={dish.dishId}><span><b>{dish.name}</b><small>{dish.calories} kcal</small></span><button type="button" onClick={() => removeSelected(dish.dishId)} aria-label={`Remove ${dish.name}`}><X size={14}/></button></div>) : <div className="meal-picker-selection-empty"><span>+</span><p>{isAddMode ? 'Select dishes from the catalog to build this meal.' : 'Select a dish to replace the current meal.'}</p></div>}
          </div>
          <div className="meal-picker-selection-footer">
            {hasAllergyRisk && <label className="meal-picker-risk-confirm"><input type="checkbox" checked={riskAcknowledged} onChange={(event) => setRiskAcknowledged(event.target.checked)}/><span>I understand that a selected dish may contain an ingredient I marked as an allergy.</span></label>}
            <div className="meal-picker-total"><span>Total calories</span><b>{totalCalories} kcal</b></div>
            <button type="button" className="planner-btn-primary meal-picker-submit" disabled={!selectedDishes.length || (hasAllergyRisk && !riskAcknowledged)} onClick={submit}>{isAddMode ? `Add ${selectedCountLabel}` : 'Replace dish'}</button>
          </div>
        </aside>
      </div>
    </section>
  </div>;
}
