import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Camera,
  CalendarDays,
  Check,
  ChevronDown,
  Leaf,
  LoaderCircle,
  LockKeyhole,
  Mail,
  ImageUp,
  RotateCcw,
  Save,
  ShieldCheck,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import ChatbotWidget from '../components/chatbot/ChatbotWidget';
import CommunitySideNav from '../components/community/CommunitySideNav';
import CommunityTopBar from '../components/community/CommunityTopBar';
import { deleteMyAvatar, getMyProfile, updateMyAvatar, updateMyProfile } from '../services/profileApi';
import { getCurrentUserFromToken } from '../utils/auth';
import freshProduce from '../assets/fresh-produce.jpg';
import '../styles/profile.css';

gsap.registerPlugin(ScrollTrigger, useGSAP);

const EMPTY_PROFILE = {
  username: '',
  email: '',
  fullName: '',
  avatarUrl: '',
  bio: '',
  dateOfBirth: '',
  gender: '',
};

const PROFILE_GUIDE = [
  {
    id: 'identity',
    icon: UserRound,
    title: 'Your identity',
    copy: 'Use the name you want NutriBot to show across your personal experience.',
  },
  {
    id: 'privacy',
    icon: ShieldCheck,
    title: 'Private by design',
    copy: 'Your personal details are used to personalize your account and stay protected.',
  },
  {
    id: 'next',
    icon: Leaf,
    title: 'Ready for nutrition',
    copy: 'A complete profile makes your future health and meal settings easier to manage.',
  },
];

const INTRO_WORDS = 'Keep your account details accurate so every NutriBot experience starts with the right context.'.split(' ');
const PROFILE_NOTES = [
  'A clear photo and short bio help your NutriBot space feel recognizably yours.',
  'Your account details stay separate from health metrics, so you always know what you are editing.',
  'You can return at any time to update how your name, photo, and story appear across the experience.',
];

const publishProfileUpdate = (profile) => {
  if (profile.avatarUrl) sessionStorage.setItem('nutribot-profile-avatar', profile.avatarUrl);
  else sessionStorage.removeItem('nutribot-profile-avatar');
  window.dispatchEvent(new CustomEvent('nutribot-profile-updated', { detail: profile }));
};

const normalizeGender = (gender) => {
  const value = String(gender ?? '').trim().toLowerCase();
  if (['female', 'nữ', 'nu'].includes(value)) return 'Female';
  if (['male', 'nam'].includes(value)) return 'Male';
  if (['other', 'khác', 'khac'].includes(value)) return 'Other';
  return '';
};

const toFormProfile = (profile = {}, fallbackUser = {}) => ({
  username: profile.username ?? fallbackUser.username ?? '',
  email: profile.email ?? fallbackUser.email ?? '',
  fullName: profile.fullName ?? '',
  avatarUrl: profile.avatarUrl ?? '',
  bio: profile.bio ?? '',
  dateOfBirth: profile.dateOfBirth ? String(profile.dateOfBirth).slice(0, 10) : '',
  gender: normalizeGender(profile.gender),
});

const getInitials = (profile) => {
  const source = profile.fullName || profile.username || 'NutriBot Member';
  return source
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'N';
};

const validateProfile = (profile) => {
  const errors = {};
  const fullName = profile.fullName.trim();
  if (!fullName) errors.fullName = 'Please enter your full name.';
  else if (fullName.length < 2 || fullName.length > 150) errors.fullName = 'Full name must contain 2 to 150 characters.';

  if (!profile.email.trim()) errors.email = 'Please enter your email address.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) errors.email = 'Please enter a valid email address.';

  if (profile.dateOfBirth && profile.dateOfBirth > new Date().toISOString().slice(0, 10)) {
    errors.dateOfBirth = 'Date of birth cannot be in the future.';
  }
  if (profile.bio.length > 500) errors.bio = 'Bio cannot exceed 500 characters.';
  return errors;
};

