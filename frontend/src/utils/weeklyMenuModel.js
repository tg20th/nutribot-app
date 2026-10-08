import colorfulPlate from '../assets/colorful-plate.jpg';
import freshProduce from '../assets/fresh-produce.jpg';
import heroBowl from '../assets/hero-bowl.jpg';

export const MEAL_SLOTS = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];

export const mealSlotApiValue = (slot) => String(slot).toLowerCase() === 'snacks' ? 'snack' : String(slot).toLowerCase();

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const IMAGE_POOL = [heroBowl, colorfulPlate, freshProduce];

const parseDate = (value) => {
  const date = value ? new Date(`${String(value).slice(0, 10)}T12:00:00`) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

export const toIsoDate = (value) => {
  const date = value instanceof Date ? value : parseDate(value);
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
};

export const startOfWeek = (value = new Date()) => {
  const date = value instanceof Date ? new Date(value) : parseDate(value);
  const mondayOffset = date.getDay() === 0 ? -6 : 1 - date.getDay();
  date.setDate(date.getDate() + mondayOffset);
  date.setHours(12, 0, 0, 0);
  return date;
};

export const shiftWeek = (weekStart, amount) => {
  const next = parseDate(weekStart);
  next.setDate(next.getDate() + (amount * 7));
  return toIsoDate(next);
};

const slotTitle = (value = '') => {
  const normalized = String(value).toLowerCase();
  if (normalized === 'snack' || normalized === 'snacks') return 'Snacks';
  return MEAL_SLOTS.find((slot) => slot.toLowerCase() === normalized) ?? 'Breakfast';
};

const formatDayDate = (date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const createDays = (weekStart, calorieGoal = null) => {
  const start = parseDate(weekStart);
  const today = toIsoDate(new Date());
  const goal = calorieGoal != null && Number.isFinite(Number(calorieGoal)) ? Number(calorieGoal) : null;
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const isoDate = toIsoDate(date);
    return {
      dayOfWeek: index + 1,
      label: DAY_NAMES[date.getDay()],
      date: formatDayDate(date),
      isoDate,
      status: isoDate === today ? 'Today' : '',
      calorieGoal: goal,
      proteinGoal: null,
      calorieActual: 0,
      proteinActual: 0,
      meals: []
    };
  });
};

const normalizeDish = (dish, index = 0) => ({
  dishId: dish.dishId ?? dish.id ?? null,
  name: dish.dishName ?? dish.name ?? 'Untitled dish',
  calories: Number(dish.calories ?? dish.kcal ?? 0),
  protein: Number(dish.protein ?? dish.proteinG ?? dish.protein_g ?? 0),
  carbsG: Number(dish.carbsG ?? dish.carbs ?? dish.carbs_g ?? 0),
  healthyFatsG: Number(dish.healthyFatsG ?? dish.fatG ?? dish.fat ?? dish.healthy_fats_g ?? 0),
  image: dish.image ?? dish.imageUrl ?? dish.image_url ?? IMAGE_POOL[index % IMAGE_POOL.length]
});

export const normalizeDishCatalog = (dishes = []) => {
  return dishes.map(normalizeDish).filter((dish) => dish.dishId != null);
};

const normalizeMeal = (item, meal, index) => {
  const dish = normalizeDish({ ...item, ...item.dish }, index);
  const servings = Number(item.servings ?? 1) || 1;
  const carbsG = Number(item.carbsG ?? item.carbs ?? item.carbs_g ?? 0);
  const healthyFatsG = Number(item.healthyFatsG ?? item.fatG ?? item.fats ?? item.healthy_fats_g ?? 0);
  return {
    key: String(item.itemId ?? item.id ?? `local-${Date.now()}-${index}`),
    itemId: item.itemId ?? item.id ?? null,
    mealId: meal.mealId ?? meal.id ?? item.mealId ?? null,
    dishId: dish.dishId,
    slot: slotTitle(meal.mealType ?? meal.slot ?? item.mealType ?? item.slot),
    name: dish.name,
    kcal: Math.round(dish.calories * servings),
    protein: Math.round(dish.protein * servings),
    baseCalories: dish.calories,
    baseProtein: dish.protein,
    carbsG,
    healthyFatsG,
    image: dish.image,
    servings,
    notes: item.notes ?? '',
    swapped: Boolean(item.swapped)
  };
};

