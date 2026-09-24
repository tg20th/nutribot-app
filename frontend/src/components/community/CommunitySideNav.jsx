import { BarChart3, CalendarDays, MapPin, Rss } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getMyProfile } from '../../services/profileApi';

const icons = { Rss, CalendarDays, MapPin, BarChart3 };
const communityNav = [{ label: 'Feed', icon: 'Rss', to: '/community' }, { label: 'Weekly Meal Planner', icon: 'CalendarDays', to: '/community/planner' }, { label: 'Nearby Vegan Map', icon: 'MapPin' }, { label: 'Analytics', icon: 'BarChart3' }];

export default function CommunitySideNav() {
  const [communityUser, setCommunityUser] = useState({}); useEffect(() => { getMyProfile().then(setCommunityUser).catch(() => {}); }, []);
  const { pathname } = useLocation();
  return <nav className="community-sidenav" aria-label="Community sections">
    {communityNav.map(({ label, icon, to }) => {
      const Icon = icons[icon];
      const isActive = to === pathname;
      return to
        ? <Link key={label} to={to} className={isActive ? 'is-active' : ''} title={label}><Icon size={20}/><span>{label}</span></Link>
        : <button key={label} type="button" title={label}><Icon size={20}/><span>{label}</span></button>;
    })}
    <Link to="/community/profile" className={`community-sidenav-profile${pathname === '/community/profile' ? ' is-active' : ''}`} title="Your profile" aria-label="Open your profile">
      {communityUser.avatarUrl && <img src={communityUser.avatarUrl} alt=""/>}
      <span><b>{communityUser.fullName ?? communityUser.name}</b><small>View your profile</small></span>
    </Link>
  </nav>;
}