export default function ProfilePage() {
  const pageRef = useRef(null);
  const avatarInputRef = useRef(null);
  const fallbackUser = useMemo(() => getCurrentUserFromToken() ?? {}, []);
  const [profile, setProfile] = useState(() => toFormProfile(EMPTY_PROFILE, fallbackUser));
  const [savedProfile, setSavedProfile] = useState(() => toFormProfile(EMPTY_PROFILE, fallbackUser));
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [activeGuide, setActiveGuide] = useState('identity');
  const [activeNote, setActiveNote] = useState(0);
  const [headerQuery, setHeaderQuery] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [isAvatarViewerOpen, setIsAvatarViewerOpen] = useState(false);
  const [avatarRemoved, setAvatarRemoved] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    getMyProfile(controller.signal)
      .then((data) => {
        const mapped = toFormProfile(data, fallbackUser);
        setProfile(mapped);
        setSavedProfile(mapped);
        publishProfileUpdate(mapped);
      })
      .catch((error) => {
        if (error?.name !== 'AbortError') {
          setNotice({ type: 'error', message: 'We could not load your saved profile. You can still review the available account details.' });
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [fallbackUser]);

  useEffect(() => () => {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
  }, [avatarPreview]);

  useGSAP(() => {
    const media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.from('.nb-profile-hero__copy > *', {
        y: 22,
        opacity: 0,
        duration: 0.75,
        stagger: 0.08,
        ease: 'power3.out',
      });
      gsap.fromTo('.nb-profile-hero__image',
        { scale: 0.88, opacity: 0.72 },
        {
          scale: 1.06,
          opacity: 0.42,
          ease: 'none',
          scrollTrigger: {
            trigger: '.nb-profile-hero',
            start: 'top top+=76',
            end: 'bottom top+=76',
            scrub: true,
          },
        });
      gsap.fromTo('.nb-profile-intro__word',
        { opacity: 0.15 },
        {
          opacity: 1,
          stagger: 0.08,
          ease: 'none',
          scrollTrigger: {
            trigger: '.nb-profile-intro',
            start: 'top 88%',
            end: 'bottom 64%',
            scrub: true,
          },
        });
      gsap.from('.nb-profile-aside > *', {
        y: 70,
        scale: 0.94,
        opacity: 0,
        stagger: 0.16,
        duration: 0.8,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: '.nb-profile-grid',
          start: 'top 76%',
        },
      });
    });
    return () => media.revert();
  }, { scope: pageRef });

  const isDirty = JSON.stringify(profile) !== JSON.stringify(savedProfile) || Boolean(avatarFile) || avatarRemoved;
  const completion = [profile.fullName, profile.email, profile.dateOfBirth, profile.gender, profile.bio].filter(Boolean).length * 20;
  const visibleAvatar = avatarPreview || (!avatarRemoved ? profile.avatarUrl : '');

  const updateField = (event) => {
    const { name, value } = event.target;
    setProfile((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
    if (notice?.type === 'success') setNotice(null);
  };

  const resetForm = () => {
    setProfile(savedProfile);
    setAvatarFile(null);
    setAvatarPreview('');
    setAvatarRemoved(false);
    setErrors({});
    setNotice(null);
  };

  const handleAvatarChange = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setNotice({ type: 'error', message: 'Choose a JPG, PNG, or WebP image.' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setNotice({ type: 'error', message: 'Profile images must be 5 MB or smaller.' });
      return;
    }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setAvatarRemoved(false);
    setNotice(null);
  };

  const removeAvatar = () => {
    setAvatarFile(null);
    setAvatarPreview('');
    setAvatarRemoved(Boolean(savedProfile.avatarUrl));
    setProfile((current) => ({ ...current, avatarUrl: '' }));
    setNotice(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = validateProfile(profile);
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      setNotice({ type: 'error', message: 'Please review the highlighted fields before saving.' });
      return;
    }

    setIsSaving(true);
    setNotice(null);
    try {
      const payload = {
        username: profile.username.trim(),
        fullName: profile.fullName.trim(),
        email: profile.email.trim(),
        bio: profile.bio.trim() || null,
        dateOfBirth: profile.dateOfBirth || null,
        gender: profile.gender || null,
      };
      const updated = await updateMyProfile(payload);
      let avatarUpdate = {};
      if (avatarFile) avatarUpdate = await updateMyAvatar(avatarFile);
      else if (avatarRemoved) await deleteMyAvatar();
      const nextAvatarUrl = avatarRemoved ? '' : (avatarUpdate.avatarUrl ?? profile.avatarUrl);
      const mapped = toFormProfile({ ...profile, ...updated, ...avatarUpdate, avatarUrl: nextAvatarUrl }, fallbackUser);
      setProfile(mapped);
      setSavedProfile(mapped);
      setAvatarFile(null);
      setAvatarPreview('');
      setAvatarRemoved(false);
      publishProfileUpdate(mapped);
      setNotice({ type: 'success', message: 'Your profile has been updated successfully.' });
    } catch (error) {
      setNotice({ type: 'error', message: error?.message || 'We could not save your changes. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="community-page nb-profile-page" ref={pageRef}>
      <CommunityTopBar query={headerQuery} onQueryChange={setHeaderQuery} activePath="/profile" />
      <div className="community-shell">
        <CommunitySideNav activePath="/profile" />
        <span className="community-sidenav-spacer" aria-hidden="true" />

        <main className="nb-profile-main">
          <section className="nb-profile-hero" aria-labelledby="profile-title">
            <img className="nb-profile-hero__image" src={freshProduce} alt="" />
            <div className="nb-profile-hero__shade" />
            <div className="nb-profile-hero__copy">
              <p>Personal account</p>
              <h1 id="profile-title">
                Your profile, <span className="nb-profile-title-image" aria-hidden="true" /> made for you.
              </h1>
              <span>Keep the essentials current and let NutriBot build from a better understanding of you.</span>
            </div>
            <button
              type="button"
              className="nb-profile-avatar"
              onClick={() => visibleAvatar && setIsAvatarViewerOpen(true)}
              aria-label={visibleAvatar ? 'View profile photo' : 'No profile photo'}
              aria-haspopup={visibleAvatar ? 'dialog' : undefined}
              disabled={!visibleAvatar}
            >
              {visibleAvatar ? <span className="nb-profile-avatar__crop"><img src={visibleAvatar} alt="Your profile preview" /></span> : <span>{getInitials(profile)}</span>}
              <i><Camera size={14} strokeWidth={2.5} /></i>
            </button>
            <input ref={avatarInputRef} className="nb-profile-avatar-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarChange} tabIndex={-1} />
          </section>

          <p className="nb-profile-intro" aria-label={INTRO_WORDS.join(' ')}>
            {INTRO_WORDS.map((word, index) => <span className="nb-profile-intro__word" key={`${word}-${index}`}>{word} </span>)}
          </p>

          {notice && (
            <div className={`nb-profile-notice nb-profile-notice--${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}>
              {notice.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
              <span>{notice.message}</span>
            </div>
          )}

          <div className="nb-profile-grid">
            <form className="nb-profile-form" onSubmit={handleSubmit} noValidate>
              <header>
                <div>
                  <p>Account details</p>
                  <h2>Tell us who you are</h2>
                </div>
                <span className="nb-profile-secure"><LockKeyhole size={14} /> Secure profile</span>
              </header>

              {isLoading ? (
                <div className="nb-profile-loading" role="status">
                  <LoaderCircle size={25} className="nb-profile-spinner" />
                  <span>Loading your profile...</span>
                </div>
              ) : (
                <div className="nb-profile-fields">
                  <div className="nb-profile-photo-field nb-profile-field--wide">
                    <div className="nb-profile-photo-preview">
                      {visibleAvatar ? <img src={visibleAvatar} alt="Selected profile" /> : <span>{getInitials(profile)}</span>}
                    </div>
                    <div className="nb-profile-photo-copy">
                      <b>Profile photo</b>
                      <span>JPG, PNG or WebP. Maximum file size is 5 MB.</span>
                      <div>
                        <button type="button" onClick={() => avatarInputRef.current?.click()}><ImageUp size={15} /> {visibleAvatar ? 'Change photo' : 'Upload photo'}</button>
                        {visibleAvatar && <button type="button" className="is-danger" onClick={removeAvatar}><Trash2 size={15} /> Remove</button>}
                      </div>
                    </div>
                  </div>

                  <label className="nb-profile-field nb-profile-field--wide">
                    <span>Username</span>
                    <div className="is-readonly"><UserRound size={17} /><input value={profile.username} readOnly aria-readonly="true" /></div>
                    <em>Your username is tied to your account and cannot be changed here.</em>
                  </label>

                  <label className="nb-profile-field nb-profile-field--wide">
                    <span>Full name</span>
                    <div><UserRound size={17} /><input name="fullName" value={profile.fullName} onChange={updateField} placeholder="Your full name" autoComplete="name" maxLength={150} aria-invalid={Boolean(errors.fullName)} aria-describedby={errors.fullName ? 'fullName-error' : undefined} /></div>
                    {errors.fullName && <small id="fullName-error">{errors.fullName}</small>}
                  </label>

                  <label className="nb-profile-field nb-profile-field--wide">
                    <span>Email address</span>
                    <div><Mail size={17} /><input type="email" name="email" value={profile.email} onChange={updateField} placeholder="name@example.com" autoComplete="email" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'email-error' : 'email-help'} /></div>
                    {errors.email ? <small id="email-error">{errors.email}</small> : <em id="email-help">Used for account access and important updates.</em>}
                  </label>

                  <label className="nb-profile-field">
                    <span>Date of birth</span>
                    <div><CalendarDays size={17} /><input type="date" name="dateOfBirth" value={profile.dateOfBirth} onChange={updateField} max={new Date().toISOString().slice(0, 10)} aria-invalid={Boolean(errors.dateOfBirth)} aria-describedby={errors.dateOfBirth ? 'dateOfBirth-error' : undefined} /></div>
                    {errors.dateOfBirth && <small id="dateOfBirth-error">{errors.dateOfBirth}</small>}
                  </label>

                  <label className="nb-profile-field">
                    <span>Gender</span>
                    <div className="nb-profile-select"><UserRound size={17} /><select name="gender" value={profile.gender} onChange={updateField}><option value="">Prefer not to say</option><option value="Female">Female</option><option value="Male">Male</option><option value="Other">Other</option></select><ChevronDown size={16} /></div>
                  </label>

                  <label className="nb-profile-field nb-profile-field--wide">
                    <span>Bio</span>
                    <div className="nb-profile-textarea"><textarea name="bio" value={profile.bio} onChange={updateField} placeholder="Share a little about your food journey..." maxLength={500} aria-invalid={Boolean(errors.bio)} aria-describedby={errors.bio ? 'bio-error' : 'bio-help'} /></div>
                    {errors.bio ? <small id="bio-error">{errors.bio}</small> : <em id="bio-help">{profile.bio.length}/500 characters</em>}
                  </label>

                </div>
              )}

              <footer className="nb-profile-actions">
                <button type="button" className="nb-profile-button nb-profile-button--secondary" onClick={resetForm} disabled={!isDirty || isSaving || isLoading}><RotateCcw size={16} /> Discard changes</button>
                <button type="submit" className="nb-profile-button nb-profile-button--primary" disabled={!isDirty || isSaving || isLoading}>{isSaving ? <LoaderCircle size={17} className="nb-profile-spinner" /> : <Save size={17} />} {isSaving ? 'Saving...' : 'Save profile'}</button>
              </footer>
            </form>

            <aside className="nb-profile-aside" aria-label="Profile summary">
              <div className="nb-profile-completion">
                <div className="nb-profile-completion__head"><span>Profile completion</span><b>{completion}%</b></div>
                <div className="nb-profile-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={completion}><span style={{ width: `${completion}%` }} /></div>
                <p>{completion === 100 ? 'Everything looks good. Your essentials are complete.' : 'Add the missing details to complete your personal profile.'}</p>
              </div>

              <div className="nb-profile-identity-card">
                <div className="nb-profile-identity-card__avatar">{visibleAvatar ? <img src={visibleAvatar} alt="" /> : getInitials(profile)}</div>
                <span className="nb-profile-identity-card__username">@{profile.username || 'member'}</span>
                <h3>{profile.fullName || profile.username || 'NutriBot Member'}</h3>
                <p>{profile.email || 'No email available'}</p>
                {profile.bio && <blockquote>{profile.bio}</blockquote>}
              </div>

              <div className="nb-profile-feedback" aria-live="polite">
                <blockquote>“{PROFILE_NOTES[activeNote]}”</blockquote>
                <footer>
                  <span>{activeNote + 1} / {PROFILE_NOTES.length}</span>
                  <div>
                    <button type="button" onClick={() => setActiveNote((current) => (current - 1 + PROFILE_NOTES.length) % PROFILE_NOTES.length)} aria-label="Previous profile note"><ArrowLeft size={15} /></button>
                    <button type="button" onClick={() => setActiveNote((current) => (current + 1) % PROFILE_NOTES.length)} aria-label="Next profile note"><ArrowRight size={15} /></button>
                  </div>
                </footer>
              </div>
            </aside>
          </div>

          <section className="nb-profile-guide" aria-label="Profile guide">
            {PROFILE_GUIDE.map(({ id, icon: Icon, title, copy }) => {
              const isActive = activeGuide === id;
              return (
                <button key={id} type="button" className={isActive ? 'is-active' : ''} onMouseEnter={() => setActiveGuide(id)} onFocus={() => setActiveGuide(id)} onClick={() => setActiveGuide(id)} aria-expanded={isActive}>
                  <Icon size={21} />
                  <span><b>{title}</b>{isActive && <small>{copy}</small>}</span>
                </button>
              );
            })}
          </section>
        </main>
      </div>
      {isAvatarViewerOpen && visibleAvatar && (
        <div className="nb-avatar-preview-backdrop" role="presentation" onClick={() => setIsAvatarViewerOpen(false)}>
          <section className="nb-avatar-preview-dialog" role="dialog" aria-modal="true" aria-label="Profile photo" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="nb-avatar-preview-close" onClick={() => setIsAvatarViewerOpen(false)} aria-label="Close photo preview"><X size={20} /></button>
            <img src={visibleAvatar} alt="Profile photo enlarged" />
          </section>
        </div>
      )}
      <ChatbotWidget />
    </div>
  );
}
