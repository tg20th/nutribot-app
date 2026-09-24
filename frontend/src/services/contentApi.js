import { apiRequest, unwrapData } from './apiClient';
import { normalizeCollection, normalizeContent } from '../utils/content';
const collection = async (path, type, signal) => normalizeCollection(unwrapData(await apiRequest(path, { signal })), type);
export const getBlogs = (signal) => collection('/api/blogs', 'Article', signal);
export const getVideos = (signal) => collection('/api/videos', 'Video', signal);
export const getFeaturedContent = async (signal) => normalizeContent(unwrapData(await apiRequest('/api/content/featured', { signal }), {}), 'Recipe');
export const getTopics = async (signal) => unwrapData(await apiRequest('/api/categories', { signal })).map((item) => ({ name: item.name ?? item.title, image: item.image ?? item.imageUrl ?? null }));
export const googleAuthUrl = () => `${(import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')}/api/auth/google`;
