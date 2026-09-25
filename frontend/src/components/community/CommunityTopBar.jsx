import { Bell, Bookmark, Search, Menu, X, BarChart3, BookOpen, CalendarDays, MapPin, Rss } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { getCurrentUserFromToken } from '../../utils/auth';

const drawerNav = [
  { label: 'Home', icon: Rss, to: '/home' },
  { label: 'My blogs', icon: BookOpen, to: '/community/my-blogs' },
  { label: 'Weekly Meal Planner', icon: CalendarDays, to: '/community/planner' },
  { label: 'Nearby Vegan Map', icon: MapPin },
  { label: 'Analytics', icon: BarChart3 },
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

export default function CommunityTopBar({ query, onQueryChange, hideSearch = false, activePath }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { pathname } = useLocation();
  const activeLocation = activePath ?? pathname;
  const currentUser = getCurrentUserFromToken();
  const username = currentUser?.username || 'NutriBot Member';
  const [profileAvatar, setProfileAvatar] = useState(() => sessionStorage.getItem('nutribot-profile-avatar') || '');
  const avatarSrc = profileAvatar || buildAvatarFromUsername(username);

  // Close drawer on navigation
  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  useEffect(() => {
    const handleProfileUpdate = (event) => setProfileAvatar(event.detail?.avatarUrl || '');
    window.addEventListener('nutribot-profile-updated', handleProfileUpdate);
    return () => window.removeEventListener('nutribot-profile-updated', handleProfileUpdate);
  }, []);

  // Close drawer on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') setDrawerOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Prevent body scroll when drawer open
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  return <>
    <header className="community-topbar">
      <button
        className="community-hamburger"
        onClick={() => setDrawerOpen(true)}
        aria-label="Open navigation menu"
        aria-expanded={drawerOpen}
        aria-controls="community-drawer"
      >
        <Menu size={22}/>
      </button>
      <Link to="/home" className="community-brand" aria-label="NutriBot member home"><span>Nutri</span>Bot<small>Good Food. Brighter You.</small></Link>
      {!hideSearch && <div className="community-search">
        <Search size={16}/>
        <input value={query} onChange={(e) => onQueryChange(e.target.value)} placeholder="Search your feed, creators, plant-based tag..." aria-label="Search community feed"/>
      </div>}
      <div className="community-topbar-actions">
        <button className="community-icon-btn" aria-label="Notifications"><Bell size={18}/><span className="community-dot"/></button>
        <button className="community-icon-btn" aria-label="Saved posts"><Bookmark size={18}/></button>
      </div>
    </header>

    {/* Mobile drawer overlay */}
    <div
      className={`community-drawer-overlay${drawerOpen ? ' is-open' : ''}`}
      onClick={() => setDrawerOpen(false)}
      aria-hidden="true"
    />

    {/* Mobile drawer */}
    <nav
      id="community-drawer"
      className={`community-drawer${drawerOpen ? ' is-open' : ''}`}
      aria-label="Mobile navigation"
      aria-hidden={!drawerOpen}
    >
      <div className="community-drawer-header">
        <span className="community-drawer-brand"><span>Nutri</span>Bot</span>
        <button
          className="community-drawer-close"
          onClick={() => setDrawerOpen(false)}
          aria-label="Close navigation menu"
        >
          <X size={20}/>
        </button>
      </div>
      <div className="community-drawer-nav">
        {drawerNav.map(({ label, icon, to }) => {
          const Icon = icon;
          const isActive = to === activeLocation;
          return to
            ? <Link
                key={label}
                to={to}
                className={isActive ? 'is-active' : ''}
                aria-current={to === pathname ? 'page' : undefined}
              >
                <Icon size={20}/>
                <span>{label}</span>
              </Link>
            : <button key={label} type="button">
                <Icon size={20}/>
                <span>{label}</span>
              </button>;
        })}
      </div>
      <div className="community-drawer-profile">
        <Link to="/profile">
          <img src={avatarSrc} alt={username}/>
          <span>
            <b>{username}</b>
            <small>Manage your account</small>
          </span>
        </Link>
      </div>
    </nav>
  </>;
}
