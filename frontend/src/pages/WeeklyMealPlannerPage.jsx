import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CheckCircle2, ChevronLeft, ChevronRight, Download, Loader2, Plus, RefreshCw, Repeat2, ShoppingBasket, Sparkles, Trash2, WifiOff, X } from 'lucide-react';
import CommunityTopBar from '../components/community/CommunityTopBar';
import CommunitySideNav from '../components/community/CommunitySideNav';
import MealEditorDialog from '../components/community/MealEditorDialog';
import MealPlanAssistant from '../components/community/MealPlanAssistant';
import MealPlanMatrix from '../components/community/MealPlanMatrix';
import ChatbotWidget from '../components/chatbot/ChatbotWidget';
import freshProduce from '../assets/fresh-produce.jpg';
import { getMyProfile } from '../services/profileApi';
import { addWeeklyMenuItem, createWeeklyMenu, deleteWeeklyMenuItem, getCurrentWeeklyMenu, getWeeklyMenuDishes, updateWeeklyMenu } from '../services/weeklyMealApi';
import { createLocalMeal, MEAL_SLOTS, normalizeDishCatalog, normalizeWeeklyMenu, recalculateMenu, serializeMenu, shiftWeek, startOfWeek, toIsoDate } from '../utils/weeklyMenuModel';

gsap.registerPlugin(ScrollTrigger);

const storageKey = (startDate) => `nutribot-weekly-menu-${startDate}`;

const readDraft = (startDate) => {
  try {
    const draft = localStorage.getItem(storageKey(startDate));
    return draft ? JSON.parse(draft) : null;
  } catch {
    return null;
  }
};

const menuPayload = (menu) => ({
  title: `Meal plan · ${menu.week.range}`,
  startDate: menu.startDate,
  endDate: menu.endDate,
  targetCalories: menu.targetCalories,
  status: 'ACTIVE'
});

