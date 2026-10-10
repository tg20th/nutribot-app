import { afterEach, beforeEach, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CommunityPostCard from '../../community/CommunityPostCard';

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
afterEach(() => { cleanup(); delete HTMLDialogElement.prototype.showModal; delete HTMLDialogElement.prototype.close; });

it('opens the full post from Comments with a footer composer and restores focus when closed', async () => {
  const post = { id: 26, title: 'A balanced lunch', description: 'Short summary', author: 'Lan', type: 'blog' };
  const interactionApi = {
    loadVote: async () => ({ voteCount: 2, isVoted: false }),
    loadComments: async () => ({ content: [], totalPages: 0, totalElements: 0 }),
    submitComment: async (_id, body) => ({ commentId: 1, userName: 'Khanh', body, replies: [] }),
  };
  render(<MemoryRouter><CommunityPostCard post={post} interactionApi={interactionApi} loadPost={async () => ({ ...post, body: 'Full article content' })}/></MemoryRouter>);
  const trigger = screen.getByRole('button', { name: 'Comments' });
  trigger.focus();
  fireEvent.click(trigger);
  const modal = screen.getByRole('dialog', { name: "Lan's post" });
  expect(await within(modal).findByText('Full article content')).toBeInTheDocument();
  const composer = within(modal).getByRole('textbox');
  expect(composer.closest('footer')).not.toBeNull();
  expect(composer).toHaveFocus();
  expect(document.body.style.overflow).toBe('hidden');
  fireEvent.change(composer, { target: { value: 'My lunch idea' } });
  fireEvent.click(within(modal).getByRole('button', { name: 'Post' }));
  expect(await within(modal).findByText('My lunch idea')).toBeInTheDocument();
  fireEvent.click(within(modal).getByRole('button', { name: 'Close post' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
  expect(document.body.style.overflow).toBe('');
  await screen.findByRole('button', { name: 'Like this post, 2 likes' });
  fireEvent.click(screen.getByRole('button', { name: 'A balanced lunch' }));
  expect(await within(screen.getByRole('dialog')).findByText('Full article content')).toBeInTheDocument();
  fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await screen.findByRole('button', { name: 'Like this post, 2 likes' });
});
