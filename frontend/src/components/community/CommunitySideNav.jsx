import { Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUserFromToken } from '../../utils/auth';
import { userDashboardNav } from './userDashboardNav';
import { apiRequest } from '../../services/apiClient';
import { getMyProfile } from '../../services/profileApi';

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
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

export default function CommunitySideNav({ activePath }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const activeLocation = activePath ?? pathname;
  const currentUser = getCurrentUserFromToken();
  const username = currentUser?.username || 'NutriBot Member';
  const [profileAvatar, setProfileAvatar] = useState(() => 
    sessionStorage.getItem('nutribot-profile-avatar') || 
    localStorage.getItem('nutribot-profile-avatar') || 
    ''
  );
  const avatarSrc = profileAvatar || buildAvatarFromUsername(username);

  useEffect(() => {
    const handleProfileUpdate = (event) => {
      const url = event.detail?.avatarUrl || '';
      setProfileAvatar(url);
      if (url) {
        localStorage.setItem('nutribot-profile-avatar', url);
        sessionStorage.setItem('nutribot-profile-avatar', url);
      } else {
        localStorage.removeItem('nutribot-profile-avatar');
        sessionStorage.removeItem('nutribot-profile-avatar');
      }
    };
    window.addEventListener('nutribot-profile-updated', handleProfileUpdate);
    return () => window.removeEventListener('nutribot-profile-updated', handleProfileUpdate);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('nutribot-auth-token');
    if (token) {
      getMyProfile()
        .then((profile) => {
          if (profile?.avatarUrl) {
            setProfileAvatar(profile.avatarUrl);
            sessionStorage.setItem('nutribot-profile-avatar', profile.avatarUrl);
            localStorage.setItem('nutribot-profile-avatar', profile.avatarUrl);
          }
        })
        .catch(() => {});
    }
  }, [currentUser?.username]);

  const handleLogout = async () => {
    try {
      await apiRequest('/api/v1/auth/logout', { method: 'POST' });
    } catch {
      // The application uses stateless JWTs. Clearing the local session still
      // safely completes sign-out when the token has already expired.
    } finally {
      localStorage.removeItem('nutribot-auth-token');
      localStorage.removeItem('nutribot-user');
      sessionStorage.removeItem('nutribot-profile-avatar');
      localStorage.removeItem('nutribot-profile-avatar');
      navigate('/', { replace: true });
    }
  };

  return (
    <nav className="community-sidenav" aria-label="Community sections">
      {userDashboardNav.map(({ label, icon: Icon, to }) => {
        const isActive = to === activeLocation;
        return to
          ? <Link key={label} to={to} className={isActive ? 'is-active' : ''} title={label} aria-label={label} aria-current={to === pathname ? 'page' : undefined}><Icon size={20}/><span>{label}</span></Link>
          : <button key={label} type="button" title={label}><Icon size={20}/><span>{label}</span></button>;
      })}
      <div className="community-sidenav-account">
        <Link to="/profile" className={`community-sidenav-profile${activeLocation === '/profile' ? ' is-active' : ''}`} title={username} aria-label={`Open ${username} profile`}>
          <img 
            src={avatarSrc} 
            alt={username}
            referrerPolicy="no-referrer"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = buildAvatarFromUsername(username);
            }}
          />
          <span><b>{username}</b><small>View your profile</small></span>
        </Link>
        <button className="community-sidenav-logout" type="button" onClick={handleLogout} title="Log out" aria-label="Log out"><LogOut size={17}/><span>Log out</span></button>
      </div>
    </nav>
  );
}
