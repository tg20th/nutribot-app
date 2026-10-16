import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DishDetailModal from '../DishDetailModal';
import { getDishDetail } from '../../../services/dishService';

vi.mock('../../../services/dishService', () => ({
  getDishDetail: vi.fn(),
}));

const detail = (steps) => ({
  name: 'Simple bowl',
  ingredients: [{ name: 'Tofu', quantity: '200', unit: 'g' }],
  steps,
});

describe('DishDetailModal', () => {
  beforeEach(() => vi.resetAllMocks());

  it('uses one scroll body and renders each cooking step separately', async () => {
    getDishDetail.mockResolvedValue(detail([
      'Prepare the ingredients.',
      'Cook the main ingredients.',
      'Combine and season.',
    ]));
    render(<DishDetailModal meal={{ dishId: 1 }} onClose={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('Cook step by step')).toBeInTheDocument());
    expect(document.querySelector('.dish-detail-scroll')).toBeInTheDocument();
    expect(screen.getByText('01')).toBeInTheDocument();
    expect(screen.getByText('02')).toBeInTheDocument();
    expect(screen.getByText('03')).toBeInTheDocument();
    expect(document.querySelector('.detail-method-steps')).toBeInTheDocument();
    expect(document.querySelectorAll('.dish-detail-grid ol > li')).toHaveLength(3);
  });

  it('keeps the close button available when content is long', async () => {
    getDishDetail.mockResolvedValue(detail(Array.from({ length: 20 }, (_, index) => `Step ${index + 1}`)));
    const onClose = vi.fn();
    render(<DishDetailModal meal={{ dishId: 2 }} onClose={onClose} />);

    await waitFor(() => expect(screen.getByText('Step 20')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Close dish details' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
