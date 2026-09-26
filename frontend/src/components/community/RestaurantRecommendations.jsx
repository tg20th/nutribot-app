import { useEffect, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ArrowUpRight, MapPin, Navigation, Star, Utensils } from 'lucide-react';
import { getRestaurants } from '../../services/restaurantApi';
import '../../styles/restaurant-recommendations.css';

const restaurantImage = (restaurant) => restaurant.image || `https://picsum.photos/seed/nutribot-restaurant-${encodeURIComponent(restaurant.id ?? restaurant.name)}/900/620`;

export default function RestaurantRecommendations({ dishName, previewRestaurants }) {
  const section = useRef(null);
  const [restaurants, setRestaurants] = useState([]);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    if (previewRestaurants) {
      setRestaurants(previewRestaurants);
      setStatus('ready');
      return undefined;
    }
    const controller = new AbortController();
    setStatus('loading');
    getRestaurants(controller.signal)
      .then((items) => { if (!controller.signal.aborted) { setRestaurants(items.slice(0, 3)); setStatus('ready'); } })
      .catch(() => { if (!controller.signal.aborted) setStatus('error'); });
    return () => controller.abort();
  }, [previewRestaurants]);

  useGSAP(() => {
    if (status !== 'ready' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    return gsap.fromTo('.restaurant-recommendation-card', { autoAlpha: 0, y: 28, scale: .97 }, { autoAlpha: 1, y: 0, scale: 1, duration: .65, stagger: .1, ease: 'power3.out' });
  }, { scope: section, dependencies: [status] });

  const openMap = (restaurant) => {
    const place = [restaurant.name, restaurant.address].filter(Boolean).join(', ');
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`, '_blank', 'noopener,noreferrer');
  };

  return <section className="restaurant-recommendations" ref={section} aria-labelledby="restaurant-recommendations-title">
    <header className="restaurant-recommendations-head"><div><span><Utensils size={13}/> Where to try it</span><h2 id="restaurant-recommendations-title">You can enjoy {dishName || 'this dish'} at these restaurants.</h2></div><p>Places serving a similar dish when you would rather eat out.</p></header>
    {status === 'loading' && <div className="restaurant-recommendation-grid" aria-label="Loading restaurant recommendations">{[0, 1, 2].map((item) => <div className="restaurant-recommendation-skeleton" key={item}/>)}</div>}
    {status === 'ready' && restaurants.length > 0 && <div className="restaurant-recommendation-grid">{restaurants.map((restaurant) => <article className="restaurant-recommendation-card" key={restaurant.id ?? restaurant.name}><div className="restaurant-recommendation-media"><img src={restaurantImage(restaurant)} alt={restaurant.name}/><button type="button" onClick={() => openMap(restaurant)} aria-label={`Open ${restaurant.name} on map`}><Navigation size={15}/></button></div><div className="restaurant-recommendation-copy"><div className="restaurant-recommendation-rating">{restaurant.rating != null && <><Star size={13} fill="currentColor"/>{restaurant.rating}</>}<span>{restaurant.distanceKm != null ? `${restaurant.distanceKm} km away` : 'Recommended nearby'}</span></div><h3>{restaurant.name}</h3><p><MapPin size={13}/>{restaurant.address || restaurant.meta || 'Location details available on the map'}</p><button type="button" onClick={() => openMap(restaurant)}>View location <ArrowUpRight size={15}/></button></div></article>)}</div>}
    {status === 'ready' && !restaurants.length && <div className="restaurant-recommendation-empty"><MapPin size={19}/><span>No nearby restaurants serving this dish yet.</span></div>}
    {status === 'error' && <div className="restaurant-recommendation-empty"><MapPin size={19}/><span>Restaurant suggestions will appear when the service is available.</span></div>}
  </section>;
}