const mealTotals = (meal) => {
  const servings = Number(meal.servings ?? 1) || 1;
  const calories = Number(meal.baseCalories ?? meal.calories ?? meal.kcal ?? 0);
  const protein = Number(meal.baseProtein ?? meal.proteinG ?? meal.protein ?? 0);
  const carbs = Number(meal.carbsG ?? 0);
  const fats = Number(meal.healthyFatsG ?? 0);
  return {
    calories: Number.isFinite(calories) ? Math.round(calories * servings) : 0,
    protein: Number.isFinite(protein) ? Math.round(protein * servings) : 0,
    carbs: Number.isFinite(carbs) ? Math.round(carbs * servings) : 0,
    fats: Number.isFinite(fats) ? Math.round(fats * servings) : 0
  };
};

const percentageOf = (actual, target) =>
  Number.isFinite(actual) && Number.isFinite(target) && target > 0
    ? Math.round((actual * 1000) / target) / 10
    : null;

// Actuals are always recomputed from the meals currently shown on screen so
// the assistant never goes stale while the user edits an unsaved plan. Target
// values and the PROFILE_INCOMPLETE status still come from the backend.
const mergeNutritionSummary = (backendSummary, localSummary) => {
  const target = backendSummary?.target ?? null;
  const incomplete = backendSummary?.status === 'PROFILE_INCOMPLETE';
  const status = incomplete ? 'PROFILE_INCOMPLETE' : localSummary.status;
  const missingFields = incomplete ? (backendSummary?.missingFields ?? []) : localSummary.missingFields;
  const percentage = target
    ? {
        calories: percentageOf(localSummary.actual.calories, target.calories),
        proteinG: percentageOf(localSummary.actual.proteinG, target.proteinG),
        carbsG: percentageOf(localSummary.actual.carbsG, target.carbsG),
        healthyFatsG: percentageOf(localSummary.actual.healthyFatsG, target.healthyFatsG)
      }
    : null;
  return { status, missingFields, actual: localSummary.actual, target, percentage };
};

export const recalculateMenu = (menu) => {
  let weeklyCalories = 0;
  let weeklyProtein = 0;
  let weeklyCarbs = 0;
  let weeklyFats = 0;
  const days = menu.days.map((day) => {
    const totals = (day.meals ?? []).reduce((sum, meal) => {
      const mealTotal = mealTotals(meal);
      return {
        calories: sum.calories + mealTotal.calories,
        protein: sum.protein + mealTotal.protein,
        carbs: sum.carbs + mealTotal.carbs,
        fats: sum.fats + mealTotal.fats
      };
    }, { calories: 0, protein: 0, carbs: 0, fats: 0 });
    weeklyCalories += totals.calories;
    weeklyProtein += totals.protein;
    weeklyCarbs += totals.carbs;
    weeklyFats += totals.fats;
    return {
      ...day,
      calorieActual: totals.calories,
      proteinActual: totals.protein,
      carbsActual: totals.carbs,
      fatsActual: totals.fats
    };
  });
  const backendSummary = menu.nutritionSummary && menu.nutritionSummary.status
    ? menu.nutritionSummary
    : null;
  const nutritionSummary = mergeNutritionSummary(backendSummary, computeNutritionSummary(days));
  const dailyTarget = (key) => nutritionSummary.target?.[key] != null
    ? Math.round(Number(nutritionSummary.target[key]) / 7)
    : null;
  const proteinGoal = dailyTarget('proteinG');
  const carbsGoal = dailyTarget('carbsG');
  const fatsGoal = dailyTarget('healthyFatsG');
  const hasAnyMeal = days.some((day) => (day.meals ?? []).length > 0);
  return {
    ...menu,
    days: days.map((day) => ({
      ...day,
      proteinGoal: proteinGoal ?? day.proteinGoal ?? null,
      carbsGoal: carbsGoal ?? day.carbsGoal ?? null,
      fatsGoal: fatsGoal ?? day.fatsGoal ?? null
    })),
    nutritionSummary,
    groceryList: { itemCount: days.reduce((sum, day) => sum + day.meals.length, 0) },
    week: {
      ...menu.week,
      avgCalories: hasAnyMeal ? Math.round(weeklyCalories / 7) : null,
      avgProtein: hasAnyMeal ? Math.round(weeklyProtein / 7) : null,
      avgCarbs: hasAnyMeal ? Math.round(weeklyCarbs / 7) : null,
      avgFats: hasAnyMeal ? Math.round(weeklyFats / 7) : null
    }
  };
};

