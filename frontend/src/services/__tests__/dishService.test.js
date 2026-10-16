import { describe, expect, it } from 'vitest';
import { normalizeCookingSteps } from '../dishService';

describe('normalizeCookingSteps', () => {
  it('keeps array-based instructions as separate steps', () => {
    expect(normalizeCookingSteps(['Prepare the ingredients.', 'Cook the main ingredients.']))
      .toEqual(['Prepare the ingredients.', 'Cook the main ingredients.']);
  });

  it('parses a sequential numbered string without splitting decimal quantities', () => {
    expect(normalizeCookingSteps('1. Prepare the ingredients. 2. Add 1.5 cups of water. 3. Serve.'))
      .toEqual(['Prepare the ingredients.', 'Add 1.5 cups of water.', 'Serve.']);
  });

  it('splits multiline instructions and removes only list prefixes', () => {
    expect(normalizeCookingSteps('Prepare the ingredients.\nCook the main ingredients.\nCombine and season.'))
      .toEqual(['Prepare the ingredients.', 'Cook the main ingredients.', 'Combine and season.']);
  });

  it('preserves an unparseable single instruction and handles empty values', () => {
    expect(normalizeCookingSteps('Stir for 1.5 minutes, then serve.'))
      .toEqual(['Stir for 1.5 minutes, then serve.']);
    expect(normalizeCookingSteps('')).toEqual([]);
    expect(normalizeCookingSteps(null)).toEqual([]);
  });
});
