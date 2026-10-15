import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  generateMealPlan: vi.fn(),
  getCurrentWeeklyMenu: vi.fn(),
  getWeeklyMenuDishes: vi.fn(),
  saveAiGeneratedMenu: vi.fn(),
  getMyProfile: vi.fn(),
  getHealthProfile: vi.fn(),
  getAllergyIngredients: vi.fn(),
  getDishCompatibilityDetails: vi.fn()
}));

vi.mock('../../services/mealPlannerApi', () => ({ generateMealPlan: mocks.generateMealPlan }));
vi.mock('../../services/weeklyMealApi', () => ({
  addWeeklyMenuItem: vi.fn(), createWeeklyMenu: vi.fn(), deleteWeeklyMenuItem: vi.fn(),
  getCurrentWeeklyMenu: mocks.getCurrentWeeklyMenu, getWeeklyMenuDishes: mocks.getWeeklyMenuDishes,
  saveAiGeneratedMenu: mocks.saveAiGeneratedMenu, updateWeeklyMenu: vi.fn()
}));
vi.mock('../../services/profileApi', () => ({
  getMyProfile: mocks.getMyProfile, getHealthProfile: mocks.getHealthProfile,
  getAllergyIngredients: mocks.getAllergyIngredients
}));
vi.mock('../../services/dishService', () => ({ getDishCompatibilityDetails: mocks.getDishCompatibilityDetails }));
vi.mock('../../layouts/MemberPageLayout', () => ({ default: ({ children }) => <div>{children}</div> }));
vi.mock('../../components/chatbot/ChatbotWidget', () => ({ default: () => null }));
vi.mock('../../components/community/MealEditorDialog', () => ({ default: () => null }));
vi.mock('../../components/community/DishDetailModal', () => ({ default: () => null }));
vi.mock('@gsap/react', () => ({ useGSAP: vi.fn() }));
vi.mock('gsap', () => ({ default: { registerPlugin: vi.fn(), fromTo: vi.fn() } }));
vi.mock('gsap/ScrollTrigger', () => ({ ScrollTrigger: {} }));

import WeeklyMealPlannerPage from '../WeeklyMealPlannerPage';

const profile = {
  heightCm: 170,
  weightKg: 65,
  dateOfBirth: '1995-01-01',
  gender: 'OTHER',
  healthGoal: 'MAINTAIN',
  vegetarianType: 'VEGAN',
  allergyIngredientIds: []
};

const plan = (name = 'First preview', dishId = null, vegetarianType = undefined) => ({
  vegetarianType: 'VEGAN',
  weeklyPlan: Array.from({ length: 7 }, (_, index) => ({
    day: `Day ${index + 1}`,
    breakfast: { dishId, dishName: name, calories: 500, servings: 1, vegetarianType },
    lunch: { dishId, dishName: name, calories: 600, servings: 1, vegetarianType },
    dinner: { dishId, dishName: name, calories: 700, servings: 1, vegetarianType }
  }))
});

const renderPlanner = async (saved = false, withMeals = false) => {
  mocks.getCurrentWeeklyMenu.mockResolvedValue(saved ? {
    menuId: 42,
    days: withMeals ? [{
      dayOfWeek: 1,
      meals: [{
        itemId: 7,
        dishId: 7,
        dishName: 'Saved dish',
        mealType: 'BREAKFAST',
        servings: 1,
        calories: 400,
        proteinG: 20,
        carbsG: 45,
        healthyFatsG: 12
      }]
    }] : []
  } : {});
  mocks.getWeeklyMenuDishes.mockResolvedValue([]);
  mocks.getMyProfile.mockResolvedValue({});
  mocks.getHealthProfile.mockResolvedValue(profile);
  mocks.getAllergyIngredients.mockResolvedValue([]);
  mocks.getDishCompatibilityDetails.mockResolvedValue({});
  render(<WeeklyMealPlannerPage />);
  await waitFor(() => expect(screen.getByRole('button', { name: saved ? 'Re-generate' : 'Generate' })).toBeInTheDocument());
};

const confirmGenerate = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
  fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Create Meal Plan' }));
};

beforeEach(() => {
  vi.clearAllMocks();
  window.matchMedia = () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() });
});

