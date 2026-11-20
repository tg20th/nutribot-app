import { useEffect, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ArrowUpRight, MapPin, Utensils } from 'lucide-react';
import {
  searchNearbyRestaurants,
  CURATED_RESTAURANTS,
  normalizeRestaurant,
  getUserCurrentPosition,
  calculateDistance
} from '../../services/restaurantApi';
import '../../styles/restaurant-recommendations.css';

const filterValidRestaurants = (list) => {
  if (!Array.isArray(list)) return [];
  const excludedKeywords = [
    'lập trình', 'tin học', 'phần mềm', 'công nghệ', 'bất động sản',
    'bảo hiểm', 'sửa chữa', 'garage', 'khách sạn', 'hotel', 'spa',
    'tiệm vàng', 'tiệm thuốc', 'bệnh viện', 'phòng khám', 'trường học', 'lớp học',
    'thịt', 'sườn', 'bò né', 'bún bò', 'phở bò', 'cơm tấm sườn', 'heo quay',
    'chả cá', 'gà rán', 'hải sản', 'ốc', 'vịt', 'dê', 'bbq', 'nhậu', 'quán nhậu', 'bia'
  ];
  const vegetarianKeywords = [
    'chay', 'vegan', 'vegetarian', 'thực dưỡng', 'plant-based', 'macrobiotic'
  ];

  return list.filter((item) => {
    if (!item || !item.name) return false;
    const nameLower = item.name.toLowerCase();
    const addrLower = (item.address || '').toLowerCase();
    const catLower = (item.category || '').toLowerCase();
    const tagsLower = Array.isArray(item.tags) ? item.tags.join(' ').toLowerCase() : '';
    const fullText = `${nameLower} ${addrLower} ${catLower} ${tagsLower}`;

    if (excludedKeywords.some((kw) => fullText.includes(kw))) {
      return false;
    }
    return vegetarianKeywords.some((kw) => fullText.includes(kw));
  });
};

