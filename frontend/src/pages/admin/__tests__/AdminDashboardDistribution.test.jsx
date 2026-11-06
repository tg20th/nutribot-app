import { describe, expect, it } from 'vitest';
import {
  CATEGORY_CHART_COLORS,
  OTHERS_COLOR,
  buildCategoryColors,
  buildCategorySlices,
  buildDisplayCategorySlices,
  categoryColorKey,
  donutBackground,
} from '../AdminDashboard';
import { summarizeAdminReviewOutcomes } from '../../../services/adminApi';

const category = (id, name, contentCount) => ({ id, name, contentCount });

describe('AdminDashboard content distribution', () => {
  it('keeps every category but plots only valid positive counts', () => {
    const allCategories = buildCategorySlices([
      category(1, 'Breakfast', 4),
      category(2, 'Dinner', 0),
      category(3, 'Invalid', 'not-a-number'),
      category(4, 'Negative', -2),
    ]);

    expect(allCategories).toHaveLength(4);
    expect(allCategories.find((item) => item.id === 2).value).toBe(0);
    expect(allCategories.find((item) => item.id === 3).countValid).toBe(false);
    expect(allCategories.filter((item) => item.countValid && item.value > 0).map((item) => item.id)).toEqual([1]);
  });

  it('assigns stable colors from the approved palette beyond ten categories', () => {
    const categories = Array.from({ length: 15 }, (_, index) => category(index + 1, `Category ${index + 1}`, index + 1));
    const first = buildCategoryColors(categories);
    const reordered = buildCategoryColors([...categories].reverse());

    expect(Object.values(first).every((color) => CATEGORY_CHART_COLORS.includes(color))).toBe(true);
    expect(Object.values(first)).toHaveLength(15);
    categories.forEach((item) => expect(reordered[categoryColorKey(item)]).toBe(first[categoryColorKey(item)]));
  });

  it('uses the neutral Others color for uncategorized content', () => {
    const uncategorized = { ...category(null, 'Others', 3), isUncategorized: true };
    expect(buildCategoryColors([uncategorized])[categoryColorKey(uncategorized)]).toBe(OTHERS_COLOR);
  });

  it('keeps the top ten categories and combines the remainder into Others', () => {
    const categories = Array.from({ length: 12 }, (_, index) => category(index + 1, `Category ${index + 1}`, 12 - index));
    const { slices, remaining, others } = buildDisplayCategorySlices(buildCategorySlices(categories));

    expect(slices).toHaveLength(11);
    expect(slices.slice(0, 10).map((item) => item.label)).toEqual(categories.slice(0, 10).map((item) => item.name));
    expect(remaining.map((item) => item.label)).toEqual(['Category 11', 'Category 12']);
    expect(others.value).toBe(3);
    expect(slices.at(-1).chartColor).toBe(OTHERS_COLOR);
  });

  it('uses category IDs so duplicate display names retain separate colors', () => {
    const categories = [category(21, 'Shared name', 5), category(22, 'Shared name', 3)];
    const colors = buildCategoryColors(categories);

    expect(categoryColorKey(categories[0])).not.toBe(categoryColorKey(categories[1]));
    expect(colors[categoryColorKey(categories[0])]).not.toBe(colors[categoryColorKey(categories[1])]);
  });

  it('does not create a gradient or phantom slice for an empty positive dataset', () => {
    const allCategories = buildCategorySlices([category(1, 'Breakfast', 0), category(2, 'Dinner', 0)]);
    const chartCategories = allCategories.filter((item) => item.countValid && item.value > 0);

    expect(chartCategories).toHaveLength(0);
    expect(donutBackground(chartCategories, {})).toBe('var(--sage)');
  });

  it('plots a complete positive dataset whose angles sum to 360 degrees', () => {
    const chartCategories = buildCategorySlices([category(1, 'Breakfast', 2), category(2, 'Dinner', 3)])
      .filter((item) => item.countValid && item.value > 0);
    const total = chartCategories.reduce((sum, item) => sum + item.value, 0);
    const angleTotal = chartCategories.reduce((sum, item) => sum + ((item.value / total) * 360), 0);

    expect(angleTotal).toBeCloseTo(360, 10);
  });

  it('counts only the latest admin decision per content', () => {
    const result = summarizeAdminReviewOutcomes([
      { id: 1, contentId: 10, action: 'APPROVE', reviewedAt: '2026-01-01T10:00:00Z' },
      { id: 2, contentId: 10, action: 'REJECT', reviewedAt: '2026-01-02T10:00:00Z' },
      { id: 3, contentId: 11, action: 'APPROVE', reviewedAt: '2026-01-02T11:00:00Z' },
      { id: 4, contentId: 12, action: 'AI_APPROVE', reviewedAt: '2026-01-03T10:00:00Z' },
    ]);

    expect(result.counts).toEqual({ approved: 1, rejected: 1 });
    expect(result.total).toBe(2);
  });

  it('returns an empty outcome when there are no admin decisions', () => {
    const result = summarizeAdminReviewOutcomes([]);

    expect(result.total).toBe(0);
    expect(result.items.map((item) => item.value)).toEqual([0, 0]);
  });
});
