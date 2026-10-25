import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getAllergyIngredients: vi.fn(),
  getHealthProfile: vi.fn(),
  updateHealthProfile: vi.fn(),
}));

vi.mock('../../../services/profileApi', () => mocks);

import HealthProfileSection from '../HealthProfileSection';
import { ToastProvider } from '../../notifications/ToastProvider';

const profile = {
  heightCm: 170,
  weightKg: 65,
  bmi: 22.5,
  healthGoal: 'maintain',
  vegetarianType: 'VEGAN',
  allergyIngredientIds: [99],
  allergies: ['Old catalog ingredient'],
};

describe('HealthProfileSection inactive saved allergies', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getHealthProfile.mockResolvedValue(profile);
    mocks.getAllergyIngredients.mockResolvedValue([{ ingredientId: 2, name: 'Tofu', slug: 'tofu' }]);
    mocks.updateHealthProfile.mockResolvedValue(profile);
  });

  it('keeps inactive saved allergy visible and submits it with unrelated profile edits', async () => {
    render(<ToastProvider><HealthProfileSection /></ToastProvider>);

    const allergyGroup = await screen.findByRole('group', { name: 'Allergy ingredients' });
    expect(within(allergyGroup).getByRole('button', { name: /Old catalog ingredient.*Unavailable/ })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('remain selected');

    fireEvent.change(screen.getByRole('spinbutton', { name: 'Weight kg' }), { target: { value: '66' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save health profile' }));

    await waitFor(() => expect(mocks.updateHealthProfile).toHaveBeenCalledWith(expect.objectContaining({
      weightKg: 66,
      allergyIngredientIds: [99],
    })));
  });
});