export default function WeeklyMealPlannerPage() {
  const page = useRef(null);
  const [query, setQuery] = useState('');
  const [view, setView] = useState('daily');
  const [communityUser, setCommunityUser] = useState({});
  const [weekStart, setWeekStart] = useState(() => toIsoDate(startOfWeek()));
  const [menu, setMenu] = useState(() => normalizeWeeklyMenu({}, toIsoDate(startOfWeek())));
  const [dishes, setDishes] = useState([]);
  const [dishError, setDishError] = useState(false);
  const [editor, setEditor] = useState(null);
  const [showGrocery, setShowGrocery] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);

  const loadWeek = useCallback(async (startDate, signal) => {
    setLoading(true);
    setNotice(null);
    try {
      const weeklyMenu = await getCurrentWeeklyMenu(signal, startDate);
      setMenu(normalizeWeeklyMenu(weeklyMenu, startDate));
    } catch (error) {
      if (error?.name === 'AbortError') return;
      const draft = readDraft(startDate);
      setMenu(normalizeWeeklyMenu(draft ?? {}, startDate));
      setNotice({ type: 'offline', text: draft ? 'The menu service is unavailable. Your local draft is open.' : 'The menu service is unavailable. New changes will stay on this device.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    getMyProfile(controller.signal).then(setCommunityUser).catch(() => {});
    getWeeklyMenuDishes(controller.signal).then((items) => {
      setDishes(normalizeDishCatalog(items));
      setDishError(false);
    }).catch(() => {
      setDishes([]);
      setDishError(true);
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadWeek(weekStart, controller.signal);
    return () => controller.abort();
  }, [loadWeek, weekStart]);

  useEffect(() => {
    if (!loading && menu.startDate === weekStart) localStorage.setItem(storageKey(weekStart), JSON.stringify(serializeMenu(menu)));
  }, [loading, menu, weekStart]);

  useGSAP(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const intro = gsap.timeline({ defaults: { ease: 'power3.out' } });
    intro.from('.planner-hero-copy > *', { y: 22, opacity: 0, duration: .65, stagger: .08 })
      .from('.planner-hero-image', { scale: .9, opacity: 0, duration: .8 }, '-=.45')
      .from('.planner-overview > *', { y: 14, opacity: 0, duration: .45, stagger: .07 }, '-=.3');
    gsap.to('.planner-scrub-word', { opacity: 1, stagger: .08, ease: 'none', scrollTrigger: { trigger: '.planner-content-heading', start: 'top 85%', end: 'bottom 52%', scrub: true } });
    gsap.utils.toArray('.planner-day').forEach((card) => gsap.fromTo(card, { scale: .97, opacity: .4 }, { scale: 1, opacity: 1, ease: 'power2.out', scrollTrigger: { trigger: card, start: 'top 92%', end: 'top 60%', scrub: true } }));
  }, { scope: page, dependencies: [weekStart, view] });

  const plannerDays = menu.days ?? [];
  const heroMeal = plannerDays.flatMap((day) => day.meals).find(Boolean);
  const groceryItems = useMemo(() => plannerDays.flatMap((day) => day.meals.map((meal) => ({ ...meal, day: day.label }))), [plannerDays]);

  const openEditor = (day, slot, meal = null) => setEditor({ day, dayIndex: plannerDays.findIndex((item) => item.isoDate === day.isoDate), slot, meal });

  const ensureMenu = async () => {
    if (menu.menuId) return menu.menuId;
    const created = await createWeeklyMenu(menuPayload(menu));
    const id = created.menuId ?? created.id;
    if (!id) throw new Error('The menu service did not return a menu ID.');
    setMenu((current) => ({ ...current, menuId: id }));
    return id;
  };

  const submitMeal = async ({ dish, servings, notes }) => {
    const replacement = createLocalMeal(dish, editor.slot, servings, notes, Boolean(editor.meal));
    const previousMeal = editor.meal;
    const dayIndex = editor.dayIndex;
    setMenu((current) => recalculateMenu({
      ...current,
      days: current.days.map((day, index) => {
        if (index !== dayIndex) return day;
        if (!previousMeal) return { ...day, meals: [...day.meals, replacement] };
        return { ...day, meals: day.meals.map((meal) => meal.key === previousMeal.key ? replacement : meal) };
      })
    }));
    setEditor(null);
    setNotice({ type: 'saving', text: 'Saving your meal...' });
    try {
      const menuId = await ensureMenu();
      const added = await addWeeklyMenuItem(menuId, { dayOfWeek: dayIndex + 1, mealType: editor.slot.toLowerCase(), dishId: dish.dishId, servings, notes });
      if (previousMeal?.itemId) await deleteWeeklyMenuItem(menuId, previousMeal.itemId);
      const itemId = added.itemId ?? added.id ?? null;
      setMenu((current) => ({ ...current, days: current.days.map((day, index) => index === dayIndex ? { ...day, meals: day.meals.map((meal) => meal.key === replacement.key ? { ...meal, itemId, key: String(itemId ?? meal.key) } : meal) } : day) }));
      setNotice({ type: 'success', text: `${dish.name} was added to ${editor.day.label}.` });
    } catch {
      setNotice({ type: 'offline', text: 'The backend could not save this change. It is stored in your local draft.' });
    }
  };

  const removeMeal = async (dayIndex, meal) => {
    if (!window.confirm(`Remove ${meal.name} from this plan?`)) return;
    setMenu((current) => recalculateMenu({ ...current, days: current.days.map((day, index) => index === dayIndex ? { ...day, meals: day.meals.filter((item) => item.key !== meal.key) } : day) }));
    if (!menu.menuId || !meal.itemId) {
      setNotice({ type: 'success', text: `${meal.name} was removed from your local draft.` });
      return;
    }
    try {
      await deleteWeeklyMenuItem(menu.menuId, meal.itemId);
      setNotice({ type: 'success', text: `${meal.name} was removed.` });
    } catch {
      setNotice({ type: 'offline', text: 'The backend could not delete this meal. The local draft was updated.' });
    }
  };

  const savePlan = async () => {
    setSaving(true);
    try {
      const id = menu.menuId ?? await ensureMenu();
      await updateWeeklyMenu(id, { ...menuPayload(menu), meals: plannerDays.flatMap((day) => day.meals.map((meal) => ({ dayOfWeek: day.dayOfWeek, mealType: meal.slot.toLowerCase(), dishId: meal.dishId, servings: meal.servings, notes: meal.notes }))) });
      setNotice({ type: 'success', text: 'Your weekly plan is saved.' });
    } catch {
      localStorage.setItem(storageKey(weekStart), JSON.stringify(serializeMenu(menu)));
      setNotice({ type: 'offline', text: 'The backend is unavailable. Your plan is saved locally on this device.' });
    } finally {
      setSaving(false);
    }
  };

  const exportPlan = () => {
    const rows = [['Day', 'Date', 'Meal', 'Dish', 'Calories', 'Protein (g)', 'Servings', 'Notes']];
    plannerDays.forEach((day) => day.meals.forEach((meal) => rows.push([day.label, day.isoDate, meal.slot, meal.name, meal.kcal, meal.protein, meal.servings, meal.notes])));
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `nutribot-meal-plan-${menu.startDate}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice({ type: 'success', text: 'Your meal plan was exported as a CSV file.' });
  };

  return <div className="community-page planner-page" ref={page}>
    <CommunityTopBar query={query} onQueryChange={setQuery}/>
    <div className="community-shell">
      <CommunitySideNav/>
      <span className="community-sidenav-spacer" aria-hidden="true"/>
      <div className="community-layout">
        <main className="community-feed planner-main">
          <header className="planner-hero">
            <div className="planner-hero-copy">
              <div className="planner-person">
                {communityUser.avatarUrl && <img src={communityUser.avatarUrl} alt=""/>}
                <span>Curated for {communityUser.fullName ?? communityUser.name ?? 'you'}</span>
              </div>
              <h1>Plan a week that feels <span className="planner-inline-image" aria-hidden="true"/> good to keep.</h1>
              <p>Build breakfast, lunch, and dinner around your goals, then adjust the plan whenever real life changes.</p>
              <div className="planner-top-actions">
                <button type="button" className="planner-btn-primary" onClick={() => loadWeek(weekStart)} disabled={loading}><RefreshCw size={15} className={loading ? 'is-spinning' : ''}/> Refresh this week</button>
                <button type="button" className="planner-btn-ghost" onClick={() => setShowGrocery(true)}><ShoppingBasket size={15}/> Meal list <span>{groceryItems.length}</span></button>
              </div>
            </div>
            <div className="planner-hero-image" aria-hidden="true">
              <img src={heroMeal?.image ?? freshProduce} alt=""/>
              <div><Sparkles size={15}/><span>Balanced, not rigid</span></div>
            </div>
          </header>

          <section className="planner-overview" aria-label="Week overview">
            <div className="planner-week-nav">
              <button type="button" aria-label="Previous week" onClick={() => setWeekStart((current) => shiftWeek(current, -1))}><ChevronLeft size={15}/></button>
              <div><span>Your week</span><b>{menu.week.range}</b></div>
              <button type="button" aria-label="Next week" onClick={() => setWeekStart((current) => shiftWeek(current, 1))}><ChevronRight size={15}/></button>
            </div>
            <div className="planner-week-avg">
              <span>Daily rhythm</span>
              <p><b>{(menu.week.avgCalories ?? 0).toLocaleString()}</b> kcal <i/> <b>{menu.week.avgProtein ?? 0}g</b> protein</p>
            </div>
            <div className="planner-view-toggle" aria-label="Planner view">
              <button type="button" className={view === 'daily' ? 'is-active' : ''} onClick={() => setView('daily')}>Daily</button>
              <button type="button" className={view === 'matrix' ? 'is-active' : ''} onClick={() => setView('matrix')}>Matrix</button>
            </div>
          </section>

          {notice && <div className={`planner-notice is-${notice.type}`} role="status">
            {notice.type === 'offline' ? <WifiOff size={15}/> : notice.type === 'saving' ? <Loader2 size={15} className="is-spinning"/> : <CheckCircle2 size={15}/>}
            <span>{notice.text}</span><button type="button" onClick={() => setNotice(null)} aria-label="Dismiss message"><X size={14}/></button>
          </div>}
          {dishError && <div className="planner-notice is-offline" role="status"><WifiOff size={15}/><span>The database dish catalog is not available. NB-41 no longer uses sample dishes; adding a meal will be enabled when the backend exposes the dish list endpoint.</span><button type="button" onClick={() => setDishError(false)} aria-label="Dismiss message"><X size={14}/></button></div>}

          <div className="planner-content-heading">
            <div><span>Your menu</span><h2>Meals with room to move.</h2></div>
            <p>{['Add,', 'swap,', 'and shape this week your way.'].map((word) => <span className="planner-scrub-word" key={word}>{word} </span>)}</p>
          </div>

          {loading ? <div className="planner-loading"><Loader2 className="is-spinning"/><span>Loading your week...</span></div> : view === 'daily' ? <div className="planner-days">
            {plannerDays.map((day, dayIndex) => <article className={`planner-day${day.status === 'Today' ? ' is-today' : ''}`} key={day.isoDate}>
              <header>
                <div className="planner-day-label"><b>{day.label}</b><span>{day.date}</span>{day.status === 'Today' && <em className="planner-badge">Today</em>}</div>
                <div className="planner-day-meta">{day.calorieActual.toLocaleString()} / {day.calorieGoal.toLocaleString()} kcal · {day.proteinActual} / {day.proteinGoal}g protein</div>
              </header>
              <div className="planner-meals">
                {MEAL_SLOTS.map((slot) => {
                  const slotMeals = day.meals.filter((item) => item.slot === slot);
                  return <section className="planner-meal-slot" key={slot}>
                    <div className="planner-slot-heading"><span>{slot}</span><small>{slotMeals.length} {slotMeals.length === 1 ? 'dish' : 'dishes'}</small></div>
                    <div className="planner-slot-list">
                      {slotMeals.map((meal) => <div className="planner-meal" key={meal.key}>
                        <img src={meal.image} alt=""/>
                        <div><span>{meal.swapped ? 'Replaced' : 'Dish'}</span><b>{meal.name}</b><small>{meal.kcal} kcal · {meal.protein}g protein · {meal.servings} serving{meal.servings === 1 ? '' : 's'}</small></div>
                        <div className="planner-meal-actions">
                          <button type="button" onClick={() => openEditor(day, slot, meal)} aria-label={`Replace ${meal.name}`}><Repeat2 size={13}/></button>
                          <button type="button" onClick={() => removeMeal(dayIndex, meal)} aria-label={`Delete ${meal.name}`}><Trash2 size={13}/></button>
                        </div>
                      </div>)}
                    </div>
                    <button type="button" className="planner-add-meal" onClick={() => openEditor(day, slot)}><span><Plus size={15}/></span><b>{slotMeals.length ? 'Add another dish' : `Add ${slot.toLowerCase()}`}</b><small>{slotMeals.length ? `Build out ${day.label}'s ${slot.toLowerCase()}` : `Choose a dish for ${day.label}`}</small></button>
                  </section>;
                })}
              </div>
            </article>)}
          </div> : <MealPlanMatrix days={plannerDays} onSelectMeal={openEditor}/>}

          <footer className="planner-footer">
            <div><span>Ready when you are</span><b>Make this week yours.</b></div>
            <div>
              <button type="button" className="planner-btn-ghost" onClick={exportPlan}><Download size={15}/> Export CSV</button>
              <button type="button" className="planner-btn-primary" onClick={savePlan} disabled={saving}>{saving ? <Loader2 size={15} className="is-spinning"/> : null}{saving ? 'Saving...' : 'Save plan'}</button>
            </div>
          </footer>
        </main>
        <MealPlanAssistant days={plannerDays} profile={communityUser}/>
      </div>
    </div>

    {editor && <MealEditorDialog editor={editor} dishes={dishes} onClose={() => setEditor(null)} onSubmit={submitMeal}/>}
    {showGrocery && <div className="meal-dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setShowGrocery(false)}>
      <section className="meal-dialog grocery-dialog" role="dialog" aria-modal="true" aria-labelledby="meal-list-title">
        <header><div><span>{menu.week.range}</span><h2 id="meal-list-title">Meals this week</h2></div><button type="button" className="meal-dialog-close" onClick={() => setShowGrocery(false)} aria-label="Close meal list"><X size={18}/></button></header>
        <div className="grocery-list">{groceryItems.map((item) => <div key={`${item.day}-${item.key}`}><img src={item.image} alt=""/><span><b>{item.name}</b><small>{item.day} · {item.slot} · {item.servings} serving{item.servings === 1 ? '' : 's'}</small></span></div>)}{!groceryItems.length && <p>No meals have been added yet.</p>}</div>
        <footer><button type="button" className="planner-btn-primary" onClick={() => setShowGrocery(false)}>Done</button></footer>
      </section>
    </div>}
    <ChatbotWidget/>
  </div>;
}
