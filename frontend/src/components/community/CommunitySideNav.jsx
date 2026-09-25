import { BarChart3, BookOpen, CalendarDays, MapPin, Rss } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getCurrentUserFromToken } from '../../utils/auth';

const icons = { Rss, BookOpen, CalendarDays, MapPin, BarChart3 };
const communityNav = [
  { label: 'Home', icon: 'Rss', to: '/home' },
  { label: 'My blogs', icon: 'BookOpen', to: '/community/my-blogs' },
  { label: 'Weekly Meal Planner', icon: 'CalendarDays', to: '/community/planner' },
  { label: 'Nearby Vegan Map', icon: 'MapPin' },
  { label: 'Analytics', icon: 'BarChart3' },
];

const buildAvatarFromUsername = (username) => {
  const safeName = (username || 'User').trim();
  const initials = safeName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'U';
  const colors = ['#173529', '#285642', '#397055', '#7a4f2a', '#315c2b'];
  const index = safeName.length % colors.length;
  const bg = colors[index];
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='32' fill='${bg}'/><text x='50%' y='54%' font-family='Outfit, Arial, sans-serif' font-size='26' font-weight='700' fill='#d7f261' text-anchor='middle' dominant-baseline='middle'>${initials}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

export default function CommunitySideNav({ activePath }) {
  const { pathname } = useLocation();
  const activeLocation = activePath ?? pathname;
  const currentUser = getCurrentUserFromToken();
  const username = currentUser?.username || 'NutriBot Member';
  const [profileAvatar, setProfileAvatar] = useState(() => sessionStorage.getItem('nutribot-profile-avatar') || '');
  const avatarSrc = profileAvatar || buildAvatarFromUsername(username);

  useEffect(() => {
    const handleProfileUpdate = (event) => setProfileAvatar(event.detail?.avatarUrl || '');
    window.addEventListener('nutribot-profile-updated', handleProfileUpdate);
    return () => window.removeEventListener('nutribot-profile-updated', handleProfileUpdate);
  }, []);

  return (
    <nav className="community-sidenav" aria-label="Community sections">
      {communityNav.map(({ label, icon, to }) => {
        const Icon = icons[icon];
        const isActive = to === activeLocation;
        return to
          ? <Link key={label} to={to} className={isActive ? 'is-active' : ''} title={label} aria-label={label} aria-current={to === pathname ? 'page' : undefined}><Icon size={20}/><span>{label}</span></Link>
          : <button key={label} type="button" title={label}><Icon size={20}/><span>{label}</span></button>;
      })}
      <Link to="/profile" className={`community-sidenav-profile${activeLocation === '/profile' ? ' is-active' : ''}`} title={username} aria-label={`Open ${username} profile`}>
        <img src={avatarSrc} alt={username}/>
        <span><b>{username}</b><small>View your profile</small></span>
      </Link>
    </nav>
  );
}
