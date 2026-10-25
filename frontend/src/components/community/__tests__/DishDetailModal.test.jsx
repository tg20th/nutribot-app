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

    await waitFor(() => expect(screen.getByText('Method')).toBeInTheDocument());
    expect(document.querySelector('.dish-detail-scroll')).toBeInTheDocument();
    expect(screen.getByText('01')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(document.querySelector('.detail-method')).toBeInTheDocument();
    expect(document.querySelectorAll('.detail-method ol > li')).toHaveLength(3);
  });

  it('keeps supplied ingredient quantities and leaves missing values blank', async () => {
    getDishDetail.mockResolvedValue({
      ...detail(['Cook it.']),
      ingredients: [
        { ingredientId: 1, name: 'Rice noodles', quantity: '150', unit: 'g' },
        { ingredientId: 2, name: 'Mushrooms', quantity: null, unit: 'g' },
        { ingredientId: 3, name: 'Tofu', quantity: null, unit: null },
      ],
    });
    render(<DishDetailModal meal={{ dishId: 3 }} onClose={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('150 g Rice noodles')).toBeInTheDocument());
    expect(screen.getByText('g Mushrooms')).toBeInTheDocument();
    expect(screen.getByText('Tofu')).toBeInTheDocument();
    expect(screen.queryByText(/undefined|null/)).toBeNull();
  });

  it('keeps the close button available when content is long', async () => {
    getDishDetail.mockResolvedValue(detail(Array.from({ length: 20 }, (_, index) => `Step ${index + 1}`)));
    const onClose = vi.fn();
    render(<DishDetailModal meal={{ dishId: 2 }} onClose={onClose} />);

    await waitFor(() => expect(screen.getByText('Step 20')).toBeInTheDocument());
    expect(document.querySelector('.dish-detail-topbar')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Close dish details' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
