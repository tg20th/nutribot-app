import { Bell, Bookmark, Search } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function CommunityTopBar({ query, onQueryChange }) {
  return <header className="community-topbar">
    <Link to="/home" className="community-brand" aria-label="NutriBot member home"><span>Nutri</span>Bot<small>Good Food. Brighter You.</small></Link>
    <div className="community-search">
      <Search size={16}/>
      <input value={query} onChange={(e) => onQueryChange(e.target.value)} placeholder="Search your feed, creators, plant-based tag..." aria-label="Search community feed"/>
    </div>
    <div className="community-topbar-actions">
      <button className="community-icon-btn" aria-label="Notifications"><Bell size={18}/><span className="community-dot"/></button>
      <button className="community-icon-btn" aria-label="Saved posts"><Bookmark size={18}/></button>
    </div>
  </header>;
}
