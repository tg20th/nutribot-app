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
const getContentCategories = async (signal) => {
  const categories = unwrapData(await apiRequest('/api/v1/categories?type=RECIPE', { signal }), []);
  return categories.map(mapCategory);
};
const getAllPublishedContent = async (path, signal) => {
  const firstPage = unwrapData(await apiRequest(`${path}?page=0&size=50`, { signal }), {});
  const totalPages = Math.max(1, Number(firstPage.totalPages ?? 1));
  const remainingPages = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) => apiRequest(`${path}?page=${index + 1}&size=50`, { signal })
      .then((payload) => unwrapData(payload, {}))),
  );
  return [firstPage, ...remainingPages].flatMap((page) => page.content ?? []);
};
const getCategoryContentCounts = async (signal) => {
  const [blogs, videos] = await Promise.all([
    getAllPublishedContent('/api/v1/blogs', signal),
    getAllPublishedContent('/api/v1/videos', signal),
  ]);
  return [...blogs, ...videos].reduce((counts, content) => {
    if (content.categoryId !== null && content.categoryId !== undefined) {
      counts[content.categoryId] = (counts[content.categoryId] ?? 0) + 1;
    }
    return counts;
  }, {});
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
const moderateContent = async (contentId, action, reason) => {
  if (isModerationPreview()) {
    moderationPreviewState = moderationPreviewState.map((item) => item.contentId === contentId ? { ...item, status: action.toLowerCase() } : item);
    return mapModerationItem(moderationPreviewState.find((item) => item.contentId === contentId));
  }
  const body = reason ? { action, reason } : { action };
  const payload = await apiRequest(`/api/v1/admin/moderation/${contentId}/action`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  return mapModerationItem(unwrapData(payload, {}));
};
const formatAdminDate = (value) => value ? new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
const mapViolationReason = (reason) => typeof reason === 'string' ? reason : { contentId: reason?.contentId ?? null, contentTitle: reason?.contentTitle ?? null, reason: reason?.reason ?? reason?.message ?? reason?.adminNote ?? 'Lý do đang chờ API quản lý thành viên đồng bộ.', reviewedAt: reason?.reviewedAt ?? null };
const mapAdminUser = (user) => { const violations = user.violationReasons ?? user.violations ?? []; return { id: user.userId, username: user.username, email: user.email, name: user.fullName || user.username, avatarUrl: user.avatarUrl ?? null, role: user.roleName, status: user.status, joinedAt: formatAdminDate(user.createdAt), updatedAt: formatAdminDate(user.updatedAt), strikeCount: user.strikeCount ?? 0, violationReasons: (Array.isArray(violations) ? violations : [violations]).filter(Boolean).map(mapViolationReason) }; };
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
const getAllPublicContent = async (path, signal) => {
  const first = unwrapData(await apiRequest(`${path}?page=0&size=50`, { signal }), {});
  const totalPages = Math.max(Number(first.totalPages) || 1, 1);
  const remaining = await Promise.all(Array.from(
    { length: totalPages - 1 },
    (_, index) => apiRequest(`${path}?page=${index + 1}&size=50`, { signal }).then((payload) => unwrapData(payload, {})),
  ));
  return [first, ...remaining].flatMap((page) => page.content ?? []);
};
const getMemberContentCounts = async (signal) => {
  const [blogs, videos] = await Promise.all([
    getAllPublicContent('/api/v1/blogs', signal),
    getAllPublicContent('/api/v1/videos', signal),
  ]);
  return [...blogs, ...videos].reduce((counts, content) => {
    if (content.authorId != null) counts[content.authorId] = (counts[content.authorId] ?? 0) + 1;
    return counts;
  }, {});
};
const getDashboard = async (signal) => {
  const [users, moderation, blogs, videos, categories] = await Promise.all([
    apiRequest(adminUserQuery({ page: 0, size: 1 }), { signal }).then((payload) => unwrapData(payload, {})),
    getModerationQueue({ page: 0, size: 5 }, signal),
    getAllPublicContent('/api/v1/blogs', signal),
    getAllPublicContent('/api/v1/videos', signal),
    getContentCategories(signal),
  ]);
  const content = [...blogs, ...videos];
  const categoryCounts = content.reduce((counts, item) => {
    if (item.categoryId != null) counts[item.categoryId] = (counts[item.categoryId] ?? 0) + 1;
    return counts;
  }, {});
  const uncategorizedContent = content.filter((item) => item.categoryId == null).length;
  const categoryData = categories.map((category) => ({ ...category, contentCount: categoryCounts[category.id] ?? 0 }));
  if (uncategorizedContent > 0) {
    categoryData.push({ id: 'uncategorized', name: 'Uncategorized', type: 'CONTENT', contentCount: uncategorizedContent, active: true, isUncategorized: true });
  }
  return {
    metrics: { totalUsers: Number(users.totalElements ?? 0), publishedContent: content.length, pendingModeration: Number(moderation.totalElements ?? 0) },
    moderationQueue: moderation.content ?? [],
    categories: categoryData,
    content,
  };
};
export const adminApi = {
  getDashboard,
  getUsers: (params, signal) => apiRequest(adminUserQuery(params), { signal }).then((payload) => mapAdminUserPage(unwrapData(payload, {}))), getMemberContentCounts, getUserById: one('/api/admin/users'), updateUserStatus: (id, value) => apiRequest(`/api/v1/admin/users/${id}/status`, { method: 'PUT', body: JSON.stringify({ status: value }) }).then((payload) => mapAdminUser(unwrapData(payload, {}))), lockUser: (id) => apiRequest(`/api/v1/admin/users/${id}/status`, { method: 'PUT', body: JSON.stringify({ status: 'BANNED' }) }),
  getModerationQueue, moderateContent,
  getCategories, getCategoryContentCounts, createCategory, updateCategory, deleteCategory,
  getBlogs: list('/api/admin/blogs'), getBlogById: one('/api/admin/blogs'), hideBlog: (id) => status('/api/admin/blogs')(id, 'Hidden'), deleteBlog: (id) => apiRequest(`/api/admin/blogs/${id}`, { method: 'DELETE' }),
  getVideos: list('/api/admin/videos'), getVideoById: one('/api/admin/videos'), hideVideo: (id) => status('/api/admin/videos')(id, 'Hidden'), deleteVideo: (id) => apiRequest(`/api/admin/videos/${id}`, { method: 'DELETE' }),
  getComments: list('/api/admin/comments'), deleteComment: (id) => apiRequest(`/api/admin/comments/${id}`, { method: 'DELETE' })
};
