// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import AdminContentRecipeSuggestionsPage from '../AdminContentRecipeSuggestionsPage';
import { contentRecipeSuggestionsApi } from '../../../services/contentRecipeSuggestionsApi';
import { getAllergyIngredients } from '../../../services/profileApi';
import { adminIngredientApi } from '../../../services/adminIngredientApi';

vi.mock('../../../services/profileApi', () => ({ getAllergyIngredients: vi.fn().mockResolvedValue([]) }));
vi.mock('../../../services/adminIngredientApi', () => ({
  adminIngredientApi: { getCategories: vi.fn().mockResolvedValue([]), createIngredient: vi.fn() },
}));

vi.mock('../../../services/contentRecipeSuggestionsApi', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    contentRecipeSuggestionsApi: {
      list: vi.fn(),
      getById: vi.fn(),
      review: vi.fn(),
    },
  };
});

const invalidValidation = {
  valid: false,
  canApprove: false,
  vegetarianType: 'VEGAN',
  vegetarianVerdict: 'VEGETARIAN',
  issues: [{
    field: 'ingredients[0].quantity',
    code: 'INGREDIENT_QUANTITY_REQUIRED',
    severity: 'ERROR',
    message: 'Nguyên liệu "Bún gạo lứt" thiếu số lượng',
  }],
};

const validValidation = { valid: true, canApprove: true, vegetarianType: 'VEGAN', vegetarianVerdict: 'VEGETARIAN', issues: [] };

function suggestion(overrides = {}) {
  return {
    suggestionId: 5,
    status: 'PENDING',
    createdAt: '2026-10-10T08:00:00Z',
    reviewedAt: null,
    reviewerName: null,
    rejectionReason: null,
    source: {
      contentId: 82,
      contentType: 'BLOG',
      title: 'Bún gạo lứt rau củ',
      authorName: 'Bảo Trâm',
      viewCount: 1847,
      voteCount: 126,
      url: null,
      recipeConsent: true,
      recipeConsentAt: '2026-10-05T09:00:00Z',
      recipeConsentTermsVersion: 'v1',
    },
    dish: { name: 'Bún gạo lứt rau củ', description: '', servingSize: 1, servingUnit: 'bowl' },
    nutrition: { calories: 418, proteinG: 15.8, carbsG: 64.2, fatG: 11.6, fiberG: 9.4 },
    ingredients: [{ name: 'Bún gạo lứt', quantity: null, unit: 'g' }],
    recipe: { title: 'Bún gạo lứt rau củ', description: '', prepTimeMin: 12, cookTimeMin: 10, servings: 1, steps: ['Ngâm bún'] },
    restaurant: {},
    validation: invalidValidation,
    ...overrides,
  };
}

