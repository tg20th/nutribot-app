import { useEffect, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ArrowUpRight, MapPin, Utensils } from 'lucide-react';
import { searchNearbyRestaurants, CURATED_RESTAURANTS, normalizeRestaurant } from '../../services/restaurantApi';
import '../../styles/restaurant-recommendations.css';

const filterValidRestaurants = (list) => {
  if (!Array.isArray(list)) return [];
  const excludedKeywords = [
    'lập trình', 'tin học', 'phần mềm', 'công nghệ', 'bất động sản',
    'bảo hiểm', 'sửa chữa', 'garage', 'khách sạn', 'hotel', 'spa',
    'tiệm vàng', 'tiệm thuốc', 'bệnh viện', 'phòng khám', 'trường học', 'lớp học'
  ];
  const diningKeywords = [
    'chay', 'cơm', 'quán', 'nhà hàng', 'bếp', 'ẩm thực', 'bistro', 'vegan',
    'vegetarian', 'salad', 'noodle', 'phở', 'bún', 'lẩu', 'buffet', 'tiệm',
    'món', 'dining', 'kitchen', 'eatery', 'food', 'café', 'cafe'
  ];

  return list.filter((item) => {
    if (!item || !item.name) return false;
    const nameLower = item.name.toLowerCase();
    const addrLower = (item.address || '').toLowerCase();
    if (excludedKeywords.some((kw) => nameLower.includes(kw) || addrLower.includes(kw))) {
      return false;
    }
    return diningKeywords.some((kw) => nameLower.includes(kw) || addrLower.includes(kw));
  });
};

export default function RestaurantRecommendations({ dishName, previewRestaurants }) {
  const section = useRef(null);
  const [restaurants, setRestaurants] = useState([]);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    if (previewRestaurants) {
      setRestaurants(previewRestaurants.slice(0, 6));
      setStatus('ready');
      return undefined;
    }
    const controller = new AbortController();
    setStatus('loading');

    const cleanDish = (dishName || '').trim();
    const keywords = ['nhà hàng chay', 'quán chay', 'cơm chay', 'ẩm thực chay'];
    if (cleanDish) {
      keywords.unshift(`${cleanDish} chay`);
    }

    searchNearbyRestaurants({
      keywords,
      radiusKm: 25,
      signal: controller.signal
    })
      .then((items) => {
        if (!controller.signal.aborted) {
          const validFetched = filterValidRestaurants(items || []);
          const curatedFallback = CURATED_RESTAURANTS.map(normalizeRestaurant);

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
          setRestaurants(CURATED_RESTAURANTS.map(normalizeRestaurant).slice(0, 6));
          setStatus('ready');
        }
      });

    return () => controller.abort();
  }, [previewRestaurants, dishName]);

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
        <div>
          <span>
            <Utensils size={13} aria-hidden="true" /> Where to try it
          </span>
          <h2 id="restaurant-recommendations-title">
            You can enjoy vegetarian dishes at these restaurants.
          </h2>
        </div>
        <p>Curated dining options serving nourishing plant-based dishes.</p>
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

