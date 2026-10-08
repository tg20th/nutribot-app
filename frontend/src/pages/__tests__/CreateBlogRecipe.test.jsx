import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CreateBlogPage from '../CreateBlogPage';

vi.mock('../../services/authorBlogApi', () => ({
  calculateRecipeNutrition: vi.fn().mockResolvedValue({
    calories: 250,
    proteinG: 15,
    carbsG: 30,
    fatG: 8,
    fiberG: 5,
    sodiumMg: 350,
  }),
  createMyBlog: vi.fn(),
  createMyVideo: vi.fn(),
  getBlogCategories: vi.fn().mockResolvedValue([{ categoryId: 1, name: 'Vegan' }]),
  getMyBlog: vi.fn(),
  getMyVideo: vi.fn(),
  updateMyBlog: vi.fn(),
  updateMyVideo: vi.fn(),
  uploadBlogThumbnail: vi.fn(),
}));

vi.mock('../../services/profileApi', () => ({
  getAllergyIngredients: vi.fn().mockResolvedValue(['Đậu phụ', 'Cà rốt']),
}));

vi.mock('../../components/community/CommunityTopBar', () => ({
  default: () => <div data-testid="topbar">TopBar</div>,
}));

vi.mock('../../components/community/CommunitySideNav', () => ({
  default: () => <div data-testid="sidenav">SideNav</div>,
}));

vi.mock('../../components/chatbot/ChatbotWidget', () => ({
  default: () => null,
}));

describe('CreateBlogPage Recipe Details & Steps UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Recipe details section with English labels and Auto calculate nutrition button', async () => {
    render(
      <MemoryRouter>
        <CreateBlogPage />
      </MemoryRouter>
    );

    // Section title and toggle in English
    expect(screen.getByRole('heading', { name: /Recipe details/i })).toBeInTheDocument();
    expect(screen.getByText('Hide details')).toBeInTheDocument();

    // Button "Auto calculate nutrition"
    expect(screen.getByRole('button', { name: /Auto calculate nutrition/i })).toBeInTheDocument();

    // Ingredients section in English
    expect(screen.getAllByText(/Ingredients/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Add ingredient/i })).toBeInTheDocument();
  });

  it('renders separate groups for Time & Servings and AI Nutrition facts', async () => {
    render(
      <MemoryRouter>
        <CreateBlogPage />
      </MemoryRouter>
    );

    // Group 1: Time & Servings
    expect(screen.getByText(/Time & Servings/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Prep time/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Cook time/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Servings/i)).toBeInTheDocument();

    // Group 2: Nutrition facts
    expect(screen.getByText(/Nutrition facts/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Calories/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Protein/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Carbohydrates/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Fat/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Fiber/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Sodium/i)).toBeInTheDocument();
  });

  it('automatically adds Step 2 when pressing Enter inside Step 1 input', async () => {
    render(
      <MemoryRouter>
        <CreateBlogPage />
      </MemoryRouter>
    );

    // Initial state: Step 1 badge and 1 input
    expect(screen.getByText('Step 1')).toBeInTheDocument();
    expect(screen.queryByText('Step 2')).not.toBeInTheDocument();

    const firstStepInput = screen.getByLabelText('Step 1 description');
    fireEvent.change(firstStepInput, { target: { value: 'Sơ chế và rửa sạch nguyên liệu' } });

    // Press Enter inside Step 1 input
    fireEvent.keyDown(firstStepInput, { key: 'Enter', code: 'Enter' });

    // Step 2 badge should now exist
    await waitFor(() => {
      expect(screen.getByText('Step 2')).toBeInTheDocument();
    });

    const secondStepInput = screen.getByLabelText('Step 2 description');
    expect(secondStepInput).toBeInTheDocument();
  });

  it('allows editing post content without resetting inputs on keystroke in edit mode', async () => {
    const { getMyBlog } = await import('../../services/authorBlogApi');
    getMyBlog.mockResolvedValueOnce({
      contentId: 81,
      title: 'Original Recipe Title',
      body: 'Original story description',
      categoryId: 1,
    });

    render(
      <MemoryRouter initialEntries={['/community/my-content/blog/81/edit']}>
        <CreateBlogPage />
      </MemoryRouter>
    );

    // Wait for the original content to load into the input
    await waitFor(() => {
      expect(screen.getByDisplayValue('Original Recipe Title')).toBeInTheDocument();
    });

    const titleInput = screen.getByLabelText(/Title/i);

    // User types in a new title
    fireEvent.change(titleInput, { target: { value: 'Updated Salad Recipe' } });

    // Ensure the new typed value persists and is NOT reset back to 'Original Recipe Title'
    expect(titleInput.value).toBe('Updated Salad Recipe');

    // Simulate another keystroke/render cycle
    fireEvent.change(titleInput, { target: { value: 'Updated Salad Recipe 2026' } });
    expect(titleInput.value).toBe('Updated Salad Recipe 2026');
  });
});