// Build a nutrition summary from the local menu state. Used as a fallback
// when the backend response omits the canonical `nutritionSummary` block so
// the Meal Plan Assistant never shows "Unavailable" while meals are present.
export const computeNutritionSummary = (days = []) => {
  let totalCalories = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFats = 0;
  let hasProtein = false;
  let hasCarbs = false;
  let hasFats = false;

  days.forEach((day) => {
    (day.meals ?? []).forEach((meal) => {
      const servings = Number(meal.servings ?? 1) || 1;
      const calories = Number(meal.baseCalories ?? meal.calories ?? meal.kcal ?? 0);
      const protein = Number(meal.baseProtein ?? meal.proteinG ?? meal.protein ?? 0);
      const carbs = Number(meal.carbsG ?? meal.carbs ?? 0);
      const fats = Number(meal.healthyFatsG ?? meal.fats ?? meal.fatG ?? 0);
      if (Number.isFinite(calories)) totalCalories += Math.round(calories * servings);
      if (Number.isFinite(protein) && protein) { totalProtein += protein * servings; hasProtein = true; }
      if (Number.isFinite(carbs) && carbs) { totalCarbs += carbs * servings; hasCarbs = true; }
      if (Number.isFinite(fats) && fats) { totalFats += fats * servings; hasFats = true; }
    });
  });
  const round1 = (value) => Math.round(value * 10) / 10;
  const hasAnyMeal = days.some((day) => (day.meals ?? []).length > 0);
  const actual = {
    calories: hasAnyMeal ? totalCalories : null,
    proteinG: hasProtein ? round1(totalProtein) : null,
    carbsG: hasCarbs ? round1(totalCarbs) : null,
    healthyFatsG: hasFats ? round1(totalFats) : null
  };
  const missingFields = [];
  if (!hasProtein) missingFields.push('proteinG');
  if (!hasCarbs) missingFields.push('carbsG');
  if (!hasFats) missingFields.push('healthyFatsG');
  const status = !hasAnyMeal
    ? 'EMPTY_MENU'
    : missingFields.length === 0
      ? 'AVAILABLE'
      : 'PARTIAL';
  return {
    status,
    missingFields,
    actual,
    target: null,
    percentage: null
  };
};

const numberOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const nutritionValue = (source, keys) => {
  if (!source) return null;
  for (const key of keys) {
    const value = numberOrNull(source[key]);
    if (value !== null) return value;
  }
  return null;
};

