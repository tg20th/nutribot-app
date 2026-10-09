import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render as renderView, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CommunityPostCard from '../../community/CommunityPostCard';
vi.mock('../../community/RestaurantRecommendations', () => ({ default: () => <section>Restaurant recommendations</section> }));
const render = (view) => renderView(<MemoryRouter>{view}</MemoryRouter>);

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); delete Element.prototype.scrollIntoView; });

const interactionApi = {
  loadVote: async () => ({ voteCount: 2, isVoted: false }),
  loadComments: async () => ({ content: [], totalPages: 0, totalElements: 0 }),
};

it.each(['blog', 'video'])('opens %s at the top, opens comments at the bottom, and returns focus to its card', async (type) => {
  const post = { id: 16, title: 'Balanced lunch', type, author: 'Khanh' };
  render(<CommunityPostCard fullPageDetail post={post} interactionApi={interactionApi} loadPost={async () => ({ ...post, body: 'Full story', videoUrl: type === 'video' ? '/sample.mp4' : null })}/>);
  fireEvent.click(screen.getByRole('button', { name: post.title }));
  const dialog = screen.getByRole('dialog');
  expect(await within(dialog).findByText('Full story')).toBeInTheDocument();
  expect(dialog.scrollTop).toBe(0);
  expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  if (type === 'video') expect(dialog.querySelector('video')).toHaveAttribute('controls');
  fireEvent.click(within(dialog).getByRole('button', { name: `Back to ${type}` }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  const trigger = screen.getByRole('button', { name: 'Comments' });
  trigger.focus();
  fireEvent.click(trigger);
  expect(await within(screen.getByRole('dialog')).findByText('Full story')).toBeInTheDocument();
  await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalled());
  expect(screen.getAllByRole('region', { name: 'Comments' })[0]).toHaveFocus();
  fireEvent.click(screen.getByRole('button', { name: `Back to ${type}` }));
  expect(trigger).toHaveFocus();
  expect(document.body.style.overflow).toBe('');
});

it('shows a retryable error without presenting partial content as the full story', async () => {
  const loadPost = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ id: 16, title: 'Lunch', body: 'Full story' });
  render(<CommunityPostCard fullPageDetail post={{ id: 16, title: 'Lunch' }} interactionApi={interactionApi} loadPost={loadPost}/>);
  fireEvent.click(screen.getByRole('button', { name: 'Lunch' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load');
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByText('Full story')).toBeInTheDocument();
});

it('closes detail dialog on popstate (browser back) so user stays on feed', async () => {
  const post = { id: 18, title: 'Dinner plan', type: 'blog', author: 'Truong' };
  render(<CommunityPostCard fullPageDetail post={post} interactionApi={interactionApi} loadPost={async () => ({ ...post, body: 'Dinner story' })}/>);
  fireEvent.click(screen.getByRole('button', { name: 'Dinner plan' }));
  expect(await screen.findByRole('dialog')).toBeInTheDocument();
  expect(await screen.findByText('Dinner story')).toBeInTheDocument();

  // Simulate user pressing browser back button
  fireEvent(window, new PopStateEvent('popstate', { state: null }));

  await waitFor(() => {
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

it('reopens detail dialog when user clicks the post again after closing', async () => {
  const post = { id: 19, title: 'Breakfast idea', type: 'blog', author: 'Truong' };
  render(<CommunityPostCard fullPageDetail post={post} interactionApi={interactionApi} loadPost={async () => ({ ...post, body: 'Breakfast story' })}/>);

  // First click: opens
  fireEvent.click(screen.getByRole('button', { name: 'Breakfast idea' }));
  expect(await screen.findByRole('dialog')).toBeInTheDocument();
  expect(await screen.findByText('Breakfast story')).toBeInTheDocument();

  // Close via back button
  fireEvent.click(screen.getByRole('button', { name: 'Back to blog' }));
  await waitFor(() => {
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  // Second click on the same post: must reopen successfully and stay open!
  fireEvent.click(screen.getByRole('button', { name: 'Breakfast idea' }));
  expect(await screen.findByRole('dialog')).toBeInTheDocument();
  expect(await screen.findByText('Breakfast story')).toBeInTheDocument();
});
