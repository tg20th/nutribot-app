import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CommunityRightRail from '../CommunityRightRail';
import { getCommunityHighlights } from '../../../services/communityApi';

vi.mock('../../../services/communityApi', () => ({
  getCommunityHighlights: vi.fn()
}));

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('CommunityRightRail', () => {
  it('renders ranked content metadata and routes post clicks through the feed handler', async () => {
    getCommunityHighlights.mockResolvedValue([{ id: 7, type: 'video', title: 'A bright lunch', authorId: 11, author: 'Mai', image: 'https://img.test/lunch.jpg', likes: 6, comments: 3 }]);
    const onOpenPost = vi.fn();

    render(<MemoryRouter><CommunityRightRail onOpenPost={onOpenPost}/></MemoryRouter>);

    expect(await screen.findByText('A bright lunch')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open A bright lunch' }));
    expect(onOpenPost).toHaveBeenCalledWith(7);
    expect(screen.getByRole('link', { name: 'Explore Community' })).toHaveAttribute('href', '/home');
  });

  it('shows an inline retry action when highlights fail', async () => {
    getCommunityHighlights.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([]);
    render(<MemoryRouter><CommunityRightRail/></MemoryRouter>);

    expect(await screen.findByText('Highlights are unavailable right now.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    await waitFor(() => expect(screen.getByText('No public stories to highlight yet.')).toBeInTheDocument());
    expect(getCommunityHighlights).toHaveBeenCalledTimes(2);
  });
});
