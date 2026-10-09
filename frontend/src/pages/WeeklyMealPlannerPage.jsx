import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Download, Info, LayoutGrid, List, Loader2, Plus, RefreshCw, Repeat2, Save, ShoppingBasket, Sparkles, Trash2, WifiOff, X } from 'lucide-react';
import MemberPageLayout from '../layouts/MemberPageLayout';
import MealEditorDialog from '../components/community/MealEditorDialog';
import DishDetailModal from '../components/community/DishDetailModal';
import MenuPreviewModal from '../components/menu/MenuPreviewModal';
import ImageWithFallback from '../components/ImageWithFallback';
import ChatbotWidget from '../components/chatbot/ChatbotWidget';
import freshProduce from '../assets/fresh-produce.jpg';
import { getHealthProfile, getMyProfile } from '../services/profileApi';
import { addWeeklyMenuItem, createWeeklyMenu, deleteWeeklyMenuItem, getCurrentWeeklyMenu, getWeeklyMenuDishes, saveAiGeneratedMenu, updateWeeklyMenu } from '../services/weeklyMealApi';
import { generateMealPlan } from '../services/mealPlannerApi';
import { createLocalMeal, MEAL_SLOTS, normalizeDishCatalog, normalizeWeeklyMenu, recalculateMenu, serializeMenu, shiftWeek, startOfWeek, toIsoDate, checkNutritionOverflow } from '../utils/weeklyMenuModel';
import NutritionOverflowDialog from '../components/dialog/NutritionOverflowDialog';
import ServiceUnavailableDialog from '../components/dialog/ServiceUnavailableDialog';
import PlanExistsDialog from '../components/dialog/PlanExistsDialog';
import { mealSlotApiValue } from '../utils/weeklyMenuModel';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
gsap.registerPlugin(ScrollTrigger);

const storageKey = (startDate) => `nutribot-weekly-menu-${startDate}`;

const selectedIndexForWeek = (weekStart) => {
  const start = new Date(`${weekStart}T12:00:00`);
  const today = new Date(`${toIsoDate(new Date())}T12:00:00`);
  const difference = Math.round((today.getTime() - start.getTime()) / 86400000);
  return difference >= 0 && difference < 7 ? difference : 0;
};

const formatNumber = (value) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue.toLocaleString() : '—';
};