describe('Weekly Planner AI generation flow', () => {
  it('saves an allergy plan whose dishes have no verifiable ingredients', async () => {
    mocks.getMyProfile.mockResolvedValueOnce({ heightCm: 170, weightKg: 65, healthGoal: 'MAINTAIN', vegetarianType: 'VEGAN' });
    mocks.getHealthProfile.mockResolvedValueOnce({ ...profile, allergyIngredientIds: [7] });
    mocks.getWeeklyMenuDishes.mockResolvedValueOnce([{ dishId: 61, name: 'Món chay', vegetarianType: 'VEGAN' }]);
    mocks.getDishCompatibilityDetails.mockResolvedValueOnce({ ingredientIds: null, ingredients: null });
    mocks.generateMealPlan.mockResolvedValueOnce(plan('Món chay', 61, 'VEGAN'));
    mocks.saveAiGeneratedMenu.mockResolvedValueOnce({ menuId: 1, days: [] });
    await renderPlanner(false);
    confirmGenerate();
    await screen.findByRole('heading', { name: 'Weekly meal plan preview' });

    fireEvent.click(screen.getByRole('button', { name: 'Save meal plan' }));

    await waitFor(() => expect(mocks.saveAiGeneratedMenu).toHaveBeenCalledTimes(1));
  });

  it('still blocks saving a dish that is incompatible with the diet', async () => {
    mocks.getWeeklyMenuDishes.mockResolvedValueOnce([{ dishId: 99, name: 'Món sữa', vegetarianType: 'LACTO' }]);
    mocks.generateMealPlan.mockResolvedValueOnce(plan('Món sữa', 99, 'LACTO'));
    await renderPlanner(false);
    confirmGenerate();
    await screen.findByRole('heading', { name: 'Weekly meal plan preview' });

    fireEvent.click(screen.getByRole('button', { name: 'Save meal plan' }));

    expect(mocks.saveAiGeneratedMenu).not.toHaveBeenCalled();
    expect(await screen.findByText(/not compatible with your VEGAN diet/i)).toBeInTheDocument();
  });

  it('requires confirmation before generating with no saved plan', async () => {
    mocks.generateMealPlan.mockResolvedValueOnce(plan());
    await renderPlanner(false);

    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
    expect(mocks.generateMealPlan).toHaveBeenCalledTimes(0);
    expect(screen.getByRole('heading', { name: 'Create an AI Meal Plan?' })).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Create Meal Plan' }));
    expect(await screen.findByRole('heading', { name: 'Weekly meal plan preview' })).toBeInTheDocument();
  });

  it('keeps Generate for an empty persisted weekly menu', async () => {
    mocks.generateMealPlan.mockResolvedValueOnce(plan());
    await renderPlanner(true);

    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
    expect(mocks.generateMealPlan).toHaveBeenCalledTimes(0);
    expect(screen.getByRole('heading', { name: 'Create an AI Meal Plan?' })).toBeInTheDocument();
  });

  it('returns the outside action to Generate when an unsaved preview is dismissed', async () => {
    mocks.generateMealPlan.mockResolvedValueOnce(plan());
    await renderPlanner(false);

    confirmGenerate();
    await screen.findByRole('heading', { name: 'Weekly meal plan preview' });
    fireEvent.click(screen.getByRole('button', { name: 'Close meal preview' }));

    expect(screen.getByRole('button', { name: 'Generate' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Re-generate' })).not.toBeInTheDocument();
  });

  it('opens confirmation without calling the API when a preview exists', async () => {
    mocks.generateMealPlan.mockResolvedValueOnce(plan());
    await renderPlanner(false);
    confirmGenerate();
    await screen.findByRole('heading', { name: 'Weekly meal plan preview' });

    fireEvent.click(screen.getByRole('button', { name: 'Re-generate' }));
    expect(mocks.generateMealPlan).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { name: 'Generate a New Meal Plan?' })).toBeInTheDocument();
  });

  it('uses the actual toolbar beside Save Plan for the preview state', async () => {
    mocks.generateMealPlan.mockResolvedValueOnce(plan('Existing preview')).mockResolvedValueOnce(plan('Replacement preview'));
    await renderPlanner(true, true);

    const toolbar = screen.getByRole('button', { name: 'Re-generate' });
    expect(toolbar).toBeInTheDocument();
    fireEvent.click(toolbar);
    expect(screen.getByRole('heading', { name: 'Generate a New Meal Plan?' })).toBeInTheDocument();
    expect(mocks.generateMealPlan).toHaveBeenCalledTimes(0);

    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Re-generate' })).toBeInTheDocument();
    expect(mocks.generateMealPlan).toHaveBeenCalledTimes(0);

    fireEvent.click(screen.getByRole('button', { name: 'Re-generate' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Re-generate' }));
    await waitFor(() => expect(mocks.generateMealPlan).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Replacement preview')).toBeInTheDocument();
    expect(screen.getByText('Saved dish')).toBeInTheDocument();
    expect(mocks.saveAiGeneratedMenu).not.toHaveBeenCalled();
  });

  it('closes re-generation confirmation without calling the API via close or Escape', async () => {
    await renderPlanner(true, true);
    fireEvent.click(screen.getByRole('button', { name: 'Re-generate' }));
    const dialog = screen.getByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(mocks.generateMealPlan).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Re-generate' }));
    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' });
    expect(mocks.generateMealPlan).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Re-generate' })).toBeInTheDocument();
  });

  it('recomputes the toolbar mode when switching to another week', async () => {
    await renderPlanner(true, true);
    mocks.getCurrentWeeklyMenu.mockResolvedValueOnce({});

    fireEvent.click(screen.getByRole('button', { name: 'Next week' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Generate' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
    expect(mocks.generateMealPlan).toHaveBeenCalledTimes(0);
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Create Meal Plan' }));
    expect(await screen.findByRole('heading', { name: 'Weekly meal plan preview' })).toBeInTheDocument();
  });

  it('does not send duplicate generation requests while loading', async () => {
    let resolveGeneration;
    mocks.generateMealPlan.mockReturnValueOnce(new Promise((resolve) => { resolveGeneration = resolve; }));
    await renderPlanner(false);

    const generateButton = screen.getByRole('button', { name: 'Generate' });
    fireEvent.click(generateButton);
    const confirmButton = within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Create Meal Plan' });
    fireEvent.click(confirmButton);
    fireEvent.click(confirmButton);
    expect(mocks.generateMealPlan).toHaveBeenCalledTimes(1);
    resolveGeneration(plan());
    expect(await screen.findByRole('heading', { name: 'Weekly meal plan preview' })).toBeInTheDocument();
  });

  it('cancels without changing the preview and confirms exactly one re-generation', async () => {
    mocks.generateMealPlan.mockResolvedValueOnce(plan('Old preview')).mockResolvedValueOnce(plan('New preview'));
    await renderPlanner(false);
    confirmGenerate();
    await screen.findByRole('heading', { name: 'Weekly meal plan preview' });
    fireEvent.click(screen.getByRole('button', { name: 'Re-generate' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(mocks.generateMealPlan).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText('Old preview').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Re-generate' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Re-generate' }));
    await waitFor(() => expect(mocks.generateMealPlan).toHaveBeenCalledTimes(2));
    expect(screen.getAllByText('New preview').length).toBeGreaterThan(0);
    expect(mocks.saveAiGeneratedMenu).not.toHaveBeenCalled();
  });

  it('preserves the previous preview when re-generation fails', async () => {
    mocks.generateMealPlan.mockResolvedValueOnce(plan('Old preview')).mockRejectedValueOnce(new Error('AI service is unavailable.'));
    await renderPlanner(false);
    confirmGenerate();
    await screen.findByRole('heading', { name: 'Weekly meal plan preview' });
    fireEvent.click(screen.getByRole('button', { name: 'Re-generate' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Re-generate' }));

    expect(await screen.findByText('AI service is unavailable.')).toBeInTheDocument();
    expect(screen.getAllByText('Old preview').length).toBeGreaterThan(0);
    expect(mocks.generateMealPlan).toHaveBeenCalledTimes(2);
  });

  it('keeps the confirmation dialog open while regenerating and retries in place', async () => {
    let resolveRetry;
    mocks.generateMealPlan
      .mockResolvedValueOnce(plan('Old preview'))
      .mockRejectedValueOnce(new Error('The planner timed out before finding a feasible plan.'))
      .mockReturnValueOnce(new Promise((resolve) => { resolveRetry = resolve; }));
    await renderPlanner(false);
    confirmGenerate();
    await screen.findByRole('heading', { name: 'Weekly meal plan preview' });
    fireEvent.click(screen.getByRole('button', { name: 'Re-generate' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Re-generate' }));

    expect(await screen.findByRole('heading', { name: 'Meal Plan Could Not Be Generated' })).toBeInTheDocument();
    expect(screen.getByText('The planner timed out before finding a feasible plan.')).toBeInTheDocument();
    expect(screen.getAllByText('Old preview').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    expect(await screen.findByRole('heading', { name: 'Generating Your Meal Plan' })).toBeInTheDocument();
    expect(mocks.generateMealPlan).toHaveBeenCalledTimes(3);
    expect(screen.queryByText('Generating your AI meal plan...')).not.toBeInTheDocument();

    resolveRetry(plan('New preview'));
    expect(await screen.findByText('New preview')).toBeInTheDocument();
  });
});