describe('admin recipe suggestion review (NB-87)', () => {
  beforeEach(() => {
    contentRecipeSuggestionsApi.list.mockResolvedValue({ content: [suggestion()], totalElements: 1, totalPages: 1 });
    contentRecipeSuggestionsApi.getById.mockResolvedValue(suggestion());
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('blocks approval and lists validation issues for an invalid suggestion', async () => {
    render(<AdminContentRecipeSuggestionsPage />);

    expect(await screen.findByRole('heading', { name: 'Cannot approve yet' })).toBeTruthy();
    expect(screen.getByText('Nguyên liệu "Bún gạo lứt" thiếu số lượng')).toBeTruthy();
    expect(screen.getByText('ingredients[0].quantity')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Approve suggestion' }).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Reject' }).disabled).toBe(false);
  });

  it('blocks approval when the author has not consented', async () => {
    const noConsent = suggestion({
      validation: validValidation,
      source: { ...suggestion().source, recipeConsent: false, recipeConsentAt: null, recipeConsentTermsVersion: null },
    });
    contentRecipeSuggestionsApi.list.mockResolvedValue({ content: [noConsent], totalElements: 1, totalPages: 1 });
    contentRecipeSuggestionsApi.getById.mockResolvedValue(noConsent);

    render(<AdminContentRecipeSuggestionsPage />);

    expect(await screen.findByText('✗ No consent')).toBeTruthy();
    expect(screen.getByText('Author consent is required before this suggestion can be approved.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Approve suggestion' }).disabled).toBe(true);
  });

  it('flags consent recorded under an outdated terms version', async () => {
    const outdated = suggestion({
      validation: validValidation,
      source: { ...suggestion().source, recipeConsentTermsVersion: 'v0' },
    });
    contentRecipeSuggestionsApi.list.mockResolvedValue({ content: [outdated], totalElements: 1, totalPages: 1 });
    contentRecipeSuggestionsApi.getById.mockResolvedValue(outdated);

    render(<AdminContentRecipeSuggestionsPage />);

    expect(await screen.findByText('! Consent outdated')).toBeTruthy();
    expect(screen.getByText(/Author consented to terms v0; current terms are v1/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Approve suggestion' }).disabled).toBe(true);
  });

  it('approves a valid suggestion after confirmation', async () => {
    const valid = suggestion({ validation: validValidation });
    contentRecipeSuggestionsApi.list.mockResolvedValue({ content: [valid], totalElements: 1, totalPages: 1 });
    contentRecipeSuggestionsApi.getById.mockResolvedValue(valid);
    contentRecipeSuggestionsApi.review.mockResolvedValue({ ...valid, status: 'APPROVED', validation: null });

    render(<AdminContentRecipeSuggestionsPage />);

    expect(await screen.findByRole('heading', { name: 'Ready to approve' })).toBeTruthy();
    const approve = screen.getByRole('button', { name: 'Approve suggestion' });
    expect(approve.disabled).toBe(false);
    fireEvent.click(approve);

    expect(await screen.findByRole('heading', { name: 'Approve this suggestion?' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

    await waitFor(() => expect(contentRecipeSuggestionsApi.review).toHaveBeenCalledWith(5, 'APPROVE', '', []));
  });

  it('shows server validation issues when approval is rejected with 422', async () => {
    const valid = suggestion({ validation: validValidation });
    contentRecipeSuggestionsApi.list.mockResolvedValue({ content: [valid], totalElements: 1, totalPages: 1 });
    contentRecipeSuggestionsApi.getById.mockResolvedValue(valid);
    contentRecipeSuggestionsApi.review.mockRejectedValue({
      status: 422,
      message: 'Dữ liệu công thức chưa hợp lệ, không thể duyệt',
      payload: {
        data: [{
          field: 'dish.name',
          code: 'DISH_NAME_REQUIRED',
          severity: 'ERROR',
          message: 'Đề xuất thiếu tên món ăn',
        }],
      },
    });

    render(<AdminContentRecipeSuggestionsPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Approve suggestion' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Approve' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Approval was blocked');
    expect(alert.textContent).toContain('Dữ liệu công thức chưa hợp lệ, không thể duyệt');
    expect(alert.textContent).toContain('dish.name');
    expect(alert.textContent).toContain('Đề xuất thiếu tên món ăn');
    expect(screen.getByRole('heading', { name: 'Approve this suggestion?' })).toBeTruthy();
  });

  it('rejects a suggestion with a reason', async () => {
    const valid = suggestion({ validation: validValidation });
    contentRecipeSuggestionsApi.list.mockResolvedValue({ content: [valid], totalElements: 1, totalPages: 1 });
    contentRecipeSuggestionsApi.getById.mockResolvedValue(valid);
    contentRecipeSuggestionsApi.review.mockResolvedValue({ ...valid, status: 'REJECTED', rejectionReason: 'Thiếu nguồn dinh dưỡng' });

    render(<AdminContentRecipeSuggestionsPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Reject' }));
    fireEvent.change(screen.getByPlaceholderText(/nutrition information needs a verifiable source/), {
      target: { value: 'Thiếu nguồn dinh dưỡng' },
    });
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Reject' }));

    await waitFor(() => expect(contentRecipeSuggestionsApi.review)
      .toHaveBeenCalledWith(5, 'REJECT', 'Thiếu nguồn dinh dưỡng', []));
  });

  it('lets Admin map an unresolved proposal to an existing ingredient before approval', async () => {
    const unresolved = suggestion({ validation: {
      valid: false,
      canApprove: false,
      issues: [{ field: 'ingredients[0]', code: 'INGREDIENT_MAPPING_REQUIRED', severity: 'ERROR', message: 'Select an existing catalog ingredient.' }],
      ingredientResolutions: [{ proposalIndex: 0, proposedName: 'Bún gạo lứt', status: 'UNRESOLVED' }],
    } });
    getAllergyIngredients.mockResolvedValue([{ ingredientId: 12, name: 'Bún gạo' }]);
    contentRecipeSuggestionsApi.list.mockResolvedValue({ content: [unresolved], totalElements: 1, totalPages: 1 });
    contentRecipeSuggestionsApi.getById.mockResolvedValue(unresolved);
    contentRecipeSuggestionsApi.review.mockResolvedValue({ ...unresolved, status: 'APPROVED' });

    render(<AdminContentRecipeSuggestionsPage />);

    fireEvent.change(await screen.findByRole('combobox', { name: 'Catalog match for Bún gạo lứt' }), { target: { value: 'Bún gạo' } });
    fireEvent.click(await screen.findByRole('option', { name: 'Bún gạo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Approve suggestion' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Approve' }));

    await waitFor(() => expect(contentRecipeSuggestionsApi.review)
      .toHaveBeenCalledWith(5, 'APPROVE', '', [{ proposalIndex: 0, ingredientId: 12 }]));
  });

  it('creates a missing ingredient and selects it for the proposal', async () => {
    const unresolved = suggestion({ validation: {
      valid: false,
      canApprove: false,
      issues: [{ field: 'ingredients[0]', code: 'INGREDIENT_MAPPING_REQUIRED', severity: 'ERROR', message: 'Select an existing catalog ingredient.' }],
      ingredientResolutions: [{ proposalIndex: 0, proposedName: 'Bột mè đen', status: 'UNRESOLVED' }],
    } });
    adminIngredientApi.getCategories.mockResolvedValue([{ id: 4, name: 'Spices' }]);
    adminIngredientApi.createIngredient.mockResolvedValue({ id: 88, name: 'Bột mè đen', categoryId: 4, active: true });
    contentRecipeSuggestionsApi.list.mockResolvedValue({ content: [unresolved], totalElements: 1, totalPages: 1 });
    contentRecipeSuggestionsApi.getById.mockResolvedValue(unresolved);
    contentRecipeSuggestionsApi.review.mockResolvedValue({ ...unresolved, status: 'APPROVED' });

    render(<AdminContentRecipeSuggestionsPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Create ingredient' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Ingredient category' }), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create and select' }));

    await waitFor(() => expect(adminIngredientApi.createIngredient).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Bột mè đen', slug: 'bot-me-den', categoryId: '4',
    })));
    expect(await screen.findByRole('combobox', { name: 'Catalog match for Bột mè đen' })).toHaveValue('Bột mè đen');

    fireEvent.click(screen.getByRole('button', { name: 'Approve suggestion' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(contentRecipeSuggestionsApi.review)
      .toHaveBeenCalledWith(5, 'APPROVE', '', [{ proposalIndex: 0, ingredientId: 88 }]));
  });
});
