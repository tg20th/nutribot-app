import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '../apiClient';
import {
  contentRecipeSuggestionsApi,
  isRecipeConsentValid,
  mapContentRecipeSuggestion,
  RECIPE_CONSENT_TERMS_VERSION,
} from '../contentRecipeSuggestionsApi';

vi.mock('../apiClient', () => ({
  apiRequest: vi.fn(),
  unwrapData: (payload, fallback = {}) => payload?.data ?? fallback,
}));

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

const suggestionPayload = {
  suggestionId: 5,
  status: 'PENDING',
  contentId: 82,
  contentType: 'BLOG',
  contentTitle: 'Bún gạo lứt rau củ',
  authorName: 'Bảo Trâm',
  sourceContent: {
    recipeConsent: true,
    recipeConsentAt: '2026-10-10T08:00:00Z',
    recipeConsentTermsVersion: 'v1',
  },
  dish: { name: 'Bún gạo lứt rau củ' },
  ingredients: [{ name: 'Bún gạo lứt', quantity: null, unit: 'g' }],
  validation: invalidValidation,
};

describe('contentRecipeSuggestionsApi (NB-87)', () => {
  beforeEach(() => vi.resetAllMocks());

  it('maps the validation block returned for a pending suggestion', async () => {
    apiRequest.mockResolvedValue({ data: suggestionPayload });

    const item = await contentRecipeSuggestionsApi.getById(5);

    expect(apiRequest).toHaveBeenCalledWith('/api/v1/admin/content-recipe-suggestions/5', { signal: undefined });
    expect(item.validation.canApprove).toBe(false);
    expect(item.validation.valid).toBe(false);
    expect(item.validation.vegetarianType).toBe('VEGAN');
    expect(item.validation.issues).toEqual([{
      field: 'ingredients[0].quantity',
      code: 'INGREDIENT_QUANTITY_REQUIRED',
      severity: 'ERROR',
      message: 'Nguyên liệu "Bún gạo lứt" thiếu số lượng',
    }]);
  });

  it('keeps validation null when the list endpoint omits it', () => {
    const item = mapContentRecipeSuggestion({ suggestionId: 1, status: 'PENDING', dishName: 'Salad' });

    expect(item.validation).toBeNull();
    expect(item.source.recipeConsent).toBe(false);
  });

  it('treats consent as valid only with a timestamp and the current terms version', () => {
    expect(isRecipeConsentValid({
      recipeConsent: true,
      recipeConsentAt: '2026-10-10T08:00:00Z',
      recipeConsentTermsVersion: RECIPE_CONSENT_TERMS_VERSION,
    })).toBe(true);

    expect(isRecipeConsentValid({
      recipeConsent: true,
      recipeConsentAt: null,
      recipeConsentTermsVersion: RECIPE_CONSENT_TERMS_VERSION,
    })).toBe(false);

    expect(isRecipeConsentValid({
      recipeConsent: true,
      recipeConsentAt: '2026-10-10T08:00:00Z',
      recipeConsentTermsVersion: 'v0',
    })).toBe(false);

    expect(isRecipeConsentValid(null)).toBe(false);
  });

  it('sends the review action and maps the updated suggestion', async () => {
    apiRequest.mockResolvedValue({
      data: { ...suggestionPayload, status: 'APPROVED', validation: null, dish: { name: 'Bún gạo lứt rau củ' }, dishId: 50, recipeId: 60 },
    });

    const item = await contentRecipeSuggestionsApi.review(5, 'APPROVE');

    expect(apiRequest).toHaveBeenCalledWith('/api/v1/admin/content-recipe-suggestions/5/review', {
      method: 'PUT',
      body: JSON.stringify({ action: 'APPROVE', rejectionReason: null }),
    });
    expect(item.status).toBe('APPROVED');
    expect(item.validation).toBeNull();
  });
});
