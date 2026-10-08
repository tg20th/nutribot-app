import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import CommunityPostCard from '../CommunityPostCard';
import { normalizePost } from '../../../services/communityApi';

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => { delete Element.prototype.scrollIntoView; });

it('renders Snack chay story before media when the API provides a caption', () => {
  const post = normalizePost({
    contentId: 125,
    contentType: 'BLOG',
    title: 'Snack chay',
    caption: 'snack chay ngon ngon',
    thumbnailUrl: '/snack.jpg'
  }, 'BLOG');
  render(<CommunityPostCard post={post} interactionApi={{ loadVote: async () => ({ voteCount: 0, isVoted: false }) }} />);

  const title = screen.getByRole('button', { name: 'Snack chay' });
  const caption = screen.getByText('snack chay ngon ngon');
  const media = screen.getByRole('button', { name: 'Open Snack chay' });
  expect(title.compareDocumentPosition(caption) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(caption.compareDocumentPosition(media) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.queryByText('Featured pantry items')).not.toBeInTheDocument();
  expect(screen.queryByText('View full post')).not.toBeInTheDocument();
});

it('opens the existing detail dialog and scrolls to the full caption from See more', async () => {
  const caption = 'Một câu chuyện dài về bữa ăn chay. '.repeat(14);
  render(<MemoryRouter><CommunityPostCard
    fullPageDetail
    post={{ id: 125, title: 'Snack chay', caption, image: '/snack.jpg', type: 'blog' }}
    loadPost={async () => ({ id: 125, title: 'Snack chay', body: caption, type: 'blog' })}
    interactionApi={{ loadVote: async () => ({ voteCount: 0, isVoted: false }) }}
  /></MemoryRouter>);

  fireEvent.click(screen.getByRole('button', { name: 'See more' }));
  await screen.findByRole('dialog');
  await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalled());
});