// Accept the canonical summary field names agreed by NB-10/NB-42 without
// inventing a nutrition value when the backend has not supplied one.
const normalizeNutritionSummary = (raw) => {
  const summary = raw?.nutritionSummary;
  if (!summary) return null;
  const actual = summary.actual ?? {};
  const target = summary.target ?? {};
  const percentage = summary.percentage ?? {};
  return {
    status: summary.status ?? null,
    missingFields: Array.isArray(summary.missingFields) ? summary.missingFields : [],
    actual: {
      calories: nutritionValue(actual, ['calories']),
      proteinG: nutritionValue(actual, ['proteinG', 'protein_g']),
      carbsG: nutritionValue(actual, ['carbsG', 'carbs_g']),
      healthyFatsG: nutritionValue(actual, ['healthyFatsG', 'healthy_fats_g', 'fatG', 'fat_g'])
    },
    target: {
      calories: nutritionValue(target, ['calories']),
      proteinG: nutritionValue(target, ['proteinG', 'protein_g']),
      carbsG: nutritionValue(target, ['carbsG', 'carbs_g']),
      healthyFatsG: nutritionValue(target, ['healthyFatsG', 'healthy_fats_g', 'fatG', 'fat_g'])
    },
    percentage: {
      calories: nutritionValue(percentage, ['calories']),
      proteinG: nutritionValue(percentage, ['proteinG', 'protein', 'protein_g']),
      carbsG: nutritionValue(percentage, ['carbsG', 'carbs', 'carbs_g']),
      healthyFatsG: nutritionValue(percentage, ['healthyFatsG', 'healthyFats', 'fatG', 'fat', 'healthy_fats_g'])
    }
  };
};

export const normalizeWeeklyMenu = (raw = {}, requestedStart) => {
  const startDate = toIsoDate(raw.startDate ?? raw.week?.startDate ?? requestedStart ?? startOfWeek());
  const targetCalories = numberOrNull(raw.targetCalories ?? raw.week?.targetCalories);
  const days = createDays(startDate, targetCalories);

  if (Array.isArray(raw.days)) {
    raw.days.slice(0, 7).forEach((source, index) => {
      const target = days[index];
      if (!target) return;
      const goal = Number(source.calorieGoal ?? target.calorieGoal);
      target.calorieGoal = Number.isFinite(goal) ? goal : target.calorieGoal;
      target.proteinGoal = numberOrNull(source.proteinGoal) ?? target.proteinGoal;
      target.status = source.status ?? target.status;
      target.meals = (source.meals ?? []).map((meal, mealIndex) => normalizeMeal(meal, meal, mealIndex));
    });
  } else {
    (raw.meals ?? []).forEach((meal, mealIndex) => {
      const dayIndex = Math.max(0, Math.min(6, Number(meal.dayOfWeek ?? 1) - 1));
      const items = meal.items?.length ? meal.items : (meal.dishName || meal.dish ? [meal] : []);
      days[dayIndex].meals.push(...items.map((item, itemIndex) => normalizeMeal(item, meal, mealIndex + itemIndex)));
    });
  }

  const end = parseDate(startDate);
  end.setDate(end.getDate() + 6);
  const startLabel = parseDate(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endLabel = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return recalculateMenu({
    menuId: raw.menuId ?? raw.id ?? null,
    startDate,
    endDate: toIsoDate(raw.endDate ?? end),
    targetCalories,
    nutritionSummary: normalizeNutritionSummary(raw),
    days,
    groceryList: raw.groceryList ?? {},
    week: { ...(raw.week ?? {}), range: raw.week?.range ?? `${startLabel} - ${endLabel}` }
  });
};

export const createLocalMeal = (dish, slot, servings = 1, notes = '', swapped = false) => ({
  key: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  itemId: null,
  mealId: null,
  dishId: dish.dishId,
  slot,
  name: dish.name,
  kcal: Math.round(dish.calories * servings),
  protein: Math.round(dish.protein * servings),
  baseCalories: dish.calories,
  baseProtein: dish.protein,
  carbsG: Number.isFinite(Number(dish.carbsG)) ? Number(dish.carbsG) : 0,
  healthyFatsG: Number.isFinite(Number(dish.healthyFatsG)) ? Number(dish.healthyFatsG) : 0,
  image: dish.image,
  servings,
  notes,
  swapped
});

export const serializeMenu = (menu) => ({
  menuId: menu.menuId,
  startDate: menu.startDate,
  endDate: menu.endDate,
  targetCalories: menu.targetCalories,
  days: menu.days
});
