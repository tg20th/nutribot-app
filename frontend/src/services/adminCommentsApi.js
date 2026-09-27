import { apiRequest, unwrapData } from './apiClient';

const previewMode = () => import.meta.env.DEV && typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).get('preview') === '1';

let previewComments = [
  { commentId: 901, contentId: 18, contentTitle: 'Bữa trưa lành mạnh cho ngày bận rộn', contentType: 'BLOG', userId: 21, username: 'minhanh', userEmail: 'minhanh@example.com', parentId: null, body: 'Bài viết có thông tin nguyên liệu chưa chính xác. Nhờ quản trị viên kiểm tra lại trước khi mọi người làm theo.', status: 'published', createdAt: '2026-09-27T09:20:00' },
  { commentId: 902, contentId: 24, contentTitle: 'Cách chuẩn bị rau củ cho cả tuần', contentType: 'VIDEO', userId: 32, username: 'thuytrang', userEmail: 'trang@example.com', parentId: null, body: 'Video này rất hữu ích, nhưng phần bảo quản rau lá nên bổ sung thời gian sử dụng an toàn.', status: 'hidden', createdAt: '2026-09-27T08:45:00' },
  { commentId: 903, contentId: 19, contentTitle: 'Thực đơn chay đủ đạm', contentType: 'BLOG', userId: 44, username: 'quanghuy', userEmail: 'huy@example.com', parentId: 894, body: 'Mình đồng ý với bạn. Nên ghi rõ lượng đạm trong mỗi khẩu phần để dễ theo dõi hơn.', status: 'published', createdAt: '2026-09-26T17:15:00' },
  { commentId: 904, contentId: 27, contentTitle: 'Sinh tố xanh buổi sáng', contentType: 'VIDEO', userId: 51, username: 'lananh', userEmail: 'lan@example.com', parentId: null, body: 'Nội dung này không phù hợp với người dị ứng đậu phộng. Mong có cảnh báo rõ hơn trong phần mô tả.', status: 'rejected', createdAt: '2026-09-26T14:08:00' },
  { commentId: 905, contentId: 18, contentTitle: 'Bữa trưa lành mạnh cho ngày bận rộn', contentType: 'BLOG', userId: 63, username: 'hoangnam', userEmail: 'nam@example.com', parentId: null, body: 'Mình đã thử công thức này. Phần cơm gạo lứt có thể giảm một chút nếu ăn vào buổi tối.', status: 'published', createdAt: '2026-09-25T11:32:00' },
  { commentId: 906, contentId: 31, contentTitle: 'Salad giàu chất xơ', contentType: 'BLOG', userId: 72, username: 'phuonglinh', userEmail: 'linh@example.com', parentId: null, body: 'Cảm ơn tác giả. Mình muốn biết thêm lựa chọn sốt salad ít đường cho người ăn kiêng.', status: 'published', createdAt: '2026-09-25T09:10:00' },
];

export const adminCommentsApi = {
  async list({ page = 0, size = 10 } = {}, signal) {
    if (previewMode()) {
      const start = page * size;
      return { content: previewComments.slice(start, start + size), page, size,
        totalElements: previewComments.length, totalPages: Math.ceil(previewComments.length / size) };
    }
    const params = new URLSearchParams({ page: String(page), size: String(size) });
    const payload = await apiRequest(`/api/v1/admin/comments?${params}`, { signal });
    return unwrapData(payload, {});
  },
  remove(commentId) {
    if (previewMode()) {
      previewComments = previewComments.filter((comment) => comment.commentId !== commentId);
      return Promise.resolve({ success: true, data: null });
    }
    return apiRequest(`/api/v1/admin/comments/${commentId}`, { method: 'DELETE' });
  },
};
