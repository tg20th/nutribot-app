import { describe, expect, it } from 'vitest';
import {
  buildCategoryColors,
  buildCategorySlices,
  categoryColorKey,
  donutBackground,
} from '../AdminDashboard';

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

  it('assigns stable distinguishable colors beyond the base palette', () => {
    const categories = Array.from({ length: 15 }, (_, index) => category(index + 1, `Category ${index + 1}`, index + 1));
    const first = buildCategoryColors(categories);
    const reordered = buildCategoryColors([...categories].reverse());

    expect(new Set(Object.values(first)).size).toBe(15);
    categories.forEach((item) => expect(reordered[categoryColorKey(item)]).toBe(first[categoryColorKey(item)]));
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
});
