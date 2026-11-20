import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkNutritionOverflow } from '../../utils/weeklyMenuModel';

const mocks = vi.hoisted(() => ({ getCurrentWeeklyMenu: vi.fn(), addWeeklyMenuItem: vi.fn() }));
vi.mock('../../services/weeklyMealApi', () => ({
  getCurrentWeeklyMenu: mocks.getCurrentWeeklyMenu,
  addWeeklyMenuItem: mocks.addWeeklyMenuItem,
  getWeeklyMenuDishes: vi.fn().mockResolvedValue([]),
  createWeeklyMenu: vi.fn(), deleteWeeklyMenuItem: vi.fn(),
  saveAiGeneratedMenu: vi.fn(), updateWeeklyMenu: vi.fn()
}));
vi.mock('../../services/profileApi', () => ({
  getMyProfile: vi.fn().mockResolvedValue({}),
  getHealthProfile: vi.fn().mockResolvedValue({}),
  getAllergyIngredients: vi.fn().mockResolvedValue([])
}));
vi.mock('../../layouts/MemberPageLayout', () => ({ default: ({ children }) => <div>{children}</div> }));
vi.mock('../../components/chatbot/ChatbotWidget', () => ({ default: () => null }));
vi.mock('../../components/community/DishDetailModal', () => ({ default: () => null }));
vi.mock('../../components/community/MealEditorDialog', () => ({
  default: ({ onSubmit }) => <>
    <button onClick={() => onSubmit({ isAddMode: true, dishes: [
      { dishId: 11, name: 'Dish A', calories: 400, protein: 10 },
      { dishId: 12, name: 'Dish B', calories: 400, protein: 10 }
    ] })}>Add selected dishes</button>
    <button onClick={() => onSubmit({ isAddMode: true, dishes: [
      { dishId: 11, name: 'Dish A', calories: 400, protein: 10 }
    ] })}>Add single dish</button>
  </>
}));
vi.mock('@gsap/react', () => ({ useGSAP: vi.fn() }));
vi.mock('gsap', () => ({ default: { registerPlugin: vi.fn() } }));
vi.mock('gsap/ScrollTrigger', () => ({ ScrollTrigger: {} }));

import WeeklyMealPlannerPage from '../WeeklyMealPlannerPage';

const openEditor = async (goal = 1000) => {
  mocks.getCurrentWeeklyMenu.mockResolvedValue({
    menuId: 42, targetCalories: goal,
    days: Array.from({ length: 7 }, (_, index) => ({
      dayOfWeek: index + 1, calorieGoal: goal,
      meals: [{ itemId: index + 1, dishId: 1, dishName: 'Existing dish', mealType: 'DINNER', calories: 300, servings: 1 }]
    }))
  });
  render(<WeeklyMealPlannerPage />);
  const buttons = await screen.findAllByRole('button', { name: /Add dish/i });
  fireEvent.click(buttons[0]);
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  window.matchMedia = () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() });
});

describe('Nutrition warning when adding dishes', () => {
  it('warns about combined nutrition and saves all dishes only after confirmation', async () => {
    await openEditor();
    fireEvent.click(screen.getByText('Add selected dishes'));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('These dishes go over your daily target.')).toBeInTheDocument();
    expect(within(dialog).getByText('1100')).toBeInTheDocument();
    expect(mocks.addWeeklyMenuItem).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Keep anyway' }));
    await waitFor(() => expect(mocks.addWeeklyMenuItem).toHaveBeenCalledTimes(2));
    expect(mocks.addWeeklyMenuItem.mock.calls.map(([, payload]) => payload.dishId)).toEqual([11, 12]);
  });

  it('does not save any dish when the warning is cancelled', async () => {
    await openEditor();
    fireEvent.click(screen.getByText('Add selected dishes'));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(mocks.addWeeklyMenuItem).not.toHaveBeenCalled();
  });

  it('saves multiple dishes without warning when their total equals the target', async () => {
    await openEditor(1100);
    fireEvent.click(screen.getByText('Add selected dishes'));
    await waitFor(() => expect(mocks.addWeeklyMenuItem).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('counts a single added dish once when checking the target', async () => {
    await openEditor();
    fireEvent.click(screen.getByText('Add single dish'));
    await waitFor(() => expect(mocks.addWeeklyMenuItem).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('checks combined macros, servings, and removal of a replaced meal', () => {
    const menu = { days: [{ calorieGoal: 2000, proteinGoal: 30, carbsGoal: 50, fatsGoal: 20,
      meals: [{ key: 'old', calories: 1000, proteinG: 50 }] }] };
    const meals = [
      { calories: 100, proteinG: 10, carbsG: 20, healthyFatsG: 8, servings: 2 },
      { calories: 100, proteinG: 15, carbsG: 15, healthyFatsG: 6 }
    ];
    expect(checkNutritionOverflow(menu, 0, meals, 'old').details).toEqual({
      protein: { actual: 35, goal: 30, excess: 5 },
      carbs: { actual: 55, goal: 50, excess: 5 },
      fats: { actual: 22, goal: 20, excess: 2 }
    });
  });
});
