import { apiRequest, unwrapData } from './apiClient';
import { normalizeCollection } from '../utils/content';

const itemsFrom = (payload) => {
  const data = unwrapData(payload);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.content)) return data.content;
  return [];
};

const collection = async (path, type, signal) => normalizeCollection(itemsFrom(await apiRequest(path, { signal })), type);

export const getBlogs = (signal) => collection('/api/v1/blogs?page=0&size=4', 'Article', signal);
export const getVideos = (signal) => collection('/api/v1/videos?page=0&size=4', 'Video', signal);
export const getTopics = async (signal) => itemsFrom(await apiRequest('/api/v1/categories?type=RECIPE', { signal }))
  .map((item) => ({ name: item.name ?? item.categoryName ?? item.title, image: item.image ?? item.imageUrl ?? item.iconUrl ?? item.icon_url ?? null }));
export const googleAuthUrl = () => `${(import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')}/api/v1/auth/google`;
