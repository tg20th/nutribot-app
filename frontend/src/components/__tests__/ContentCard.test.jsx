import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ContentCard from '../ContentCard';

describe('ContentCard guest gating', () => {
  const post = {
    id: 5,
    type: 'blog',
    title: 'A healthy lunch idea',
    author: 'Lan',
    username: 'lan_',
    description: 'Quick and nutritious lunch',
    image: 'https://example.com/lunch.jpg',
    likes: 12,
    comments: 3,
    createdAt: '2024-01-15',
  };

  beforeEach(() => {
    localStorage.removeItem('nutribot-auth-token');
  });

  it('opens LoginRequiredModal when guest clicks the like button', async () => {
    render(<BrowserRouter><ContentCard post={post} /></BrowserRouter>);
    const likeButton = screen.getByRole('button', { name: /Like, 12 likes/i });
    expect(likeButton).toBeInTheDocument();
    fireEvent.click(likeButton);
    const modal = await screen.findByRole('dialog', { name: 'Join the conversation' });
    expect(modal).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Account' })).toBeInTheDocument();
  });

  it('opens LoginRequiredModal when guest clicks the comment button', async () => {
    render(<BrowserRouter><ContentCard post={post} /></BrowserRouter>);
    const commentButton = screen.getByRole('button', { name: /3 comments/i });
    expect(commentButton).toBeInTheDocument();
    fireEvent.click(commentButton);
    const modal = await screen.findByRole('dialog', { name: 'Join the conversation' });
    expect(modal).toBeInTheDocument();
  });

  it('does NOT change like state when guest clicks the like button', async () => {
    render(<BrowserRouter><ContentCard post={post} /></BrowserRouter>);
    const likeButton = screen.getByRole('button', { name: /Like, 12 likes/i });
    expect(likeButton).toHaveAttribute('aria-label', 'Like, 12 likes');
    fireEvent.click(likeButton);
    // Modal opens, no state change to unlike
    await screen.findByRole('dialog', { name: 'Join the conversation' });
    // Button should still show "Like" (not toggled)
    expect(screen.getByRole('button', { name: /Like, 12 likes/i })).toBeInTheDocument();
  });

  it('toggles like state when authenticated user clicks the like button', async () => {
    localStorage.setItem('nutribot-auth-token', 'valid-token');
    render(<BrowserRouter><ContentCard post={post} /></BrowserRouter>);
    const likeButton = screen.getByRole('button', { name: /Like, 12 likes/i });
    fireEvent.click(likeButton);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Unlike, 12 likes/i })).toBeInTheDocument();
    });
  });

  it('closes the LoginRequiredModal when close button is clicked', async () => {
    render(<BrowserRouter><ContentCard post={post} /></BrowserRouter>);
    fireEvent.click(screen.getByRole('button', { name: /Like, 12 likes/i }));
    const modal = await screen.findByRole('dialog', { name: 'Join the conversation' });
    expect(modal).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Join the conversation' })).not.toBeInTheDocument();
    });
  });

  it('switches to Sign In auth form when Sign In button is clicked inside modal', async () => {
    render(<BrowserRouter><ContentCard post={post} /></BrowserRouter>);
    fireEvent.click(screen.getByRole('button', { name: /Like, 12 likes/i }));
    await screen.findByRole('dialog', { name: 'Join the conversation' });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
    });
  });

  it('switches to Sign Up auth form when Create Account button is clicked inside modal', async () => {
    render(<BrowserRouter><ContentCard post={post} /></BrowserRouter>);
    fireEvent.click(screen.getByRole('button', { name: /Like, 12 likes/i }));
    await screen.findByRole('dialog', { name: 'Join the conversation' });
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /make nourishment personal/i })).toBeInTheDocument();
    });
  });
});
