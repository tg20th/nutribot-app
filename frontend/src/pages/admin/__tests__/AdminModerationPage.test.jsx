






























































// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AdminModerationPage from '../AdminModerationPage';
import { adminApi } from '../../../services/adminApi';

vi.mock('../../../services/adminApi', () => ({
  adminApi: {
    getModerationQueue: vi.fn(),
    moderateContent: vi.fn(),
  },
}));

const first = {
  id: 1, type: 'BLOG', title: 'Healthy lunch ideas', status: 'pending',
  author: 'minhanh', submittedAt: '2026-09-26T08:30:00', body: 'A short article preview.',
  aiFlagged: true, aiReason: 'Phát hiện nghi vấn cần duyệt tay', aiConfidence: 0.91,
};
const second = { id: 2, type: 'VIDEO', title: 'Prep fresh produce', status: 'pending', author: 'nutribot', submittedAt: '2026-09-25T10:15:00' };

describe('admin moderation screen', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/admin/moderation');
    adminApi.getModerationQueue.mockResolvedValue({ content: [first, second], totalElements: 2, totalPages: 1 });
    adminApi.moderateContent.mockResolvedValue({ ...first, status: 'rejected' });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('searches loaded queue entries and keeps title and submission text separate', async () => {
    render(<AdminModerationPage />);
    expect(await screen.findByText('A short article preview.')).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: 'Search title or author' }), { target: { value: 'produce' } });
    expect(screen.getByRole('heading', { level: 2, name: 'Prep fresh produce' })).toBeTruthy();
    expect(screen.queryByText('Healthy lunch ideas')).toBeNull();
  });

  it('confirms rejection and sends the backend action code', async () => {
    render(<AdminModerationPage />);
    fireEvent.click(await screen.findByRole('button', { name: /Reject/ }));
    const rejectionButtons = screen.getAllByRole('button', { name: 'Reject' });
    fireEvent.click(rejectionButtons[rejectionButtons.length - 1]);
    await waitFor(() => expect(adminApi.moderateContent).toHaveBeenCalledWith(1, 'REJECT'));
  });

  it('renders AI moderation evaluation and confidence when available', async () => {
    render(<AdminModerationPage />);
    expect(await screen.findByRole('heading', { name: 'AI Review' })).toBeTruthy();
    expect(screen.getByText(/Confidence: 91%/)).toBeTruthy();
  });

  it('opens submitted images in an accessible lightbox and closes with Escape', async () => {
    adminApi.getModerationQueue.mockResolvedValueOnce({
      content: [{ ...first, thumbnailUrl: 'https://cdn.example.test/cover.jpg', body: '<p>Story</p><img src="https://cdn.example.test/inline.jpg" />' }],
      totalElements: 1,
      totalPages: 1,
    });

    render(<AdminModerationPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Open cover image' }));
    expect(screen.getByRole('dialog', { name: 'Image inspection' })).toBeInTheDocument();
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(screen.getByAltText('Submitted content image 2 of 2')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Image inspection' })).toBeNull();
  });

  it('renders structured recipe view instead of raw JSON for recipe submissions', async () => {
    const recipeBody = JSON.stringify({
      version: 1,
      story: 'Một đĩa salad thanh mát, giòn rụm với sắc màu rực rỡ.',
      prepMinutes: '15',
      cookMinutes: '5',
      servings: '2',
      nutrition: { calories: '384', proteinG: '16.5', carbsG: '19.6', fatG: '30.5', fiberG: '10.1', sodiumMg: '144' },
      ingredients: [
        { name: 'Rau chân vịt (Bina)', quantity: '150', unit: 'g', isCustom: false },
        { name: 'Cà chua', quantity: '100', unit: 'g', isCustom: false },
      ],
      steps: [
        'Rửa sạch xà lách, dưa leo và cà chua.',
        'Cắt đậu phụ thành các khối vuông vừa ăn.',
      ],
    });

    const recipePost = {
      id: 3,
      type: 'BLOG',
      title: 'Salad Cầu Vồng Đậu Phụ',
      status: 'pending',
      author: 'saladlover',
      submittedAt: '2026-10-09T08:30:00',
      body: recipeBody,
    };

    adminApi.getModerationQueue.mockResolvedValueOnce({
      content: [recipePost],
      totalElements: 1,
      totalPages: 1,
    });

    render(<AdminModerationPage />);

    // Check that structured elements are rendered
    expect(await screen.findByText('Một đĩa salad thanh mát, giòn rụm với sắc màu rực rỡ.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Recipe overview' })).toBeInTheDocument();
    expect(screen.getByText('20 min total')).toBeInTheDocument();
    expect(screen.getByText('2 servings')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Expand recipe overview' }));
    expect(screen.getByText('Prep 15 min · Cook 5 min')).toBeInTheDocument();
    expect(screen.getByText('Preparation steps')).toBeInTheDocument();

    // Check nutrition facts
    expect(screen.getByText(/Nutrition/i)).toBeInTheDocument();
    expect(screen.getAllByText(/384/).length).toBeGreaterThan(0);
    expect(screen.getByText(/16.5/)).toBeInTheDocument();

    // Check ingredients
    expect(screen.getByText('Rau chân vịt (Bina)')).toBeInTheDocument();
    expect(screen.getByText('150 g')).toBeInTheDocument();
    expect(screen.getByText('Cà chua')).toBeInTheDocument();

    // Check steps
    expect(screen.getByText('Rửa sạch xà lách, dưa leo và cà chua.')).toBeInTheDocument();
    expect(screen.getByText('Cắt đậu phụ thành các khối vuông vừa ăn.')).toBeInTheDocument();

    // Crucial: ensure raw JSON string is NOT shown
    expect(screen.queryByText(recipeBody)).toBeNull();
  });
});
