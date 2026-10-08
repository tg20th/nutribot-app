import { apiRequest, unwrapData } from './apiClient';
import moderationBowl from '../assets/hero-bowl.jpg';
import moderationPlate from '../assets/colorful-plate.jpg';
import moderationProduce from '../assets/fresh-produce.jpg';
const list = (path) => async (signal) => unwrapData(await apiRequest(path, { signal }));
const one = (path) => async (id, signal) => unwrapData(await apiRequest(`${path}/${id}`, { signal }), {});
const status = (path) => (id, value) => apiRequest(`${path}/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: value }) }).then((payload) => unwrapData(payload, {}));
const categorySlug = (name = '') => {
  const slug = name.trim().toLowerCase().replace(/\u0111/g, 'd').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return slug || `category-${Date.now()}`;
};
const mapCategory = (category) => ({
  id: category.categoryId,
  name: category.categoryName,
  slug: category.slug,
  type: category.categoryType === 'INGREDIENT' ? 'FOOD_TYPE' : 'RECIPE_TYPE',
  description: category.description ?? '',
  count: category.contentCount ?? 0,
  active: category.active,
});
const getCategories = async (signal) => {
  const categories = unwrapData(await apiRequest('/api/v1/categories', { signal }), []);
  return categories.map(mapCategory);
};
const toCategoryRequest = (data) => ({
  categoryName: data.name.trim(),
  slug: categorySlug(data.name),
  description: data.description?.trim() || null,
  categoryType: data.type === 'FOOD_TYPE' ? 'INGREDIENT' : 'RECIPE',
});
const createCategory = async (data) => {
  const payload = await apiRequest('/api/v1/categories', {
    method: 'POST',
    body: JSON.stringify(toCategoryRequest(data)),
  });
  return mapCategory(unwrapData(payload, {}));
};
const updateCategory = async (id, data) => {
  const payload = await apiRequest(`/api/v1/categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ ...toCategoryRequest(data), active: data.active ?? true }),
  });
  return mapCategory(unwrapData(payload, {}));
};
const deleteCategory = (id) => apiRequest(`/api/v1/categories/${id}`, { method: 'DELETE' });
const mapModerationItem = (item) => ({
  id: item.contentId,
  type: item.contentType,
  title: item.title,
  slug: item.slug,
  status: item.status,
  author: item.authorUsername || item.authorEmail || 'Unknown author',
  authorEmail: item.authorEmail,
  submittedAt: item.createdAt,
  updatedAt: item.updatedAt,
  viewCount: item.viewCount ?? 0,
  body: item.body,
  thumbnailUrl: item.thumbnailUrl,
  aiFlagged: item.aiFlagged,
  aiReason: item.aiReason,
  aiConfidence: item.aiConfidence,
});
const moderationPreviewItems = [
  { contentId: 201, contentType: 'BLOG', title: 'A colorful bowl for busy mornings', slug: 'colorful-bowl-mornings', status: 'pending', authorUsername: 'minhanh', authorEmail: 'minhanh@example.com', createdAt: '2026-09-26T08:30:00', viewCount: 0, body: 'Fresh fruit, yogurt, and oats make a bright start to the day.', thumbnailUrl: moderationBowl, aiFlagged: true, aiReason: 'Nội dung và hình ảnh an toàn, được kiểm duyệt tự động', aiConfidence: 0.95 },
  { contentId: 202, contentType: 'VIDEO', title: 'Prep fresh produce for the week', slug: 'prep-fresh-produce', status: 'pending', authorUsername: 'nutribot', authorEmail: 'team@nutribot.app', createdAt: '2026-09-25T10:15:00', viewCount: 0, body: 'A quick kitchen routine for colorful weekday meals.', thumbnailUrl: moderationProduce, aiFlagged: true, aiReason: 'Cần kiểm tra thủ công nguyên liệu gia vị', aiConfidence: 0.82 },
  { contentId: 203, contentType: 'BLOG', title: 'Simple greens for lunch', slug: 'simple-greens-lunch', status: 'pending', authorUsername: 'lan', authorEmail: 'lan@example.com', createdAt: '2026-09-24T14:00:00', viewCount: 0, body: 'A balanced lunch with vegetables, grains, and a little crunch.', thumbnailUrl: moderationPlate, aiFlagged: false, aiReason: 'Món ăn hoàn toàn tuân thủ chế độ chay', aiConfidence: 0.99 },
];
let moderationPreviewState = [...moderationPreviewItems];
const isModerationPreview = () => import.meta.env.DEV && typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).get('preview') === '1';
const moderationParams = ({ contentType = '', page = 0, size = 10 } = {}) => {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (contentType) params.set('contentType', contentType);
  return params.toString();
};
const getModerationQueue = async (params = {}, signal) => {
  if (isModerationPreview()) {
    const content = moderationPreviewState.filter((item) => item.status === 'pending' && (!params.contentType || item.contentType === params.contentType));
    return { content: content.map(mapModerationItem), page: 0, size: content.length, totalElements: content.length, totalPages: content.length ? 1 : 0 };
  }
  const payload = await apiRequest(`/api/v1/admin/moderation?${moderationParams(params)}`, { signal });
  const result = unwrapData(payload, {});
  return { ...result, content: (result.content ?? []).map(mapModerationItem) };
};
const moderateContent = async (contentId, action) => {
  if (isModerationPreview()) {
    moderationPreviewState = moderationPreviewState.map((item) => item.contentId === contentId ? { ...item, status: action.toLowerCase() } : item);
    return mapModerationItem(moderationPreviewState.find((item) => item.contentId === contentId));
  }
  const payload = await apiRequest(`/api/v1/admin/moderation/${contentId}/action`, {
    method: 'PUT',
    body: JSON.stringify({ action }),
  });
  return mapModerationItem(unwrapData(payload, {}));
};
const mapAdminUser = (user) => ({ id: user.userId, username: user.username, email: user.email, name: user.fullName || user.username, role: user.roleName, status: user.status, joinedAt: user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '', strikeCount: user.strikeCount });
const mapAdminUserPage = (page) => ({ ...page, content: (page.content ?? []).map(mapAdminUser) });
const adminUserQuery = ({ keyword = '', status = '', page = 0, size = 10 } = {}) => {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (keyword.trim()) params.set('keyword', keyword.trim());
  if (status) params.set('status', status);
  return `/api/v1/admin/users?${params}`;
};
const publicContentTotal = async (path, signal) => {
  const page = unwrapData(await apiRequest(path + '?page=0&size=1', { signal }), {});
  return Number(page.totalElements ?? 0);
};
const getDashboard = async (_range, signal) => {
  const [users, moderation, blogs, videos, categories] = await Promise.all([
    apiRequest(adminUserQuery({ page: 0, size: 1 }), { signal }).then((payload) => unwrapData(payload, {})),
    getModerationQueue({ page: 0, size: 1 }, signal),
    publicContentTotal('/api/v1/blogs', signal),
    publicContentTotal('/api/v1/videos', signal),
    getCategories(signal),
  ]);
  return {
    metrics: { totalUsers: Number(users.totalElements ?? 0), publishedContent: blogs + videos, pendingModeration: Number(moderation.totalElements ?? 0) },
    popularCategories: categories.slice(0, 5).map((category, index) => ({ rank: index + 1, name: category.name, description: category.description || 'Nội dung dinh dưỡng', posts: Number(category.count ?? 0), growth: category.active ? 'Đang hoạt động' : 'Đã ẩn' })),
    moderationFeed: [], weeklyContent: [], health: { status: 'Live data', version: 'API v1' },
  };
};
export const adminApi = {
  getDashboard,
  getUsers: (params, signal) => apiRequest(adminUserQuery(params), { signal }).then((payload) => mapAdminUserPage(unwrapData(payload, {}))), getUserById: one('/api/admin/users'), updateUserStatus: (id, value) => apiRequest(`/api/v1/admin/users/${id}/status`, { method: 'PUT', body: JSON.stringify({ status: value }) }).then((payload) => mapAdminUser(unwrapData(payload, {}))), lockUser: (id) => apiRequest(`/api/v1/admin/users/${id}/status`, { method: 'PUT', body: JSON.stringify({ status: 'BANNED' }) }),
  getModerationQueue, moderateContent,
  getCategories, createCategory, updateCategory, deleteCategory,
  getBlogs: list('/api/admin/blogs'), getBlogById: one('/api/admin/blogs'), hideBlog: (id) => status('/api/admin/blogs')(id, 'Hidden'), deleteBlog: (id) => apiRequest(`/api/admin/blogs/${id}`, { method: 'DELETE' }),
  getVideos: list('/api/admin/videos'), getVideoById: one('/api/admin/videos'), hideVideo: (id) => status('/api/admin/videos')(id, 'Hidden'), deleteVideo: (id) => apiRequest(`/api/admin/videos/${id}`, { method: 'DELETE' }),
  getComments: list('/api/admin/comments'), deleteComment: (id) => apiRequest(`/api/admin/comments/${id}`, { method: 'DELETE' })
};
