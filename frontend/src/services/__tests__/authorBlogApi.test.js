import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '../apiClient';
import { calculateRecipeNutrition } from '../authorBlogApi';
import { normalizePost } from '../communityApi';

vi.mock('../apiClient', () => ({
  apiRequest: vi.fn(),
  unwrapData: (payload, fallback = {}) => payload?.data ?? fallback,
}));

describe('authorBlogApi & nutrition normalization', () => {
  beforeEach(() => vi.resetAllMocks());

  it('calculates recipe nutrition via backend AI gateway', async () => {
    apiRequest.mockResolvedValue({
      data: {
        success: true,
        dishName: 'Salad đậu phụ',
        servings: 2,
        nutritionFacts: {
          calories: 320,
          proteinG: 18.5,
          carbsG: 22.0,
          fatG: 12.0,
          fiberG: 5.5,
          sodiumMg: 420.0,
        },
      },
    });

    const result = await calculateRecipeNutrition({
      servings: 2,
      dishName: 'Salad đậu phụ',
      ingredients: [
        { name: 'Đậu phụ', quantity: 200, unit: 'g' },
        { name: 'Xà lách', quantity: 100, unit: 'g' },
      ],
    });

    expect(apiRequest).toHaveBeenCalledWith('/api/v1/author/nutrition/calculate', {
      method: 'POST',
      body: JSON.stringify({
        servings: 2,
        dishName: 'Salad đậu phụ',
        ingredients: [
          { name: 'Đậu phụ', quantity: 200, unit: 'g' },
          { name: 'Xà lách', quantity: 100, unit: 'g' },
        ],
      }),
      signal: undefined,
    });

    expect(result.nutritionFacts.calories).toBe(320);
    expect(result.nutritionFacts.proteinG).toBe(18.5);
  });

  it('normalizes markdown recipe data into detail page format', () => {
    const rawPost = {
      contentId: 42,
      contentType: 'BLOG',
      title: 'Tofu Steak Sốt Tiêu',
      body: `Món ăn giàu đạm thực vật thơm ngon dễ làm.

## Recipe details
- Prep time: 10 min
- Cook time: 15 min
- Servings: 2
- Calories: 280 kcal
- Protein: 20 g
- Carbohydrates: 15 g
- Fat: 10 g
- Fiber: 4 g
- Sodium: 350 mg

## Ingredients
- 250 g Đậu phụ
- 1 tbsp Dầu ô-liu
- 1 tsp Tiêu đen

## Steps
- Step 1: Cắt đậu phụ thành lát dày
- Step 2: Áp chảo vàng đều 2 mặt
- Step 3: Rưới sốt tiêu và thưởng thức`,
    };

    const normalized = normalizePost(rawPost);

    expect(normalized.calories).toBe(280);
    expect(normalized.protein).toBe(20);
    expect(normalized.nutrition).toEqual({
      carbs: '15g',
      fat: '10g',
      fiber: '4g',
      sodium: '350mg',
    });
    expect(normalized.pantryItems).toEqual([
      '250 g Đậu phụ',
      '1 tbsp Dầu ô-liu',
      '1 tsp Tiêu đen',
    ]);
    expect(normalized.steps).toEqual([
      'Cắt đậu phụ thành lát dày',
      'Áp chảo vàng đều 2 mặt',
      'Rưới sốt tiêu và thưởng thức',
    ]);
    expect(normalized.prepTime).toBe('10 min');
    expect(normalized.cookTime).toBe('15 min');
    expect(normalized.servings).toBe(2);
    expect(normalized.cleanBody).toBe('Món ăn giàu đạm thực vật thơm ngon dễ làm.');
  });

  it('correctly parses HTML recipe data created from rich text editor', () => {
    const rawPost = {
      contentId: 99,
      contentType: 'BLOG',
      title: 'Salad đậu phụ sốt mè rang',
      body: `<div><font face="Outfit, sans-serif"><span style="font-size: 14px;">Salad đậu phụ sốt mè rang là món ăn thanh đạm, dồi dào chất xơ.</span></font></div> <h2>Recipe details</h2><ul><li>Prep time: 10 min</li><li>Cook time: 5 min</li><li>Servings: 2</li><li>Calories: 280 kcal</li><li>Protein: 14 g</li><li>Carbohydrates: 18 g</li><li>Fat: 16 g</li><li>Fiber: 6 g</li><li>Sodium: 320 mg</li></ul> <h2>Ingredients</h2><ul><li>200 g đậu phụ tươi cắt hạt lựu</li><li>1 cây xà lách tươi rửa sạch</li><li>10 quả cà chua bi cắt đôi</li></ul> <h2>Steps</h2><ul><li>Step 1: Rửa sạch xà lách, cà chua bi rồi để ráo.</li><li>Step 2: Cắt đậu phụ thành khối vuông nhỏ.</li></ul>`,
    };

    const normalized = normalizePost(rawPost);

    expect(normalized.calories).toBe(280);
    expect(normalized.protein).toBe(14);
    expect(normalized.nutrition).toEqual({
      carbs: '18g',
      fat: '16g',
      fiber: '6g',
      sodium: '320mg',
    });
    expect(normalized.pantryItems).toEqual([
      '200 g đậu phụ tươi cắt hạt lựu',
      '1 cây xà lách tươi rửa sạch',
      '10 quả cà chua bi cắt đôi',
    ]);
    expect(normalized.steps).toEqual([
      'Rửa sạch xà lách, cà chua bi rồi để ráo.',
      'Cắt đậu phụ thành khối vuông nhỏ.',
    ]);
    expect(normalized.prepTime).toBe('10 min');
    expect(normalized.cookTime).toBe('5 min');
    expect(normalized.servings).toBe(2);
    expect(normalized.cleanBody).toBe('Salad đậu phụ sốt mè rang là món ăn thanh đạm, dồi dào chất xơ.');
    expect(normalized.body).not.toContain('<font');
    expect(normalized.body).not.toContain('<h2>');
  });
});