const isProfileIncompleteError = (error) => {
  const payload = error?.payload?.data ?? error?.payload ?? {};
  const code = payload?.code ?? payload?.errorCode ?? error?.code;
  const fields = payload?.missingFields ?? payload?.missing_fields ?? [];
  return code === 'PROFILE_INCOMPLETE' || (error?.status === 422 && Array.isArray(fields));
};

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
  const [communityUser, setCommunityUser] = useState({});
  const [plannerProfile, setPlannerProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileLoadFailed, setProfileLoadFailed] = useState(false);
  const [showProfileReadinessModal, setShowProfileReadinessModal] = useState(false);
  const plannerRequest = useRef(0);
  const [weekStart, setWeekStart] = useState(() => toIsoDate(startOfWeek()));
  const [menu, setMenu] = useState(() => normalizeWeeklyMenu({}, toIsoDate(startOfWeek())));
  const [dishes, setDishes] = useState([]);
  const [dishError, setDishError] = useState(false);
  const [editor, setEditor] = useState(null);
  const [detailMeal, setDetailMeal] = useState(null);
  const [pendingMealRemoval, setPendingMealRemoval] = useState(null);
  const [showGrocery, setShowGrocery] = useState(false);
  const [showAiGenerator, setShowAiGenerator] = useState(false);
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [aiPreview, setAiPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [menuLoadFailed, setMenuLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingAiPreview, setSavingAiPreview] = useState(false);
  const [aiSaveError, setAiSaveError] = useState('');
  const aiSaveRequest = useRef(false);
  const [notice, setNotice] = useState(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState(() => selectedIndexForWeek(toIsoDate(startOfWeek())));
  const [viewMode, setViewMode] = useState('image');
  const [collapsedSlots, setCollapsedSlots] = useState({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showServiceUnavailableDialog, setShowServiceUnavailableDialog] = useState(false);
  const [serviceUnavailableDraftExists, setServiceUnavailableDraftExists] = useState(false);
  const [showPlanExistsDialog, setShowPlanExistsDialog] = useState(false);
  const [pendingNutritionOverflow, setPendingNutritionOverflow] = useState(null);
  const [pendingOverflowMeal, setPendingOverflowMeal] = useState(null);

  const loadWeek = useCallback(async (startDate, signal) => {
    setLoading(true);
    setMenuLoadFailed(false);
    setNotice(null);
    try {
      const weeklyMenu = await getCurrentWeeklyMenu(signal, startDate);
      setMenu(normalizeWeeklyMenu(weeklyMenu, startDate));
      setHasUnsavedChanges(false);
    } catch (error) {
      if (error?.name === 'AbortError') return;
      setMenuLoadFailed(true);
      const draft = readDraft(startDate);
      setMenu(normalizeWeeklyMenu(draft ?? {}, startDate));
      if (draft) {
        setServiceUnavailableDraftExists(true);
        setShowServiceUnavailableDialog(true);
      } else {
        setServiceUnavailableDraftExists(false);
        setShowServiceUnavailableDialog(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([getMyProfile(controller.signal), getHealthProfile(controller.signal)]).then(([profile, health]) => { setCommunityUser(profile); setPlannerProfile({ ...profile, ...health }); setProfileLoadFailed(false); }).catch(() => { if (!controller.signal.aborted) { setPlannerProfile(null); setProfileLoadFailed(true); } }).finally(() => { if (!controller.signal.aborted) setProfileLoading(false); });
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
    setSelectedDayIndex(selectedIndexForWeek(weekStart));
  }, [weekStart]);

  useEffect(() => {
    if (!loading && menu.startDate === weekStart) localStorage.setItem(storageKey(weekStart), JSON.stringify(serializeMenu(menu)));
  }, [loading, menu, weekStart]);

  useEffect(() => {
    if (!notice || notice.type === 'saving') return undefined;
    const timer = window.setTimeout(() => setNotice(null), 3600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!dishError) return undefined;
    const timer = window.setTimeout(() => setDishError(false), 3600);
    return () => window.clearTimeout(timer);
  }, [dishError]);

  useGSAP(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    return gsap.fromTo('.planner-daily-workspace > *', { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: .28, stagger: .035, ease: 'power2.out', clearProps: 'all' });
  }, { scope: page, dependencies: [selectedDayIndex, viewMode, loading] });

  useGSAP(() => {
    if (!aiPreview || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    return gsap.fromTo('.ai-preview-dialog', { autoAlpha: 0, y: 18, scale: .97 }, { autoAlpha: 1, y: 0, scale: 1, duration: .38, ease: 'power3.out' });
  }, { scope: page, dependencies: [aiPreview] });

  const plannerDays = menu.days ?? [];
  const missingProfileFields = useMemo(() => {
    if (!plannerProfile) return ['health profile'];
    return [['height_cm', plannerProfile.heightCm ?? plannerProfile.height_cm], ['weight_kg', plannerProfile.weightKg ?? plannerProfile.weight_kg], ['date_of_birth', plannerProfile.dateOfBirth ?? plannerProfile.date_of_birth], ['gender', plannerProfile.gender], ['health_goal', plannerProfile.healthGoal ?? plannerProfile.health_goal], ['vegetarian_type', plannerProfile.vegetarianType ?? plannerProfile.vegetarian_type]].filter(([, value]) => value == null || value === '').map(([name]) => name);
  }, [plannerProfile]);
  const plannerReady = !profileLoading && !missingProfileFields.length;
  const selectedDay = plannerDays[selectedDayIndex] ?? plannerDays[0] ?? null;
  const hasMeals = plannerDays.some((day) => day.meals.length > 0);
  const dailyNutritionMetrics = useMemo(() => {
    if (!selectedDay) return [];
    return [
      { label: 'Calories', actual: selectedDay.calorieActual, target: selectedDay.calorieGoal, unit: 'kcal' },
      { label: 'Protein', actual: selectedDay.proteinActual, target: selectedDay.proteinGoal, unit: 'g' },
      { label: 'Carbs', actual: selectedDay.carbsActual, target: selectedDay.carbsGoal, unit: 'g' },
      { label: 'Fat', actual: selectedDay.fatsActual, target: selectedDay.fatsGoal, unit: 'g' }
    ].map((metric) => {
      const actual = Number(metric.actual) || 0;
      const target = Number(metric.target);
      const hasTarget = Number.isFinite(target) && target > 0;
      return { ...metric, actual, target: hasTarget ? target : null, progress: hasTarget ? Math.min(100, (actual / target) * 100) : 0 };
    });
  }, [selectedDay]);
  const hasAllNutritionTargets = dailyNutritionMetrics.length === 4 && dailyNutritionMetrics.every((metric) => metric.target != null);
  const backendMarksProfileIncomplete = menu.nutritionSummary?.status === 'PROFILE_INCOMPLETE';
  const requiresHealthProfile = !loading && !profileLoading && !menuLoadFailed && !profileLoadFailed && (backendMarksProfileIncomplete || !plannerReady || !hasAllNutritionTargets);
  const nutritionDataUnavailable = !loading && !profileLoading && !requiresHealthProfile && (!hasAllNutritionTargets || menuLoadFailed || profileLoadFailed);
  const nutritionLoading = loading || profileLoading;
  const selectedDayFullLabel = selectedDay ? new Date(`${selectedDay.isoDate}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : '';
  const heroMeal = plannerDays.flatMap((day) => day.meals).find(Boolean);
  const groceryItems = useMemo(() => plannerDays.flatMap((day) => day.meals.map((meal) => ({ ...meal, day: day.label }))), [plannerDays]);

  const openEditor = (day, slot, meal = null) => {
    // meal = null → ADD mode (no existing dish to replace)
    // meal = some dish → REPLACE mode (replace that specific dish)
    setEditor({ day, dayIndex: plannerDays.findIndex((item) => item.isoDate === day.isoDate), slot, meal });
  };

  const ensureMenu = async () => {
    if (menu.menuId) return menu.menuId;
    const created = await createWeeklyMenu(menuPayload(menu));
    const id = created.menuId ?? created.id;
    if (!id) throw new Error('The menu service did not return a menu ID.');
    setMenu((current) => ({ ...current, menuId: id }));
    return id;
  };

  const persistAddMeal = async (newMeal, dayIndex, slot, dayLabel) => {
    setHasUnsavedChanges(true);
    setNotice({ type: 'saving', text: 'Saving your meal...' });
    try {
      const menuId = await ensureMenu();
      await addWeeklyMenuItem(menuId, {
        dayOfWeek: dayIndex + 1,
        mealType: mealSlotApiValue(slot),
        dishId: newMeal.dishId,
        servings: newMeal.servings,
        notes: newMeal.notes
      });
      await loadWeek(weekStart);
      setNotice({ type: 'success', text: `Added ${newMeal.name} in ${dayLabel}.` });
    } catch {
      setNotice({ type: 'offline', text: 'The backend could not save this change. It is stored in your local draft.' });
    }
  };

  const submitMeal = async ({ dish, servings, notes, isAddMode }) => {
    const dayIndex = editor.dayIndex;
    const slot = editor.slot;

    // Create new local meal entry
    const newMeal = createLocalMeal(dish, slot, servings, notes, false);

    // Old meal key for REPLACE mode (to subtract old meal's nutrition)
    const oldMealKey = isAddMode ? null : editor.meal?.key;

    // Build meals array after this change (for overflow check)
    const dayMealsAfter = isAddMode
      ? [...(menu.days[dayIndex]?.meals ?? []), newMeal]
      : [...(menu.days[dayIndex]?.meals ?? []).filter((m) => m.key !== oldMealKey), newMeal];

    // Check nutrition overflow
    const tempMenu = { ...menu, days: menu.days.map((day, idx) => idx === dayIndex ? { ...day, meals: dayMealsAfter } : day) };
    const overflow = checkNutritionOverflow(tempMenu, dayIndex, newMeal, oldMealKey);
    if (overflow) {
      // Close editor, store overflow state for dialog
      setEditor(null);
      setPendingOverflowMeal({ newMeal, isAddMode, oldMealKey, editor: { day: editor.day, dayIndex, slot: editor.slot } });
      setPendingNutritionOverflow(overflow);
      return;
    }

    setEditor(null);

    // ADD mode: append via addWeeklyMenuItem API
    if (isAddMode) {
      await persistAddMeal(newMeal, dayIndex, slot, editor.day.label);
      return;
    }

    // REPLACE mode: update via updateWeeklyMenu (sends full menu)
    setHasUnsavedChanges(true);
    setNotice({ type: 'saving', text: 'Saving your meal...' });

    try {
      const menuId = await ensureMenu();
      const nextMenu = recalculateMenu({
        ...menu,
        days: menu.days.map((day, index) => index !== dayIndex ? day : {
          ...day,
          meals: day.meals.map((meal) => meal.key === editor.meal.key ? newMeal : meal)
        })
      });
      const savedMenu = await updateWeeklyMenu(menuId, {
        ...menuPayload(nextMenu),
        meals: nextMenu.days.flatMap((day) => day.meals.map((item) => ({
          dayOfWeek: day.dayOfWeek,
          mealType: mealSlotApiValue(item.slot),
          dishId: item.dishId,
          servings: item.servings,
          notes: item.notes
        })))
      });
      setMenu(normalizeWeeklyMenu(savedMenu, weekStart));
      setHasUnsavedChanges(false);
      setNotice({ type: 'success', text: `Replaced ${dish.name} in ${editor.day.label}.` });
    } catch {
      setNotice({ type: 'offline', text: 'The backend could not save this change. It is stored in your local draft.' });
    }
  };

  const removeMeal = async (dayIndex, meal) => {
    setMenu((current) => recalculateMenu({ ...current, days: current.days.map((day, index) => index === dayIndex ? { ...day, meals: day.meals.filter((item) => item.key !== meal.key) } : day) }));
    setHasUnsavedChanges(true);
    if (!menu.menuId || !meal.itemId) {
      setNotice({ type: 'success', text: `${meal.name} was removed from your local draft.` });
      return;
    }
    try {
      await deleteWeeklyMenuItem(menu.menuId, meal.itemId);
      await loadWeek(weekStart);
      setNotice({ type: 'success', text: `${meal.name} was removed.` });
    } catch {
      setNotice({ type: 'offline', text: 'The backend could not delete this meal. The local draft was updated.' });
    }
  };

  const confirmMealRemoval = async () => {
    if (!pendingMealRemoval) return;
    const { dayIndex, meal } = pendingMealRemoval;
    setPendingMealRemoval(null);
    await removeMeal(dayIndex, meal);
  };

  const confirmOverflowKeep = async () => {
    if (!pendingOverflowMeal || !pendingNutritionOverflow) return;
    const { newMeal, isAddMode, oldMealKey, editor: storedEditor } = pendingOverflowMeal;
    const dayIndex = storedEditor.dayIndex;
    setPendingOverflowMeal(null);
    setPendingNutritionOverflow(null);

    // ADD mode: keep the dish anyway and append it
    if (isAddMode) {
      await persistAddMeal(newMeal, dayIndex, storedEditor.slot, storedEditor.day.label);
      return;
    }

    // REPLACE mode: proceed with the replacement
    setNotice({ type: 'saving', text: 'Saving your meal...' });
    setMenu((current) => recalculateMenu({
      ...current,
      days: current.days.map((day, index) => {
        if (index !== dayIndex) return day;
        return { ...day, meals: [...day.meals.filter((m) => m.key !== oldMealKey), newMeal] };
      })
    }));

    if (!menu.menuId) {
      setNotice({ type: 'success', text: `Replaced ${newMeal.name} in ${storedEditor.day.label}.` });
      return;
    }

    const menuId = menu.menuId;
    const nextMenu = recalculateMenu({
      ...menu,
      days: menu.days.map((day, index) => index !== dayIndex ? day : {
        ...day,
        meals: [...day.meals.filter((m) => m.key !== oldMealKey), newMeal]
      })
    });
    updateWeeklyMenu(menuId, {
      ...menuPayload(nextMenu),
      meals: nextMenu.days.flatMap((day) => day.meals.map((item) => ({
        dayOfWeek: day.dayOfWeek,
        mealType: item.slot.toLowerCase(),
        dishId: item.dishId,
        servings: item.servings,
        notes: item.notes
      })))
    }).then((savedMenu) => {
      setMenu(normalizeWeeklyMenu(savedMenu, weekStart));
      setNotice({ type: 'success', text: `Replaced ${newMeal.name} in ${storedEditor.day.label}.` });
    }).catch(() => {
      setNotice({ type: 'offline', text: 'Backend unavailable. Change saved locally.' });
    });
  };

  const savePlan = async () => {
    setSaving(true);
    try {
      const id = menu.menuId ?? await ensureMenu();
      const savedMenu = await updateWeeklyMenu(id, { ...menuPayload(menu), meals: plannerDays.flatMap((day) => day.meals.map((meal) => ({ dayOfWeek: day.dayOfWeek, mealType: mealSlotApiValue(meal.slot), dishId: meal.dishId, servings: meal.servings, notes: meal.notes }))) });
      setMenu(normalizeWeeklyMenu(savedMenu, weekStart));
      setHasUnsavedChanges(false);
      setNotice({ type: 'success', text: 'Your weekly plan is saved.' });
    } catch {
      localStorage.setItem(storageKey(weekStart), JSON.stringify(serializeMenu(menu)));
      setNotice({ type: 'offline', text: 'The backend is unavailable. Your changes remain an unsaved local draft.' });
    } finally {
      setSaving(false);
    }
  };

  const generateAiPlan = async (event) => {
    event.preventDefault();
    if (!plannerReady) {
      setShowAiGenerator(false);
      setShowProfileReadinessModal(true);
      return;
    }
    const requestId = ++plannerRequest.current;
    setGeneratingPlan(true);
    try {
      const result = await generateMealPlan({ vegetarianType: plannerProfile.vegetarianType ?? plannerProfile.vegetarian_type });
      if (!Array.isArray(result.weeklyPlan) || result.weeklyPlan.length !== 7) throw new Error('The planner did not return a valid seven-day meal plan.');
      if (requestId !== plannerRequest.current) return;
      setShowAiGenerator(false);
      setAiPreview(result);
    } catch (error) {
      if (requestId !== plannerRequest.current) return;
      if (isProfileIncompleteError(error)) {
        setShowAiGenerator(false);
        setShowProfileReadinessModal(true);
        return;
      }
      setNotice({ type: 'offline', text: error?.message || 'NutriBot could not generate a plan right now. Please try again.' });
    } finally {
      if (requestId === plannerRequest.current) setGeneratingPlan(false);
    }
  };

  const requestMealPlanGeneration = () => {
    if (profileLoading) return;
    if (!plannerReady) {
      setShowProfileReadinessModal(true);
      return;
    }
    if (hasUnsavedChanges && !window.confirm('You have unsaved changes. Generating a new plan can replace your draft when applied. Continue?')) return;
    if (menu.menuId) {
      setShowPlanExistsDialog(true);
      return;
    }
    setShowAiGenerator(true);
  };

  const replacePreviewMeal = (dayIndex, field, dish) => {
    setAiPreview((current) => current && ({ ...current, weeklyPlan: current.weeklyPlan.map((day, index) => index !== dayIndex ? day : ({ ...day, [field]: { dishId: dish.dishId, dishName: dish.name, calories: dish.calories, proteinG: dish.protein, carbsG: dish.carbsG, healthyFatsG: dish.healthyFatsG, imageUrl: dish.image, servings: day[field]?.servings ?? 1 } })) }));
    setAiSaveError('');
  };

  const persistAiPreview = async () => {
    if (!aiPreview || aiSaveRequest.current) return;
    aiSaveRequest.current = true;
    setSavingAiPreview(true);
    setAiSaveError('');
    try {
      const savedMenu = await saveAiGeneratedMenu({
        startDate: weekStart,
        dietaryGoal: plannerProfile?.healthGoal ?? plannerProfile?.health_goal ?? null,
        generatedMenu: aiPreview
      });
      setMenu(normalizeWeeklyMenu(savedMenu, weekStart));
      setAiPreview(null);
      setNotice({ type: 'success', text: 'Your AI weekly plan was saved to your account.' });
    } catch (error) {
      setAiSaveError(error?.message || 'We could not save your AI plan. Please sign in and try again.');
    } finally {
      aiSaveRequest.current = false;
      setSavingAiPreview(false);
    }
  };

  const applyAiPreview = () => {
    if (!aiPreview) return;
    const aiSlots = [['Breakfast', 'breakfast'], ['Lunch', 'lunch'], ['Dinner', 'dinner']];
    const aiDailyCalories = Number(aiPreview.estimatedDailyCalories);
    const hasAiCalories = Number.isFinite(aiDailyCalories) && aiDailyCalories > 0;
    setMenu((current) => recalculateMenu({
        ...current,
        targetCalories: hasAiCalories ? aiDailyCalories : current.targetCalories,
        days: current.days.map((day, dayIndex) => {
          const generatedDay = aiPreview.weeklyPlan[dayIndex] ?? {};
          return {
            ...day,
            calorieGoal: hasAiCalories ? aiDailyCalories : day.calorieGoal,
            meals: aiSlots.map(([slot, field], slotIndex) => {
              const selection = generatedDay[field] ?? {};
              const servings = Number(selection.servings ?? 1);
              const baseCalories = Number(selection.calories);
              const baseProtein = Number(selection.proteinG);
              const carbsG = selection.carbsG != null && Number.isFinite(Number(selection.carbsG)) ? Number(selection.carbsG) : null;
              const healthyFatsG = selection.healthyFatsG != null && Number.isFinite(Number(selection.healthyFatsG)) ? Number(selection.healthyFatsG) : null;
              return {
                key: `ai-${Date.now()}-${dayIndex}-${slotIndex}`,
                itemId: null, mealId: null, dishId: selection.dishId ?? null, slot,
                name: selection.dishName || `${slot} suggestion`,
                kcal: Number.isFinite(baseCalories) ? Math.round(baseCalories * servings) : null, protein: Number.isFinite(baseProtein) ? Math.round(baseProtein * servings) : null,
                baseCalories, baseProtein, carbsG, healthyFatsG,
                image: selection.imageUrl || freshProduce, servings, notes: 'Suggested by NutriBot AI', swapped: false,
              };
            })
          };
        })
      }));
    setAiPreview(null);
    setHasUnsavedChanges(true);
    setNotice({ type: 'success', text: aiPreview.suggestedMenuTitle ? `AI plan applied: ${aiPreview.suggestedMenuTitle}` : 'Your AI weekly plan is ready to review.' });
  };

  return <><MemberPageLayout className="planner-page">
      <div className="planner-workspace" ref={page}>
        <main className="planner-main">
          <header className="planner-header">
            <div><h1>Weekly Meal Planner</h1><p>Plan your meals, stay consistent with your goals.</p></div>
            <div className="planner-week-nav" aria-label="Change week">
              <span>{menu.week.range}</span>
              <button type="button" aria-label="Previous week" onClick={() => setWeekStart((current) => shiftWeek(current, -1))}><ChevronLeft size={18}/></button>
              <button type="button" aria-label="Next week" onClick={() => setWeekStart((current) => shiftWeek(current, 1))}><ChevronRight size={18}/></button>
            </div>
          </header>

          {notice && <div className={`planner-toast is-${notice.type}`} role={notice.type === 'offline' ? 'alert' : 'status'}>
            {notice.type === 'offline' ? <WifiOff size={15}/> : notice.type === 'saving' ? <Loader2 size={15} className="is-spinning"/> : <CheckCircle2 size={15}/>}
            <span>{notice.text}</span><button type="button" onClick={() => setNotice(null)} aria-label="Dismiss message"><X size={14}/></button>
          </div>}
          {dishError && <div className="planner-toast is-offline" role="alert"><WifiOff size={15}/><span>The dish catalog is unavailable, so a dish cannot be added yet.</span><button type="button" onClick={() => setDishError(false)} aria-label="Dismiss message"><X size={14}/></button></div>}

          {false && <><div className="planner-content-heading">
            <div><span>Your menu</span><h2>Meals with room to move.</h2></div>
            <p>{['Add,', 'swap,', 'and shape this week your way.'].map((word) => <span className="planner-scrub-word" key={word}>{word} </span>)}</p>
          </div>

          {loading ? <div className="planner-loading"><Loader2 className="is-spinning"/><span>Loading your week...</span></div> : <div className="planner-days">
            {plannerDays.map((day, dayIndex) => <article className={`planner-day${day.status === 'Today' ? ' is-today' : ''}`} key={day.isoDate}>
              <header>
                <div className="planner-day-label"><b>{day.label}</b><span>{day.date}</span>{day.status === 'Today' && <em className="planner-badge">Today</em>}</div>
                <div className="planner-day-meta">{formatNumber(day.calorieActual)} / {formatNumber(day.calorieGoal)} kcal · {day.proteinActual}g / {day.proteinGoal != null ? `${day.proteinGoal}g` : '—'} protein · {day.carbsActual ?? 0}g / {day.carbsGoal != null ? `${day.carbsGoal}g` : '—'} carbs · {day.fatsActual ?? 0}g / {day.fatsGoal != null ? `${day.fatsGoal}g` : '—'} fat</div>
              </header>
              <div className="planner-meals">
                {MEAL_SLOTS.map((slot) => {
                  const slotMeals = day.meals.filter((item) => item.slot === slot);
                  return <section className="planner-meal-slot" key={slot}>
                    <div className="planner-slot-heading"><span>{slot}</span><small>{slotMeals.length} {slotMeals.length === 1 ? 'dish' : 'dishes'}</small></div>
                    <div className="planner-slot-list">
                      {slotMeals.map((meal) => <div className="planner-meal" key={meal.key}>
                        <button type="button" className="planner-meal-detail" onClick={() => setDetailMeal(meal)} aria-label={`View details for ${meal.name}`}>
                        <ImageWithFallback src={meal.image} alt="" fallbackSrc={freshProduce}/>
                        <div><span>{meal.swapped ? 'Replaced' : 'Dish'}</span><b>{meal.name}</b><small>{meal.kcal} kcal · {meal.protein}g protein · {Math.round((Number(meal.carbsG) || 0) * meal.servings)}g carbs · {Math.round((Number(meal.healthyFatsG) || 0) * meal.servings)}g fat · {meal.servings} serving{meal.servings === 1 ? '' : 's'}</small></div>
                        </button>
                        <div className="planner-meal-actions">
                          <button type="button" onClick={() => openEditor(day, slot, meal)} aria-label={`Replace ${meal.name}`}><Repeat2 size={13}/></button>
                          <button type="button" onClick={() => setPendingMealRemoval({ dayIndex, meal })} aria-label={`Delete ${meal.name}`}><Trash2 size={13}/></button>
                        </div>
                      </div>)}
                    </div>
                    <button type="button" className="planner-add-meal" onClick={() => openEditor(day, slot)}><span><Plus size={15}/></span><b>{slotMeals.length ? 'Add another dish' : `Add ${slot.toLowerCase()}`}</b><small>{slotMeals.length ? `Build out ${day.label}'s ${slot.toLowerCase()}` : `Choose a dish for ${day.label}`}</small></button>
                  </section>;
                })}
              </div>
            </article>)}
          </div>}

          <footer className="planner-footer">
            <div><span>Ready when you are</span><b>Make this week yours.</b></div>
            <div>
              <button type="button" className="planner-btn-ghost" onClick={exportPlan}><Download size={15}/> Export CSV</button>
              <button type="button" className="planner-btn-primary" onClick={savePlan} disabled={saving}>{saving ? <Loader2 size={15} className="is-spinning"/> : null}{saving ? 'Saving...' : 'Save plan'}</button>
            </div>
          </footer></>}

          {loading ? <div className="planner-loading"><Loader2 className="is-spinning"/><span>Loading your weekly plan…</span></div> : !hasMeals ? <section className="planner-empty-state" aria-labelledby="empty-plan-title">
            <div className="planner-empty-icon"><Sparkles size={24}/></div>
            <p>YOUR MEAL PLAN</p><h2 id="empty-plan-title">Start a balanced week.</h2>
            <span>Create a personalized plan with AI or add your first dish manually.</span>
            <div><button type="button" className="planner-btn-primary" onClick={requestMealPlanGeneration} disabled={profileLoading}><Sparkles size={16}/> Generate with AI</button><button type="button" className="planner-btn-ghost" onClick={() => openEditor(plannerDays[0], MEAL_SLOTS[0])} disabled={!plannerDays.length}><Plus size={16}/> Add a dish manually</button></div>
          </section> : <>
            <section className="planner-toolbar" aria-label="Select a day and view mode">
              <div className="planner-day-tabs" role="tablist" aria-label="Days of the week">
                {plannerDays.map((day, index) => <button type="button" role="tab" aria-selected={index === selectedDayIndex} className={index === selectedDayIndex ? 'is-active' : ''} key={day.isoDate} onClick={() => setSelectedDayIndex(index)}><b>{day.label.slice(0, 3)}</b><span>{new Date(`${day.isoDate}T12:00:00`).getDate()}</span></button>)}
              </div>
              <div className="planner-view-toggle" aria-label="View mode">
                <button type="button" className={viewMode === 'image' ? 'is-active' : ''} onClick={() => setViewMode('image')} aria-pressed={viewMode === 'image'}><LayoutGrid size={15}/> Image</button>
                <button type="button" className={viewMode === 'list' ? 'is-active' : ''} onClick={() => setViewMode('list')} aria-pressed={viewMode === 'list'}><List size={15}/> List</button>
              </div>
            </section>
            {selectedDay && <section className="planner-daily-workspace" key={`${selectedDay.isoDate}-${viewMode}`} aria-label={`${selectedDay.label} meal plan`}>
              <div className="planner-day-title"><div><h2>{selectedDayFullLabel}</h2></div><div className="planner-day-utilities"><div className="planner-view-toggle" aria-label="View mode"><button type="button" className={viewMode === 'image' ? 'is-active' : ''} onClick={() => setViewMode('image')} aria-pressed={viewMode === 'image'}><LayoutGrid size={15}/> Image</button><button type="button" className={viewMode === 'list' ? 'is-active' : ''} onClick={() => setViewMode('list')} aria-pressed={viewMode === 'list'}><List size={15}/> List</button></div></div></div>
              {nutritionLoading ? <section className="planner-nutrition-unavailable" role="status"><Loader2 size={17} className="is-spinning"/><span>Loading nutrition targets…</span></section> : requiresHealthProfile ? <section className="planner-profile-callout" aria-label="Health Profile needed"><Info size={18}/><div><b>Personalize your nutrition tracking</b><span>Complete your Health Profile to unlock personalized nutrition targets and track your progress.</span></div><a href="/profile/health">Complete Profile <span aria-hidden="true">→</span></a></section> : nutritionDataUnavailable ? <section className="planner-nutrition-unavailable" role="status"><Info size={17}/><span>Nutrition targets are temporarily unavailable. Please try again shortly.</span></section> : <section className="planner-nutrition-summary" aria-label="Daily nutrition summary"><div className="planner-nutrition-heading"><div><b>Daily Nutrition</b><span>Personalized targets</span></div></div>{dailyNutritionMetrics.map((metric) => <div className="planner-nutrition-metric" key={metric.label}><div><span>{metric.label}</span><b>{formatNumber(metric.actual)} <small>/ {formatNumber(metric.target)} {metric.unit}</small></b></div><span className="planner-nutrition-progress" aria-label={`${metric.label}: ${metric.actual} ${metric.unit}`}><i style={{ width: `${metric.progress}%` }}/></span></div>)}</section>}
              <div className="planner-meal-sections">
                {MEAL_SLOTS.map((slot) => {
                  const slotMeals = selectedDay.meals.filter((item) => item.slot === slot);
                  const slotCalories = slotMeals.reduce((total, meal) => total + (Number(meal.kcal) || 0), 0);
                  const collapseKey = `${selectedDay.isoDate}-${slot}`;
                  const isCollapsed = Boolean(collapsedSlots[collapseKey]);
                  return <section className={`planner-meal-section is-${viewMode}`} key={slot}>
                    <header><button type="button" className="planner-meal-section-toggle" onClick={() => setCollapsedSlots((current) => ({ ...current, [collapseKey]: !current[collapseKey] }))} aria-expanded={!isCollapsed}><ChevronDown size={17}/><span>{slot}</span></button><div className="planner-meal-section-actions"><p>{slotMeals.length} {slotMeals.length === 1 ? 'dish' : 'dishes'} <i/> {formatNumber(slotCalories)} kcal</p></div></header>
                    {!isCollapsed && <div className={`planner-dish-grid is-${viewMode}`}>
                      {slotMeals.map((meal) => <article className="planner-dish-card" key={meal.key}>
                        {viewMode === 'image' && <button type="button" className="planner-dish-image" onClick={() => setDetailMeal(meal)} aria-label={`View ${meal.name} details`}><ImageWithFallback src={meal.image} alt="" fallbackSrc={freshProduce}/></button>}
                        <div className="planner-dish-body">
                          <button type="button" className="planner-dish-content" onClick={() => setDetailMeal(meal)} aria-label={`View ${meal.name} details`}><b>{meal.name}</b><span>{meal.kcal} kcal</span><small>P {meal.protein}g <i/> C {Math.round((Number(meal.carbsG) || 0) * meal.servings)}g <i/> F {Math.round((Number(meal.healthyFatsG) || 0) * meal.servings)}g</small></button>
                          <div className="planner-dish-actions"><button type="button" onClick={() => openEditor(selectedDay, slot, meal)} aria-label={`Replace ${meal.name}`}><Repeat2 size={14}/></button><button type="button" onClick={() => setPendingMealRemoval({ dayIndex: selectedDayIndex, meal })} aria-label={`Delete ${meal.name}`}><Trash2 size={14}/></button></div>
                        </div>
                      </article>)}
                      <button type="button" className="planner-add-meal" onClick={() => openEditor(selectedDay, slot)}><Plus size={19}/><b>Add dish</b><small>{slot}</small></button>
                    </div>}
                  </section>;
                })}
              </div>
            </section>}
            <footer className="planner-actions-footer"><button type="button" className="planner-btn-ghost" onClick={requestMealPlanGeneration}><RefreshCw size={15}/> Regenerate</button><button type="button" className="planner-btn-primary" onClick={savePlan} disabled={saving}>{saving && <Loader2 size={15} className="is-spinning"/>}<Save size={15}/>{saving ? 'Saving…' : 'Save Plan'}</button></footer>
          </>}
        </main>
      </div>
  </MemberPageLayout>

    {editor && <MealEditorDialog editor={editor} dishes={dishes} onClose={() => setEditor(null)} onSubmit={submitMeal}/>}
    {detailMeal && <DishDetailModal meal={detailMeal} onClose={() => setDetailMeal(null)}/>}
    {showGrocery && <div className="meal-dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setShowGrocery(false)}>
      <section className="meal-dialog grocery-dialog" role="dialog" aria-modal="true" aria-labelledby="meal-list-title">
        <header><div><span>{menu.week.range}</span><h2 id="meal-list-title">Meals this week</h2></div><button type="button" className="meal-dialog-close" onClick={() => setShowGrocery(false)} aria-label="Close meal list"><X size={18}/></button></header>
        <div className="grocery-list">{groceryItems.map((item) => <div key={`${item.day}-${item.key}`}><ImageWithFallback src={item.image} alt="" fallbackSrc={freshProduce}/><span><b>{item.name}</b><small>{item.day} · {item.slot} · {item.servings} serving{item.servings === 1 ? '' : 's'}</small></span></div>)}{!groceryItems.length && <p>No meals have been added yet.</p>}</div>
        <footer><button type="button" className="planner-btn-primary" onClick={() => setShowGrocery(false)}>Done</button></footer>
      </section>
    </div>}
    {pendingMealRemoval && <div className="meal-dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setPendingMealRemoval(null)}>
      <section className="meal-dialog meal-delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="meal-delete-title" aria-describedby="meal-delete-description">
        <header><div><span>Confirm removal</span><h2 id="meal-delete-title">Remove this meal?</h2></div><button type="button" className="meal-dialog-close" onClick={() => setPendingMealRemoval(null)} aria-label="Cancel removal"><X size={18}/></button></header>
        <p id="meal-delete-description">Remove <strong>{pendingMealRemoval.meal.name}</strong> from this weekly plan?</p>
        <footer><button type="button" className="planner-btn-ghost" onClick={() => setPendingMealRemoval(null)}>Cancel</button><button type="button" className="planner-btn-primary meal-delete-confirm" onClick={confirmMealRemoval}><Trash2 size={15}/> Remove meal</button></footer>
      </section>
    </div>}
    {showProfileReadinessModal && <div className="meal-dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setShowProfileReadinessModal(false)}>
      <section className="meal-dialog profile-readiness-dialog" role="dialog" aria-modal="true" aria-labelledby="profile-readiness-title" aria-describedby="profile-readiness-description">
        <header><h2 id="profile-readiness-title">Complete your health profile</h2><button type="button" className="meal-dialog-close" onClick={() => setShowProfileReadinessModal(false)} aria-label="Close profile reminder"><X size={18}/></button></header>
        <div className="profile-readiness-content">
          <p id="profile-readiness-description">We need a few more details before NutriBot can create your personalized weekly meal plan.</p>
          {missingProfileFields.length > 0 && (
            <div className="profile-readiness-fields">
              <span>Missing information</span>
              <ul>{missingProfileFields.map((field) => <li key={field}>{field.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</li>)}</ul>
            </div>
          )}
        </div>
        <footer><button type="button" className="profile-readiness-secondary" onClick={() => setShowProfileReadinessModal(false)}>Not now</button><button type="button" className="profile-readiness-primary" onClick={() => { window.location.href = '/profile/health'; }}>Complete Profile</button></footer>
      </section>
    </div>}
    {showAiGenerator && <div className="meal-dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !generatingPlan && setShowAiGenerator(false)}>
      <section className="meal-dialog ai-generator-dialog" role="dialog" aria-modal="true" aria-labelledby="ai-generator-title">
        <header><div><span>NutriBot AI</span><h2 id="ai-generator-title">Create this week's meals.</h2></div><button type="button" className="meal-dialog-close" onClick={() => setShowAiGenerator(false)} disabled={generatingPlan} aria-label="Close AI generator"><X size={18}/></button></header>
        <form className="ai-generator-form" onSubmit={generateAiPlan}>
          <p className="ai-generator-note">Calories, protein, carbs, fat targets and allergies come from your Health Profile — no need to enter them.</p>
          <p>NutriBot will replace the visible week with a seven-day preview. You can still swap or edit every meal after it is generated.</p>
          <footer><button type="button" className="planner-btn-ghost" onClick={() => setShowAiGenerator(false)} disabled={generatingPlan}>Cancel</button><button type="submit" className="planner-btn-primary" disabled={generatingPlan}>{generatingPlan ? <><Loader2 size={15} className="is-spinning"/> Generating...</> : <><Sparkles size={15}/> Generate plan</>}</button></footer>
        </form>
      </section>
    </div>}
    {aiPreview && (
      <MenuPreviewModal preview={aiPreview} dishes={dishes} isSaving={savingAiPreview} saveError={aiSaveError} onClose={() => setAiPreview(null)} onSave={persistAiPreview} onUse={applyAiPreview} onReplace={replacePreviewMeal}/>
    )}
    {showServiceUnavailableDialog && (
      <ServiceUnavailableDialog
        draftExists={serviceUnavailableDraftExists}
        onRetry={() => { setShowServiceUnavailableDialog(false); loadWeek(weekStart); }}
        onUseDraft={() => setShowServiceUnavailableDialog(false)}
        onClose={() => setShowServiceUnavailableDialog(false)}
      />
    )}
    {showPlanExistsDialog && (
      <PlanExistsDialog
        onConfirm={() => { setShowPlanExistsDialog(false); setShowAiGenerator(true); }}
        onCancel={() => setShowPlanExistsDialog(false)}
      />
    )}
    {pendingNutritionOverflow && (
      <NutritionOverflowDialog
        overflow={pendingNutritionOverflow}
        isAddMode={pendingOverflowMeal?.isAddMode ?? true}
        onKeep={confirmOverflowKeep}
        onCancel={() => { setPendingOverflowMeal(null); setPendingNutritionOverflow(null); setNotice(null); }}
      />
    )}
    <ChatbotWidget/>
  </>;
}
