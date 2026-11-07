






























































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

  it('requires a selected rejection reason and sends the mapped text', async () => {
    render(<AdminModerationPage />);
    fireEvent.click(await screen.findByRole('button', { name: /Reject/ }));
    const confirm = screen.getByRole('button', { name: 'Reject content' });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByRole('combobox', { name: 'Reason for rejection *' }), { target: { value: 'MISLEADING_INFORMATION' } });
    fireEvent.click(confirm);
    await waitFor(() => expect(adminApi.moderateContent).toHaveBeenCalledWith(1, 'REJECT', 'Misleading or inaccurate information'));
  });

  it('shows the custom reason only for Other reason and trims it on submit', async () => {
    render(<AdminModerationPage />);
    fireEvent.click(await screen.findByRole('button', { name: /Reject/ }));
    const select = screen.getByRole('combobox', { name: 'Reason for rejection *' });
    expect(screen.queryByRole('textbox', { name: 'Custom reason *' })).toBeNull();
    fireEvent.change(select, { target: { value: 'OTHER' } });
    const customReason = screen.getByRole('textbox', { name: /Custom reason \*/ });
    const confirm = screen.getByRole('button', { name: 'Reject content' });
    expect(confirm).toBeDisabled();
    fireEvent.change(customReason, { target: { value: '  Needs a clearer source  ' } });
    fireEvent.click(confirm);
    await waitFor(() => expect(adminApi.moderateContent).toHaveBeenCalledWith(1, 'REJECT', 'Needs a clearer source'));
  });

  it('allows approval without a reason', async () => {
    render(<AdminModerationPage />);
    fireEvent.click(await screen.findByRole('button', { name: /Approve/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Approval' }));
    await waitFor(() => expect(adminApi.moderateContent).toHaveBeenCalledWith(1, 'APPROVE', ''));
  });

  it('renders AI moderation evaluation and confidence when available', async () => {
    render(<AdminModerationPage />);
    expect(await screen.findByRole('heading', { name: 'AI Review' })).toBeTruthy();
    expect(screen.getByText(/Confidence: 91%/)).toBeTruthy();
  });

  it('renders a YouTube player for a VIDEO submission instead of its thumbnail', async () => {
    adminApi.getModerationQueue.mockResolvedValueOnce({
      content: [{ ...second, mediaUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', thumbnailUrl: 'https://cdn.example.test/video-thumb.jpg' }],
      totalElements: 1,
      totalPages: 1,
    });

    render(<AdminModerationPage />);

    expect(await screen.findByTitle('Play Prep fresh produce')).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0');
    expect(screen.getByRole('link', { name: 'Open original video' })).toHaveAttribute('href', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(screen.queryByRole('button', { name: 'Open cover image' })).toBeNull();
  });

  it('renders uploaded video URLs with native controls and handles missing URLs', async () => {
    adminApi.getModerationQueue.mockResolvedValueOnce({
      content: [{ ...second, mediaUrl: 'https://cdn.example.test/submission.mp4' }],
      totalElements: 1,
      totalPages: 1,
    });

    const { unmount } = render(<AdminModerationPage />);
    await waitFor(() => expect(document.querySelector('video')).toBeTruthy());
    expect(document.querySelector('video')).toHaveAttribute('src', 'https://cdn.example.test/submission.mp4');
    expect(document.querySelector('video')).toHaveAttribute('controls');
    unmount();

    adminApi.getModerationQueue.mockResolvedValueOnce({ content: [second], totalElements: 1, totalPages: 1 });
    render(<AdminModerationPage />);
    expect(await screen.findByText('No video URL is available for this submission.')).toBeInTheDocument();
  });

  it('opens submitted images in an accessible lightbox and closes with Escape', async () => {
    adminApi.getModerationQueue.mockResolvedValueOnce({
      content: [{ ...first, thumbnailUrl: 'https://cdn.example.test/cover.jpg', body: '<p>Story</p><img src="https://cdn.example.test/inline.jpg" />' }],
      totalElements: 1,
      totalPages: 1,
    });

    render(<AdminModerationPage />);
    const coverBtn = await screen.findByRole('button', { name: 'Open cover image' });
    await waitFor(() => expect(screen.getByRole('button', { name: /Healthy lunch ideas/i })).toHaveAttribute('aria-pressed', 'true'));
    fireEvent.click(coverBtn);
    expect(await screen.findByRole('dialog', { name: 'Image inspection' })).toBeInTheDocument();
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
    await waitFor(() => {
      expect(screen.getByText('Prep 15 min · Cook 5 min')).toBeInTheDocument();
    });
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

  it('renders duplicate warning banner and opens side-by-side diff modal for suspected duplicates (NB-97)', async () => {
    adminApi.getModerationQueue.mockResolvedValueOnce({
      content: [
        {
          id: 88,
          type: 'BLOG',
          title: 'Cách làm phở nấm chay siêu ngon',
          author: 'newbie_cook',
          submittedAt: '2026-11-07T08:00:00Z',
          body: 'Nấu nước dùng ngọt từ củ cải và mía lau. Thêm nấm hương thơm lừng.',
          status: 'pending',
          moderationFlag: 'SUSPECTED_DUPLICATE',
          similarityScore: 0.87,
          matchedContentId: 12,
          matchedTitle: 'Bí quyết phở nấm chay truyền thống',
          matchedAuthor: 'chef_truong',
          matchedPublishedAt: '2026-10-15T10:00:00Z',
          matchedBody: 'Nấu nước dùng ngọt từ củ cải và mía lau. Thêm nấm hương thơm lừng.',
        },
      ],
      totalElements: 1,
      totalPages: 1,
    });

    render(<AdminModerationPage />);

    // Kiểm tra hiển thị banner cảnh báo gần trùng lặp
    expect(await screen.findByText('Cảnh báo nội dung gần trùng lặp')).toBeInTheDocument();
    expect(screen.getByText('87% Tương đồng')).toBeInTheDocument();
    expect(screen.getByText(/Bí quyết phở nấm chay truyền thống/)).toBeInTheDocument();

    // Bấm nút mở Modal So sánh trực diện
    const diffButton = screen.getByRole('button', { name: /So sánh trực diện/i });
    expect(diffButton).toBeInTheDocument();
    fireEvent.click(diffButton);

    // Modal hiển thị hai cột đối chiếu
    expect(await screen.findByRole('dialog', { name: /So sánh trực diện bài viết nghi ngờ sao chép/i })).toBeInTheDocument();
    expect(screen.getByText('BÀI GỐC ĐÃ XUẤT BẢN (#12)')).toBeInTheDocument();
    expect(screen.getByText('BÀI MỚI NỘP DUYỆT (#88)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Từ chối vì sao chép/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Bỏ qua & Duyệt bài/i })).toBeInTheDocument();

    // Bấm Đóng modal
    fireEvent.click(screen.getByRole('button', { name: 'Đóng cửa sổ' }));
    expect(screen.queryByRole('dialog', { name: /So sánh trực diện bài viết nghi ngờ sao chép/i })).toBeNull();
  });
});
