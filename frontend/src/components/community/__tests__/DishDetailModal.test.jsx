import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
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

const renderModal = (props) => render(<MemoryRouter><DishDetailModal {...props} /></MemoryRouter>);

describe('DishDetailModal', () => {
  beforeEach(() => vi.resetAllMocks());

  it('uses one scroll body and renders each cooking step separately', async () => {
    getDishDetail.mockResolvedValue(detail([
      'Prepare the ingredients.',
      'Cook the main ingredients.',
      'Combine and season.',
    ]));
    renderModal({ meal: { dishId: 1 }, onClose: vi.fn() });

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
    renderModal({ meal: { dishId: 2 }, onClose });

    await waitFor(() => expect(screen.getByText('Step 20')).toBeInTheDocument());
    expect(document.querySelector('.dish-detail-topbar')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Close dish details' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('labels a catalog recipe as NutriBot and keeps contributor links absent', async () => {
    getDishDetail.mockResolvedValue(detail([]));
    renderModal({ meal: { dishId: 3 }, onClose: vi.fn() });

    await waitFor(() => expect(screen.getByText('NutriBot recipe')).toBeInTheDocument());
    expect(screen.queryByText(/View original post/i)).not.toBeInTheDocument();
  });

  it('links a contributor profile and only reveals a verified public source post', async () => {
    getDishDetail.mockResolvedValue({
      ...detail([]),
      sourceAuthorId: 48,
      sourceAuthorName: 'Linh Anh',
      sourceContentId: 91,
      sourceContentPublic: true
    });
    renderModal({ meal: { dishId: 4 }, onClose: vi.fn() });

    const profileLink = await screen.findByRole('link', { name: 'By Linh Anh' });
    expect(profileLink).toHaveAttribute('href', '/community/users/48');
    expect(screen.getByRole('link', { name: /View original post/i })).toHaveAttribute('href', '/community/posts/91');
  });

  it('does not reveal an original post without an explicit public flag', async () => {
    getDishDetail.mockResolvedValue({ ...detail([]), sourceContentId: 91 });
    renderModal({ meal: { dishId: 5 }, onClose: vi.fn() });

    await waitFor(() => expect(screen.getByText('Community contribution')).toBeInTheDocument());
    expect(screen.queryByRole('link', { name: /View original post/i })).not.toBeInTheDocument();
  });
});
