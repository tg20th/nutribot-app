import { useEffect, useState } from 'react';
import { ArrowLeft, Check, CircleUserRound, HeartPulse, LoaderCircle, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '../services/apiClient';
import { getMyProfile, updateMyProfile, uploadMyAvatar } from '../services/profileApi';
import './ProfilePage.css';

function messageFor(error) {
  return error instanceof ApiError
    ? error.message
    : error?.message || 'We could not connect to the server. Please try again.';
}

function formatDate(value) {
  if (!value) return 'Not provided';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Not provided'
    : new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(date);
}

function isUnauthorized(error) {
  return (error instanceof ApiError && error.status === 401)
    || /unauthorized|authentication required|token/i.test(error?.message || '');
}

function displayBmiCategory(value) {
  const labels = {
    'thiếu cân': 'Underweight',
    'bình thường': 'Normal',
    'thừa cân': 'Overweight',
    'béo phì': 'Obese',
  };
  return labels[String(value || '').toLocaleLowerCase('vi')] || value || 'BMI not available';
}

function displayGender(value) {
  const labels = { 'nữ': 'Female', 'nam': 'Male', 'khác': 'Other', female: 'Female', male: 'Male', other: 'Other' };
  return labels[String(value || '').toLocaleLowerCase('vi')] || value || null;
}

function displayHealthGoal(value) {
  const labels = { lose_weight: 'Lose weight', gain_muscle: 'Gain muscle', maintain: 'Maintain weight' };
  return labels[value] || value || null;
}

function normalizeProfile(data = {}) {
  return {
    ...data,
    fullName: data.fullName || data.username || 'NutriBot member',
    username: data.username || '',
    email: data.email || '',
    avatarUrl: data.avatarUrl || '',
    bio: data.bio || '',
    roleName: (data.roleName || 'Member').replace(/^ROLE_/i, '').replace(/\b\w/g, (letter) => letter.toUpperCase()),
    status: data.status || 'Unknown',
    gender: displayGender(data.gender),
    healthGoal: displayHealthGoal(data.healthGoal),
    allergies: Array.isArray(data.allergies) ? data.allergies : [],
  };
}

function InitialAvatar({ profile, className = '' }) {
  if (profile.avatarUrl) {
    return <img className={`avatar ${className}`} src={profile.avatarUrl} alt={`${profile.fullName}'s profile`} />;
  }
  return (
    <span className={`avatar avatar-placeholder ${className}`} aria-label={`${profile.fullName}'s profile`}>
      {(profile.fullName || 'N').trim().charAt(0).toUpperCase()}
    </span>
  );
}

function Sidebar({ profile }) {
  return (
    <aside className="sidebar" aria-label="Profile navigation">
      <section className="side-card mini-profile">
        <div className="mini-profile__person">
          <InitialAvatar profile={profile} className="avatar--small" />
          <div><strong>{profile.fullName}</strong><span className="muted">@{profile.username}</span></div>
        </div>
        <span className="creator-badge">{profile.roleName}</span>
        <div className="mini-stats">
          <div><strong>{profile.userId ?? '—'}</strong><span>Member ID</span></div>
          <div><strong>{profile.status}</strong><span>Account status</span></div>
        </div>
      </section>
      <nav className="side-card nav-list">
        <a href="#account-details"><UserRound size={17} /> Account details</a>
        <a href="#health-profile"><HeartPulse size={17} /> Health profile</a>
      </nav>
    </aside>
  );
}

function ProfileEditDialog({ profile, onClose, onSave, saving, error }) {
  const [form, setForm] = useState({
    fullName: profile.fullName,
    username: profile.username,
    email: profile.email,
    dateOfBirth: profile.dateOfBirth || '',
    gender: profile.gender || '',
    bio: profile.bio,
  });
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarError, setAvatarError] = useState('');
  const [avatarPreview, setAvatarPreview] = useState('');

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreview('');
      return undefined;
    }
    const previewUrl = URL.createObjectURL(avatarFile);
    setAvatarPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [avatarFile]);

  useEffect(() => {
    const handleKeyDown = (event) => event.key === 'Escape' && !saving && onClose();
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, saving]);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function handleAvatarChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setAvatarFile(null);
      setAvatarError('Choose a PNG, JPEG, or WebP image.');
      event.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarFile(null);
      setAvatarError('Choose an image that is 5 MB or smaller.');
      event.target.value = '';
      return;
    }
    setAvatarError('');
    setAvatarFile(file);
  }

  function handleSubmit(event) {
    event.preventDefault();
    onSave({
      username: form.username.trim().replace(/^@/, ''),
      email: form.email.trim(),
      fullName: form.fullName.trim(),
      bio: form.bio.trim(),
      dateOfBirth: form.dateOfBirth || null,
      gender: form.gender || null,
      avatarFile,
    });
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !saving && onClose()}>
      <section className="edit-dialog" role="dialog" aria-modal="true" aria-labelledby="edit-profile-title">
        <header className="edit-dialog__header">
          <div><span className="dialog-eyebrow">YOUR ACCOUNT</span><h2 id="edit-profile-title">Edit profile</h2><p>Update your account and personal details.</p></div>
          <button className="dialog-close" type="button" onClick={onClose} aria-label="Close edit profile" disabled={saving}>×</button>
        </header>
        <form onSubmit={handleSubmit}>
          <div className="edit-form-grid">
            <label className="edit-field">Full name<input name="fullName" value={form.fullName} onChange={updateField} maxLength={150} required /></label>
            <label className="edit-field">Username<div className="input-prefix"><span>@</span><input name="username" value={form.username} onChange={updateField} minLength={3} maxLength={50} required /></div></label>
            <label className="edit-field edit-field--wide">Email<input type="email" name="email" value={form.email} onChange={updateField} maxLength={255} required /></label>
            <div className="edit-field edit-field--wide">
              <span>Profile photo</span>
              <div className="avatar-file-control">
                <img className="avatar-preview" src={avatarPreview || profile.avatarUrl || `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="100%" height="100%" fill="#e8f1de"/><text x="50%" y="55%" text-anchor="middle" fill="#08752b" font-size="28" font-family="Arial">${profile.fullName.charAt(0).toUpperCase()}</text></svg>`)}`} alt="Profile photo preview" />
                <div className="avatar-file-details">
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleAvatarChange} aria-describedby="avatar-help avatar-error" />
                  <span id="avatar-help" className="avatar-help">PNG, JPEG, or WebP. Maximum file size: 5 MB.</span>
                  {avatarError && <span id="avatar-error" className="avatar-error" role="alert">{avatarError}</span>}
                </div>
              </div>
            </div>
            <label className="edit-field">Date of birth<input type="date" name="dateOfBirth" value={form.dateOfBirth} onChange={updateField} /></label>
            <label className="edit-field">Gender<select name="gender" value={form.gender} onChange={updateField}><option value="">Prefer not to say</option><option value="Female">Female</option><option value="Male">Male</option><option value="Other">Other</option></select></label>
            <label className="edit-field edit-field--wide">Bio<textarea name="bio" value={form.bio} onChange={updateField} maxLength={500} rows={4} placeholder="Tell us a little about yourself" /><span className="character-count">{form.bio.length}/500</span></label>
          </div>
          {error && <p className="profile-alert profile-alert--error" role="alert">{error}</p>}
          <footer className="edit-dialog__footer"><button className="cancel-edit" type="button" onClick={onClose} disabled={saving}>Cancel</button><button className="save-edit" type="submit" disabled={saving}>{saving ? <><LoaderCircle size={16} className="profile-spinner" /> Saving...</> : 'Save changes'}</button></footer>
        </form>
      </section>
    </div>
  );
}

function Detail({ label, value }) {
  return <div className="profile-detail"><dt>{label}</dt><dd>{value || 'Not provided'}</dd></div>;
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [requiresSignIn, setRequiresSignIn] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    getMyProfile(controller.signal)
      .then((data) => setProfile(normalizeProfile(data)))
      .catch((requestError) => {
        if (!controller.signal.aborted) {
          setError(messageFor(requestError));
          setRequiresSignIn(isUnauthorized(requestError));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  async function saveProfile(form) {
    setSaving(true);
    setError('');
    setRequiresSignIn(false);
    setNotice('');
    try {
      const updated = normalizeProfile(await updateMyProfile({
        username: form.username,
        email: form.email,
        fullName: form.fullName,
        bio: form.bio,
        dateOfBirth: form.dateOfBirth,
        gender: form.gender,
      }));
      setProfile(updated);
      if (form.avatarFile) {
        const avatar = await uploadMyAvatar(form.avatarFile);
        setProfile((current) => ({ ...current, avatarUrl: avatar.avatarUrl || '' }));
      }
      setIsEditing(false);
      setNotice('Your profile has been updated.');
    } catch (requestError) {
      setError(messageFor(requestError));
      setRequiresSignIn(isUnauthorized(requestError));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <main className="profile-page profile-state" role="status"><LoaderCircle className="profile-spinner" size={28} /><span>Loading your profile...</span></main>;
  }

  if (error && !profile) {
    return (
      <main className="profile-page profile-state">
        <section className="profile-state-card">
          <CircleUserRound size={30} />
          <h1>We could not load your profile</h1>
          <p>{error}</p>
          {requiresSignIn && <button className="save-edit" type="button" onClick={() => navigate('/', { state: { authRequired: true, returnTo: '/profile' } })}>Sign in</button>}
          {!requiresSignIn && <button className="save-edit" type="button" onClick={() => window.location.reload()}>Try again</button>}
        </section>
      </main>
    );
  }

  return (
    <div className="profile-page">
      <header className="topbar">
        <a className="brand-mark" href="/" aria-label="NutriBot home"><span>●</span><span>●</span><span>●</span><b>NutriBot</b></a>
        <div className="topbar__right"><InitialAvatar profile={profile} className="top-avatar" /><span>{profile.username}</span></div>
      </header>
      <div className="page-shell">
        <div className="breadcrumb"><a href="/">Home</a><b>›</b><strong>{profile.fullName}</strong><span className="profile-wall">My profile</span><span className="live-pill"><i /> {profile.status}</span></div>
        {notice && <p className="profile-alert profile-alert--success" role="status"><Check size={17} />{notice}</p>}
        {error && !isEditing && <p className="profile-alert profile-alert--error" role="alert">{error}</p>}
        <div className="layout-grid">
          <Sidebar profile={profile} />
          <main className="main-column">
            <section className="profile-card">
              <div className="cover-photo" />
              <div className="profile-card__content">
                <div className="profile-controls"><InitialAvatar profile={profile} className="avatar--hero" /><span className="online-check"><Check size={13} /></span><button className="edit-button" type="button" onClick={() => { setError(''); setIsEditing(true); }}>Edit profile</button></div>
                <h1>{profile.fullName}</h1>
                <p className="profile-meta">@{profile.username} <span>•</span> {profile.roleName}</p>
                <p className="profile-email">{profile.email}</p>
                <p className="profile-bio">{profile.bio || 'Add a short bio to tell the community about yourself.'}</p>
                <div className="profile-stats"><span><b>Member ID</b> {profile.userId ?? '—'}</span><i>•</i><span><b>Status</b> {profile.status}</span><i>•</i><span><b>Joined</b> {formatDate(profile.createdAt)}</span></div>
              </div>
            </section>
            <nav className="profile-tabs" aria-label="Profile sections"><a className="active" href="#account-details">Account details</a><a href="#health-profile">Health profile</a></nav>
            <section className="profile-section-card" id="account-details">
              <div className="section-title"><CircleUserRound size={19} /><div><h2>Account details</h2><p>Your personal information stored in NutriBot.</p></div></div>
              <dl className="profile-detail-grid">
                <Detail label="Full name" value={profile.fullName} />
                <Detail label="Username" value={`@${profile.username}`} />
                <Detail label="Email address" value={profile.email} />
                <Detail label="Role" value={profile.roleName} />
                <Detail label="Account status" value={profile.status} />
                <Detail label="Strike count" value={profile.strikeCount ?? 0} />
                <Detail label="Member since" value={formatDate(profile.createdAt)} />
                <Detail label="Last updated" value={formatDate(profile.updatedAt)} />
              </dl>
            </section>
            <section className="profile-section-card" id="health-profile">
              <div className="section-title"><HeartPulse size={19} /><div><h2>Health profile</h2><p>Your health information and dietary preferences.</p></div></div>
              <dl className="profile-detail-grid">
                <Detail label="Date of birth" value={formatDate(profile.dateOfBirth)} />
                <Detail label="Gender" value={profile.gender} />
                <Detail label="Height" value={profile.heightCm ? `${profile.heightCm} cm` : null} />
                <Detail label="Weight" value={profile.weightKg ? `${profile.weightKg} kg` : null} />
                <Detail label="BMI" value={profile.bmi ? `${profile.bmi} · ${displayBmiCategory(profile.bmiCategory)}` : null} />
                <Detail label="Health goal" value={profile.healthGoal} />
                <div className="profile-detail profile-detail--wide"><dt>Allergies</dt><dd>{profile.allergies.length ? <div className="allergy-list">{profile.allergies.map((allergy) => <span key={allergy}>{allergy}</span>)}</div> : 'None recorded'}</dd></div>
              </dl>
            </section>
            <section className="profile-section-card empty-content" aria-label="Your content">
              <h2>Your posts and recipes</h2><p>Your published content will appear here when it is available.</p>
            </section>
          </main>
          <aside className="right-rail" aria-label="Profile summary">
            <section className="side-card popular-card"><div className="rail-heading"><h2>Health summary</h2><HeartPulse size={18} /></div><div className="health-summary"><strong>{profile.bmi ?? '—'}</strong><span>{displayBmiCategory(profile.bmiCategory)}</span></div><p>Height and weight can be added to your health profile.</p></section>
            <section className="side-card standards-card"><h2>Account information</h2><p><b>Role:</b> {profile.roleName}</p><p><b>Status:</b> {profile.status}</p><p><b>Last updated:</b> {formatDate(profile.updatedAt)}</p><button className="rail-button" type="button" onClick={() => { setError(''); setIsEditing(true); }}>Update profile <ArrowLeft size={15} /></button></section>
          </aside>
        </div>
      </div>
      {isEditing && <ProfileEditDialog profile={profile} onClose={() => setIsEditing(false)} onSave={saveProfile} saving={saving} error={error} />}
    </div>
  );
}
