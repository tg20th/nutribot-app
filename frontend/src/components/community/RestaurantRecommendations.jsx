import { useEffect, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ArrowUpRight, MapPin, Navigation, Star, Utensils } from 'lucide-react';
import { searchNearbyRestaurants, CURATED_RESTAURANTS, normalizeRestaurant } from '../../services/restaurantApi';
import '../../styles/restaurant-recommendations.css';

const restaurantImage = (restaurant) => restaurant.image || `https://picsum.photos/seed/nutribot-restaurant-${encodeURIComponent(restaurant.id ?? restaurant.name)}/900/620`;

export function extractDishName(rawTitle) {
  if (!rawTitle || typeof rawTitle !== 'string') return '';
  let title = rawTitle.trim();

  // 1. Tách nếu có dấu phân cách phần mô tả phụ như: ' - ', ' – ', ' — ', ' | ', ' / ', ' : '
  const splitDelimiters = /\s*(?:[-–—|/:]|\s-\s)\s*/;
  if (splitDelimiters.test(title)) {
    const parts = title.split(splitDelimiters).map((p) => p.trim()).filter(Boolean);
    if (parts.length > 0) {
      title = parts[0];
    }
  }

  // 2. Bỏ các tiền tố hướng dẫn / công thức phổ biến ở đầu
  const prefixRegex = /^(?:cách\s+(?:làm|nấu|chế\s*biến|pha|nướng|kho|xào|hầm|trộn)\s*(?:món)?|hướng\s+dẫn\s+(?:cách\s+làm|cách\s+nấu|làm|nấu|chế\s*biến)?|công\s+thức\s+(?:làm|nấu|chế\s*biến)?|bí\s+quyết\s+(?:làm|nấu)?|chia\s+sẻ\s+cách\s+(?:làm|nấu)|học\s+cách\s+(?:làm|nấu)|món\s*(?:ngon)?|gợi\s+ý\s+món|how\s+to\s+make|recipe\s+for|easy\s+recipe\s+for)\s+/i;
  title = title.replace(prefixRegex, '').trim();

  // 3. Bỏ các hậu tố mô tả cảm xúc, tính chất, thời điểm ăn ở cuối
  const suffixRegex = /\s+(?:thanh\s+đạm|thanh\s+mát|thơm\s+ngon|bổ\s+dưỡng|dễ\s+làm|cực\s+dễ|siêu\s+ngon|siêu\s+dễ|đơn\s+giản|tại\s+nhà|chuẩn\s+vị|giảm\s+cân|giữ\s+dáng|đẹp\s+dáng|cho\s+bữa\s+(?:sáng|trưa|tối|phụ)|cho\s+(?:gia\s+đình|cả\s+nhà)|bồi\s+bổ\s+sức\s+khỏe|giải\s+nhiệt\s+mùa\s+hè|for\s+(?:breakfast|lunch|dinner|weight\s*loss)|easy\s+recipe).*$/i;
  title = title.replace(suffixRegex, '').trim();

  // 4. Bỏ các ký tự đặc biệt thừa ở đầu/cuối như ngoặc kép, gạch đầu dòng, dấu câu
  title = title.replace(/^["'“”«»#*_\-\s]+|["'“”«»#*_\-\s]+$/g, '').trim();

  // 5. Nếu chuỗi bị rỗng hoặc quá ngắn do lọc quá đà, dùng lại tiêu đề ban đầu (chỉ bỏ tiền tố)
  if (!title || title.length < 3) {
    const fallback = rawTitle.replace(prefixRegex, '').trim();
    return fallback || rawTitle.trim();
  }

  return title.charAt(0).toUpperCase() + title.slice(1);
}

export default function RestaurantRecommendations({ dishName, previewRestaurants }) {
  const section = useRef(null);
  const [restaurants, setRestaurants] = useState([]);
  const [status, setStatus] = useState('loading');
  const cleanDish = extractDishName(dishName);

  useEffect(() => {
    if (previewRestaurants) {
      setRestaurants(previewRestaurants);
      setStatus('ready');
      return undefined;
    }
    const controller = new AbortController();
    setStatus('loading');

    const keywords = cleanDish
      ? [`${cleanDish} chay`, cleanDish, 'quán chay']
      : ['quán chay', 'cơm chay', 'nhà hàng chay'];

    searchNearbyRestaurants({
      keywords,
      radiusKm: 20,
      signal: controller.signal
    })
      .then((items) => {
        if (!controller.signal.aborted) {
          const list = items && items.length > 0 ? items : CURATED_RESTAURANTS.map(normalizeRestaurant);
          setRestaurants(list.slice(0, 3));
          setStatus('ready');
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setRestaurants(CURATED_RESTAURANTS.map(normalizeRestaurant).slice(0, 3));
          setStatus('ready');
        }
      });

    return () => controller.abort();
  }, [previewRestaurants, cleanDish]);

  useGSAP(() => {
    if (status !== 'ready' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    return gsap.fromTo('.restaurant-recommendation-card', { autoAlpha: 0, y: 28, scale: .97 }, { autoAlpha: 1, y: 0, scale: 1, duration: .65, stagger: .1, ease: 'power3.out' });
  }, { scope: section, dependencies: [status] });

  const openMap = (restaurant) => {
    if (restaurant.googleMapUrl) {
      window.open(restaurant.googleMapUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    const place = [restaurant.name, restaurant.address].filter(Boolean).join(', ');
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`, '_blank', 'noopener,noreferrer');
  };

  return <section className="restaurant-recommendations" ref={section} aria-labelledby="restaurant-recommendations-title">
    <header className="restaurant-recommendations-head"><div><span><Utensils size={13}/> Where to try it</span><h2 id="restaurant-recommendations-title">You can enjoy {cleanDish || 'this dish'} at these restaurants.</h2></div><p>Places serving a similar dish when you would rather eat out.</p></header>
    {status === 'loading' && <div className="restaurant-recommendation-grid" aria-label="Loading restaurant recommendations">{[0, 1, 2].map((item) => <div className="restaurant-recommendation-skeleton" key={item}/>)}</div>}
    {status === 'ready' && restaurants.length > 0 && <div className="restaurant-recommendation-grid">{restaurants.map((restaurant) => <article className="restaurant-recommendation-card" key={restaurant.id ?? restaurant.name}><div className="restaurant-recommendation-media"><img src={restaurantImage(restaurant)} alt={restaurant.name}/><button type="button" onClick={() => openMap(restaurant)} aria-label={`Open ${restaurant.name} on map`}><Navigation size={15}/></button></div><div className="restaurant-recommendation-copy"><div className="restaurant-recommendation-rating">{restaurant.rating != null && <><Star size={13} fill="currentColor"/>{restaurant.rating}</>}<span>{restaurant.distanceKm != null ? `${restaurant.distanceKm} km away` : 'Recommended nearby'}</span></div><h3>{restaurant.name}</h3><p><MapPin size={13}/>{restaurant.address || restaurant.meta || 'Location details available on the map'}</p><button type="button" onClick={() => openMap(restaurant)}>View location <ArrowUpRight size={15}/></button></div></article>)}</div>}
    {status === 'ready' && !restaurants.length && <div className="restaurant-recommendation-empty"><MapPin size={19}/><span>No nearby restaurants serving this dish yet.</span></div>}
    {status === 'error' && <div className="restaurant-recommendation-empty"><MapPin size={19}/><span>Restaurant suggestions will appear when the service is available.</span></div>}
  </section>;
}
