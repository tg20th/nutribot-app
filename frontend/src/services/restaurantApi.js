import { apiRequest, unwrapData } from './apiClient';

const normalizeRestaurant = (item = {}) => ({
  ...item,
  id: item.id ?? item.restaurantId,
  image: item.image ?? item.imageUrl ?? null,
  rating: item.rating ?? item.averageRating ?? null,
  meta: item.meta ?? [item.address, item.distanceKm != null ? `${item.distanceKm} km` : ''].filter(Boolean).join(' · '),
  hashtags: item.hashtags ?? item.tags ?? []
});

export const getRestaurants = async (signal) => {
  const data = unwrapData(await apiRequest('/api/v1/restaurants', { signal }));
  const items = Array.isArray(data) ? data : data?.content ?? [];
  return items.map(normalizeRestaurant);
};
