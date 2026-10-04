import { Map, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CURATED_RESTAURANTS, normalizeRestaurant } from '../../services/restaurantApi';
import ImageWithFallback from '../ImageWithFallback';

function TrendingEateries({ eateries }) {
  return <div className="community-widget">
    <div className="community-widget-head"><b>Trending Eateries</b><Link to="/restaurants/map"><Map size={14}/>View Map</Link></div>
    <ul className="community-eateries">
      {eateries.map((e) => <li key={e.id}>
        <ImageWithFallback src={e.image} alt="" />
        <div><b>{e.name}</b><span><Star size={12} fill="currentColor"/>{e.rating}</span><small>{e.meta}</small></div>
      </li>)}
    </ul>
  </div>;
}

export default function CommunityRightRail() {
  const trendingEateries = CURATED_RESTAURANTS.slice(0, 5).map(normalizeRestaurant);
  return <aside className="community-right-rail">
    <TrendingEateries eateries={trendingEateries}/>
    <p className="community-rail-footer">About &middot; Community Guidelines &middot; Privacy</p>
  </aside>;
}
