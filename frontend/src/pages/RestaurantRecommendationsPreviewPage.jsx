import { useState } from 'react';
import CommunityTopBar from '../components/community/CommunityTopBar';
import CommunitySideNav from '../components/community/CommunitySideNav';
import RestaurantRecommendations from '../components/community/RestaurantRecommendations';

const previewRestaurants = [
  { id: 'preview-1', name: 'Mãn Tự Vegan', address: '201 Nguyễn Thị Minh Khai, Quận 1, TP.HCM', rating: 4.8, distanceKm: 0.8 },
  { id: 'preview-2', name: 'The Veggie Table', address: '37 Lý Tự Trọng, Quận 1, TP.HCM', rating: 4.7, distanceKm: 1.2 },
  { id: 'preview-3', name: 'Hum Garden', address: '32 D10, Thảo Điền, TP. Thủ Đức', rating: 4.9, distanceKm: 2.4 },
];

export default function RestaurantRecommendationsPreviewPage() {
  const [query, setQuery] = useState('');
  return <div className="community-page"><CommunityTopBar query={query} onQueryChange={setQuery}/><div className="community-shell"><CommunitySideNav activePath="/home"/><span className="community-sidenav-spacer" aria-hidden="true"/><div className="community-layout"><main className="community-feed restaurant-preview-main"><RestaurantRecommendations dishName="Mushroom tofu bowl" previewRestaurants={previewRestaurants}/></main></div></div></div>;
}
