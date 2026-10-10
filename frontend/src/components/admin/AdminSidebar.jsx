import { LayoutDashboard, Users, Tags, ShieldCheck, ClipboardCheck, MessageSquare, LogOut } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getMyProfile } from '../../services/profileApi';

const buildAvatarFromName = (name) => {
  const initials = (name || 'Administrator')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'A';
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='32' fill='#173529'/><text x='50%' y='54%' font-family='Outfit, Arial, sans-serif' font-size='26' font-weight='700' fill='#d7f261' text-anchor='middle' dominant-baseline='middle'>${initials}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};
const items = [{ to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true }, { to: '/admin/users', label: 'Members', icon: Users }, { to: '/admin/categories', label: 'Categories', icon: Tags }, { to: '/admin/moderation', label: 'Moderation', icon: ShieldCheck }, { to: '/admin/content-recipe-suggestions', label: 'Recipe suggestions', icon: ClipboardCheck }, { to: '/admin/comments', label: 'Comments', icon: MessageSquare }];
export default function AdminSidebar({ open, onClose, onLogout }) {
  const [admin, setAdmin] = useState({});
  const name = admin.fullName ?? admin.name ?? 'Administrator';
  const avatarSrc = admin.avatarUrl || buildAvatarFromName(name);

  useEffect(() => { getMyProfile().then(setAdmin).catch(() => {}); }, []);

  return <aside className={`admin-sidebar ${open ? 'open' : ''}`} aria-label="Admin navigation">
    <nav>{items.map(({ to, label, icon: Icon, end }) => <NavLink end={end} key={to} to={to} onClick={onClose} title={label}><Icon size={20}/><span>{label}</span></NavLink>)}</nav>
    <div className="admin-sidenav-account">
      <NavLink className="admin-sidenav-profile" to={`/admin/users/${admin.id ?? 'me'}`} onClick={onClose} title={name} aria-label={`Open ${name} profile`}>
        <img 
          src={avatarSrc} 
          alt={name} 
          referrerPolicy="no-referrer"
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = buildAvatarFromName(name);
          }}
        />
        <span><b>{name}</b><small>Administrator</small></span>
      </NavLink>
      <button className="admin-sidenav-logout" type="button" onClick={onLogout} title="Log out" aria-label="Log out"><LogOut size={17}/><span>Log out</span></button>
    </div>
  </aside>;
}
