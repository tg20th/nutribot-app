import colorfulPlate from '../assets/colorful-plate.jpg';
import freshProduce from '../assets/fresh-produce.jpg';
import heroBowl from '../assets/hero-bowl.jpg';

export const MEAL_SLOTS = ['Breakfast', 'Lunch', 'Dinner'];

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
  return MEAL_SLOTS.find((slot) => slot.toLowerCase() === normalized) ?? 'Breakfast';
};

const formatDayDate = (date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const createDays = (weekStart, calorieGoal = 1800, proteinGoal = 90) => {
  const start = parseDate(weekStart);
  const today = toIsoDate(new Date());
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
      calorieGoal,
      proteinGoal,
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
  image: dish.image ?? dish.imageUrl ?? dish.image_url ?? IMAGE_POOL[index % IMAGE_POOL.length]
});

export const normalizeDishCatalog = (dishes = []) => {
  return dishes.map(normalizeDish).filter((dish) => dish.dishId != null);
};

const normalizeMeal = (item, meal, index) => {
  const dish = normalizeDish({ ...item, ...item.dish }, index);
  const servings = Number(item.servings ?? 1) || 1;
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
    image: dish.image,
    servings,
    notes: item.notes ?? '',
    swapped: Boolean(item.swapped)
  };
};

export const recalculateMenu = (menu) => {
  const days = menu.days.map((day) => ({
    ...day,
    calorieActual: day.meals.reduce((sum, meal) => sum + Number(meal.kcal || 0), 0),
    proteinActual: day.meals.reduce((sum, meal) => sum + Number(meal.protein || 0), 0)
  }));
  const calorieTotal = days.reduce((sum, day) => sum + day.calorieActual, 0);
  const proteinTotal = days.reduce((sum, day) => sum + day.proteinActual, 0);
  return {
    ...menu,
    days,
    groceryList: { itemCount: days.reduce((sum, day) => sum + day.meals.length, 0) },
    week: {
      ...menu.week,
      avgCalories: Math.round(calorieTotal / 7),
      avgProtein: Math.round(proteinTotal / 7)
    }
  };
};

export const normalizeWeeklyMenu = (raw = {}, requestedStart) => {
  const startDate = toIsoDate(raw.startDate ?? raw.week?.startDate ?? requestedStart ?? startOfWeek());
  const targetCalories = Number(raw.targetCalories ?? raw.week?.targetCalories ?? 1800);
  const proteinGoal = Number(raw.targetProtein ?? raw.week?.targetProtein ?? 90);
  const days = createDays(startDate, targetCalories, proteinGoal);

  if (Array.isArray(raw.days)) {
    raw.days.slice(0, 7).forEach((source, index) => {
      const target = days[index];
      if (!target) return;
      target.calorieGoal = Number(source.calorieGoal ?? target.calorieGoal);
      target.proteinGoal = Number(source.proteinGoal ?? target.proteinGoal);
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
