import { apiRequest, unwrapData } from './apiClient';

const reviewMode = () => import.meta.env.DEV && typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).get('preview') === '1';

export function blogHref(blog) {
  const path = blog.slug ? `/blogs/${encodeURIComponent(blog.slug)}` : `/blogs/id/${blog.contentId ?? blog.id}`;
  return reviewMode() ? `${path}?preview=1` : path;
}

export async function getPublishedBlogs(page = 0, size = 9, signal) {
  if (reviewMode()) return (await import('./publicBlogReviewData')).reviewBlogPage(page, size);
  const data = unwrapData(await apiRequest(`/api/v1/blogs?page=${page}&size=${size}`, { signal }), {});
  if (!Array.isArray(data.content)) throw new Error('Invalid blog list response');
  return {
    content: data.content,
    currentPage: Number(data.currentPage) || 0,
    totalPages: Number(data.totalPages) || 0,
    totalElements: Number(data.totalElements) || 0,
  };
}

export async function getPublishedBlog(identifier, { byId = false, signal } = {}) {
  if (reviewMode()) {
    const { reviewBlogs } = await import('./publicBlogReviewData');
    const blog = reviewBlogs.find((item) => byId ? String(item.contentId) === String(identifier) : item.slug === identifier);
    if (!blog) { const error = new Error('This story is not available.'); error.status = 404; throw error; }
    return blog;
  }
  const path = byId ? `/api/v1/blogs/id/${encodeURIComponent(identifier)}` : `/api/v1/blogs/${encodeURIComponent(identifier)}`;
  const data = unwrapData(await apiRequest(path, { signal }), {});
  if (data.contentId == null || !data.title) throw new Error('Invalid blog detail response');
  return data;
}