export default function RestaurantRecommendations({ dishName, previewRestaurants }) {
  const section = useRef(null);
  const [restaurants, setRestaurants] = useState([]);
  const [status, setStatus] = useState('loading');
  const [userCoords, setUserCoords] = useState(() => {
    try {
      const cached = sessionStorage.getItem('nutribot_user_coords');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return null;
  });
  const [isLocating, setIsLocating] = useState(false);

  // Auto-fetch user position immediately on mount without requiring click
  useEffect(() => {
    if (previewRestaurants) return;

    let isMounted = true;
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      setIsLocating(true);
      getUserCurrentPosition()
        .then((pos) => {
          if (!isMounted) return;
          if (pos && typeof pos.lat === 'number' && typeof pos.lng === 'number') {
            const coords = { lat: pos.lat, lng: pos.lng };
            setUserCoords(coords);
            try {
              sessionStorage.setItem('nutribot_user_coords', JSON.stringify(coords));
            } catch {
              // ignore
            }
          }
        })
        .catch((err) => {
          console.debug('Auto-geolocation not available or denied:', err?.message);
        })
        .finally(() => {
          if (isMounted) setIsLocating(false);
        });
    }

    return () => {
      isMounted = false;
    };
  }, [previewRestaurants]);

  useEffect(() => {
    if (previewRestaurants) {
      setRestaurants(filterValidRestaurants(previewRestaurants).slice(0, 6));
      setStatus('ready');
      return undefined;
    }
    const controller = new AbortController();
    setStatus('loading');

    // Strictly search for verified vegetarian establishments only
    const keywords = ['nhà hàng chay', 'quán chay', 'cơm chay', 'ẩm thực chay', 'buffet chay', 'vegan'];

    const searchParams = {
      keywords,
      radiusKm: 25,
      signal: controller.signal
    };

    if (userCoords) {
      searchParams.lat = userCoords.lat;
      searchParams.lng = userCoords.lng;
    }

    searchNearbyRestaurants(searchParams)
      .then((items) => {
        if (!controller.signal.aborted) {
          const validFetched = filterValidRestaurants(items || []);
          const curatedFallback = CURATED_RESTAURANTS.map((item) => {
            const norm = normalizeRestaurant(item);
            if (userCoords) {
              norm.distanceKm = calculateDistance(userCoords.lat, userCoords.lng, item.lat, item.lng);
            }
            return norm;
          });

          const seenNames = new Set(validFetched.map((r) => r.name?.toLowerCase().trim()));
          const combined = [...validFetched];
          for (const curated of curatedFallback) {
            const key = curated.name?.toLowerCase().trim();
            if (!seenNames.has(key)) {
              seenNames.add(key);
              combined.push(curated);
            }
            if (combined.length >= 6) break;
          }

          setRestaurants(combined.slice(0, 6));
          setStatus('ready');
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          const curatedFallback = CURATED_RESTAURANTS.map((item) => {
            const norm = normalizeRestaurant(item);
            if (userCoords) {
              norm.distanceKm = calculateDistance(userCoords.lat, userCoords.lng, item.lat, item.lng);
            }
            return norm;
          });
          setRestaurants(curatedFallback.slice(0, 6));
          setStatus('ready');
        }
      });

    return () => controller.abort();
  }, [previewRestaurants, dishName, userCoords]);

  useGSAP(() => {
    if (
      status !== 'ready' ||
      typeof window === 'undefined' ||
      !window.matchMedia ||
      window.matchMedia('(prefers-reduced-motion: reduce)')?.matches
    ) {
      return undefined;
    }
    return gsap.fromTo(
      '.restaurant-recommendation-card',
      { autoAlpha: 0, y: 20, scale: 0.98 },
      { autoAlpha: 1, y: 0, scale: 1, duration: 0.5, stagger: 0.08, ease: 'power2.out' }
    );
  }, { scope: section, dependencies: [status] });

  const openMap = (restaurant) => {
    if (restaurant.googleMapUrl) {
      window.open(restaurant.googleMapUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    const place = [restaurant.name, restaurant.address].filter(Boolean).join(', ');
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <section className="restaurant-recommendations" ref={section} aria-labelledby="restaurant-recommendations-title">
      <header className="restaurant-recommendations-head">
        <div className="restaurant-recommendations-title-wrap">
          <span>
            <Utensils size={13} aria-hidden="true" /> Where to try it
          </span>
          <h2 id="restaurant-recommendations-title">
            You can enjoy vegetarian dishes at these restaurants.
          </h2>
        </div>
      </header>

      {status === 'loading' && (
        <div className="restaurant-recommendation-grid" aria-label="Loading restaurant recommendations">
          {[0, 1, 2, 3, 4, 5].map((item) => (
            <div className="restaurant-recommendation-skeleton" key={item} />
          ))}
        </div>
      )}

      {status === 'ready' && restaurants.length > 0 && (
        <div className="restaurant-recommendation-grid">
          {restaurants.map((restaurant) => (
            <article
              className="restaurant-recommendation-card"
              key={restaurant.id ?? restaurant.name}
              onClick={() => openMap(restaurant)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  openMap(restaurant);
                }
              }}
              aria-label={`Open ${restaurant.name} on map`}
            >
              <div className="restaurant-card-header">
                <span className="restaurant-card-distance">
                  {restaurant.distanceKm != null ? `${restaurant.distanceKm} km away` : 'Nearby dining'}
                </span>
                {restaurant.category && (
                  <span className="restaurant-card-category">{restaurant.category}</span>
                )}
              </div>

              <h3 className="restaurant-card-name">{restaurant.name}</h3>

              <p className="restaurant-card-address">
                <MapPin size={13} className="restaurant-pin-icon" aria-hidden="true" />
                <span>{restaurant.address || restaurant.meta || 'Location details available on map'}</span>
              </p>

              <div className="restaurant-card-action">
                <span>View location</span>
                <ArrowUpRight size={14} aria-hidden="true" />
              </div>
            </article>
          ))}
        </div>
      )}

      {status === 'ready' && !restaurants.length && (
        <div className="restaurant-recommendation-empty">
          <MapPin size={18} aria-hidden="true" />
          <span>No nearby restaurants found at the moment.</span>
        </div>
      )}

      {status === 'error' && (
        <div className="restaurant-recommendation-empty">
          <MapPin size={18} aria-hidden="true" />
          <span>Restaurant suggestions will appear when the service is available.</span>
        </div>
      )}
    </section>
  );
}

