import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  calculateDistance,
  CURATED_RESTAURANTS,
  normalizeRestaurant,
  searchNearbyRestaurants,
  getUserCurrentPosition
} from '../restaurantApi';

describe('restaurantApi service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('calculates Haversine distance correctly in kilometers', () => {
    // Distance between Ben Thanh Market (10.7721, 106.6983) and Notre-Dame Cathedral (10.7798, 106.6990) ~ 0.9 km
    const dist = calculateDistance(10.7721, 106.6983, 10.7798, 106.699);
    expect(dist).toBeGreaterThan(0.7);
    expect(dist).toBeLessThan(1.2);
  });

  it('returns null distance if any coordinate is missing', () => {
    expect(calculateDistance(null, 106.7, 10.8, 106.8)).toBeNull();
    expect(calculateDistance(10.7, null, 10.8, 106.8)).toBeNull();
  });

  it('normalizes restaurant data with canonical properties', () => {
    const raw = {
      place_id: 'sample-123',
      name: 'Quán Chay An Nhiên',
      formatted_address: '123 Cách Mạng Tháng 8, Q3, TP.HCM',
      geometry: { location: { lat: 10.775, lng: 106.685 } }
    };
    const normalized = normalizeRestaurant(raw);
    expect(normalized.id).toBe('sample-123');
    expect(normalized.name).toBe('Quán Chay An Nhiên');
    expect(normalized.lat).toBe(10.775);
    expect(normalized.lng).toBe(106.685);
    expect(normalized.googleMapUrl).toContain('google.com/maps');
  });

  it('searches nearby restaurants and merges with curated records sorted by distance', async () => {
    const mockTrackAsiaResponse = {
      status: 'OK',
      results: [
        {
          place_id: 'test-poi-1',
          name: 'TrackAsia Vegan Test',
          formatted_address: 'District 1, HCMC',
          geometry: { location: { lat: 10.778, lng: 106.695 } }
        }
      ]
    };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockTrackAsiaResponse
      })
    );

    const results = await searchNearbyRestaurants({
      lat: 10.7769,
      lng: 106.7009,
      radiusKm: 5
    });

    expect(results.length).toBeGreaterThan(0);
    // Nearest should be first
    if (results.length > 1 && results[0].distanceKm != null && results[1].distanceKm != null) {
      expect(results[0].distanceKm).toBeLessThanOrEqual(results[1].distanceKm);
    }
  });

  it('falls back to curated healthy places if TrackAsia API throws network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network offline')));

    const results = await searchNearbyRestaurants({
      lat: 10.7769,
      lng: 106.7009,
      radiusKm: 10
    });

    expect(results.length).toBe(CURATED_RESTAURANTS.length);
    expect(results[0].name).toBeDefined();
  });

  it('rejects with user-friendly error when geolocation permission is denied', async () => {
    const mockGeolocation = {
      getCurrentPosition: vi.fn((success, error) => {
        error({ code: 1, message: 'User denied Geolocation' });
      })
    };
    vi.stubGlobal('navigator', { geolocation: mockGeolocation });

    await expect(getUserCurrentPosition()).rejects.toThrow('Bạn đã từ chối cấp quyền truy cập vị trí');
  });
});
