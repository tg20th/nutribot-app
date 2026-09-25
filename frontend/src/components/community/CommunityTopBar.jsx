import { Bell, Bookmark, Search, Menu, X, BarChart3, BookOpen, CalendarDays, MapPin, Rss } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';

const drawerNav = [
  { label: 'Home', icon: Rss, to: '/home' },
  { label: 'My blogs', icon: BookOpen, to: '/community/my-blogs' },
  { label: 'Weekly Meal Planner', icon: CalendarDays, to: '/community/planner' },
  { label: 'Nearby Vegan Map', icon: MapPin },
  { label: 'Analytics', icon: BarChart3 },
];

export default function CommunityTopBar({ query, onQueryChange, hideSearch = false, profile }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { pathname } = useLocation();

  // Close drawer on navigation
  useEffect(() => { setDrawerOpen(false); }, [pathname]);

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
          const isActive = to === pathname;
          return to
            ? <Link
                key={label}
                to={to}
                className={isActive ? 'is-active' : ''}
                aria-current={isActive ? 'page' : undefined}
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
        <Link to="/community/profile">
          <img src={profile?.avatarUrl || ''} alt=""/>
          <span>
            <b>{profile?.fullName || profile?.name || 'View your profile'}</b>
            <small>Manage your account</small>
          </span>
        </Link>
      </div>
    </nav>
  </>;
}
