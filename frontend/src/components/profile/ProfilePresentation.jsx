import { CalendarDays, Grid3X3, UtensilsCrossed } from 'lucide-react';
import ImageWithFallback from '../ImageWithFallback';

const initial = (profile) => (profile.displayName || profile.fullName || profile.username || 'N').charAt(0).toUpperCase();

export function ProfileAvatar({ profile }) {
  const avatarUrl = profile.avatarUrl || profile.avatar;
  return avatarUrl
    ? <ImageWithFallback className="public-profile-avatar public-profile-avatar--large" src={avatarUrl} alt="" />
    : <span className="public-profile-avatar public-profile-avatar--large avatar-fallback" aria-hidden="true">{initial(profile)}</span>;
}

export function ProfileHeader({ profile, stats = {}, isOwner = false, onOpenSettings }) {
  const displayName = profile.displayName || profile.fullName || profile.username;
  return <header className="public-profile-header">
    <ProfileAvatar profile={profile} />
    <div className="public-profile-intro">
      <div className="public-profile-name-row"><div><h1>{displayName}</h1>{profile.username && <p>@{profile.username}</p>}</div>
        {isOwner && <button type="button" className="public-profile-edit-button" onClick={onOpenSettings}>Edit profile</button>}
      </div>
      {profile.bio && <p className="public-profile-bio">{profile.bio}</p>}
      <div className="public-profile-meta">{profile.joinedAt && <span><CalendarDays size={14}/> Joined {new Date(profile.joinedAt).toLocaleDateString('en', { month: 'short', year: 'numeric' })}</span>}</div>
      <dl className="public-profile-stats">{[['posts', 'Posts'], ['approvedRecipeContributions', 'Recipes'], ['totalLikes', 'Likes']].filter(([key]) => stats[key] != null).map(([key, label]) => <div key={key}><dt>{stats[key]}</dt><dd>{label}</dd></div>)}</dl>
    </div>
  </header>;
}

export function ProfileTabs({ tab, onChange }) {
  return <nav className="public-profile-tabs" aria-label="Profile content">
    <button type="button" className={tab === 'posts' ? 'is-active' : ''} onClick={() => onChange('posts')}><Grid3X3 size={16}/> Posts</button>
    <button type="button" className={tab === 'recipes' ? 'is-active' : ''} onClick={() => onChange('recipes')}><UtensilsCrossed size={16}/> Recipes</button>
  </nav>;
}
