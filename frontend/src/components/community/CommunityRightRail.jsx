import { Map, Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getRestaurants } from '../../services/restaurantApi';
import ImageWithFallback from '../ImageWithFallback';

function TrendingEateries({ eateries }) {
  return <div className="community-widget">
    <div className="community-widget-head"><b>Trending Eateries</b><a href="#map"><Map size={14}/>View Map</a></div>
    <ul className="community-eateries">
      {eateries.map((e) => <li key={e.id}>
        <ImageWithFallback src={e.image} alt="" />
        <div><b>{e.name}</b><span><Star size={12} fill="currentColor"/>{e.rating}</span><small>{e.meta}</small></div>
      </li>)}
    </ul>
  </div>;
}

function TrendingHashtags({ hashtags }) {
  return <div className="community-widget">
    <div className="community-widget-head"><b>Trending in the Community</b></div>
    <ul className="community-hashtags">{hashtags.map((tag) => <li key={tag}><a href="#tag">{tag}</a></li>)}</ul>
  </div>;
}

export default function CommunityRightRail() {
  const [trendingEateries, setTrendingEateries] = useState([]); const [trendingHashtags, setTrendingHashtags] = useState([]);
  useEffect(() => { getRestaurants().then((items) => { setTrendingEateries(items); setTrendingHashtags([...new Set(items.flatMap((x) => x.hashtags ?? []))]); }).catch(() => {}); }, []);
  return <aside className="community-right-rail">
    <TrendingEateries eateries={trendingEateries}/>
    <TrendingHashtags hashtags={trendingHashtags}/>
    <p className="community-rail-footer">About &middot; Community Guidelines &middot; Privacy</p>
  </aside>;
}
