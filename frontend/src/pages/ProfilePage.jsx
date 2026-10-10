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
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
  ImageUp,
  RotateCcw,
  Save,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import ChatbotWidget from '../components/chatbot/ChatbotWidget';
import CommunitySideNav from '../components/community/CommunitySideNav';
import CommunityTopBar from '../components/community/CommunityTopBar';
import AuthModal from '../components/AuthModal';
import { changeMyPassword, deleteMyAvatar, getMyProfile, updateMyAvatar, updateMyProfile, verifyMyEmailChange } from '../services/profileApi';
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

const normalizeProfileText = (value, maxLength = Number.POSITIVE_INFINITY) => (
  typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
);

const getTrustedAvatarUrl = (value) => {
  if (typeof value !== 'string' || !value.trim()) return '';
  if (value.startsWith('/')) return value;
  try {
    const url = new URL(value);
    return (url.protocol === 'https:' || url.protocol === 'http:') ? url.toString() : '';
  } catch {
    return '';
  }
};

const PROFILE_NOTES = [
  'A clear photo and short bio help your NutriBot space feel recognizably yours.',
  'Your account details stay separate from health metrics, so you always know what you are editing.',
  'You can return at any time to update how your name, photo, and story appear across the experience.',
];

const publishProfileUpdate = (profile) => {
  if (profile.avatarUrl) {
    sessionStorage.setItem('nutribot-profile-avatar', profile.avatarUrl);
    localStorage.setItem('nutribot-profile-avatar', profile.avatarUrl);
  } else {
    sessionStorage.removeItem('nutribot-profile-avatar');
    localStorage.removeItem('nutribot-profile-avatar');
  }
  window.dispatchEvent(new CustomEvent('nutribot-profile-updated', { detail: profile }));
};

const normalizeGender = (gender) => {
  const value = String(gender ?? '').trim().toLowerCase();
  if (['female', 'nữ', 'nu'].includes(value)) return 'Female';
  if (['male', 'nam'].includes(value)) return 'Male';
  return '';
};

const toFormProfile = (profile = {}, fallbackUser = {}) => ({
  username: normalizeProfileText(profile.username ?? fallbackUser.username, 50),
  email: normalizeProfileText(profile.email ?? fallbackUser.email, 255),
  fullName: normalizeProfileText(profile.fullName, 150),
  avatarUrl: getTrustedAvatarUrl(profile.avatarUrl),
  bio: normalizeProfileText(profile.bio, 500),
  dateOfBirth: profile.dateOfBirth ? String(profile.dateOfBirth).slice(0, 10) : '',
  gender: normalizeGender(profile.gender),
  hasPassword: profile.hasPassword !== undefined ? Boolean(profile.hasPassword) : true,
  authProvider: profile.authProvider || 'LOCAL',
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

const EMPTY_PASSWORD_FORM = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

const validatePasswordChange = (passwords, hasExistingPassword = true) => {
  const errors = {};
  if (hasExistingPassword) {
    if (!passwords.currentPassword) errors.currentPassword = 'Please enter your current password.';
  }
  if (!passwords.newPassword) {
    errors.newPassword = 'Please enter a new password.';
  } else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(passwords.newPassword)) {
    errors.newPassword = 'Use 8+ characters with uppercase, lowercase, number, and special character (@$!%*?&).';
  } else if (hasExistingPassword && passwords.currentPassword && passwords.newPassword === passwords.currentPassword) {
    errors.newPassword = 'Your new password must be different from your current password.';
  }
  if (!passwords.confirmPassword) errors.confirmPassword = 'Please confirm your new password.';
  else if (passwords.confirmPassword !== passwords.newPassword) errors.confirmPassword = 'Passwords do not match.';
  return errors;
};

export default function ProfilePage() {
  const pageRef = useRef(null);
  const avatarInputRef = useRef(null);
  const savingRef = useRef(false);
  const fallbackUser = useMemo(() => getCurrentUserFromToken() ?? { username: '', email: '' }, []);
  const [profile, setProfile] = useState(() => toFormProfile(EMPTY_PROFILE, fallbackUser));
  const [savedProfile, setSavedProfile] = useState(() => toFormProfile(EMPTY_PROFILE, fallbackUser));
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedProfile, setHasLoadedProfile] = useState(false);
  const [profileLoadAttempt, setProfileLoadAttempt] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isEmailVerificationOpen, setIsEmailVerificationOpen] = useState(false);
  const [hasDismissedEmailVerification, setHasDismissedEmailVerification] = useState(false);
  const [emailVerificationTarget, setEmailVerificationTarget] = useState('');
  const [serverPendingEmail, setServerPendingEmail] = useState('');
  const [confirmedEmail, setConfirmedEmail] = useState('');
  const [notice, setNotice] = useState(null);
  const [activeNote, setActiveNote] = useState(0);
  const [headerQuery, setHeaderQuery] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [isAvatarViewerOpen, setIsAvatarViewerOpen] = useState(false);
  const [avatarRemoved, setAvatarRemoved] = useState(false);
  const [passwordForm, setPasswordForm] = useState(EMPTY_PASSWORD_FORM);
  const [passwordErrors, setPasswordErrors] = useState({});
  const [passwordVisibility, setPasswordVisibility] = useState({ currentPassword: false, newPassword: false, confirmPassword: false });
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setHasLoadedProfile(false);
    getMyProfile(controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        const mapped = toFormProfile(data, fallbackUser);
        const editableProfile = { ...mapped, email: data.pendingEmail || mapped.email };
        setProfile(editableProfile);
        setSavedProfile(editableProfile);
        setConfirmedEmail(mapped.email);
        setServerPendingEmail(data.pendingEmail || '');
        setHasLoadedProfile(true);
        publishProfileUpdate(editableProfile);
      })
      .catch((error) => {
        if (controller.signal.aborted || error?.name === 'AbortError') return;
        const emptyProfile = toFormProfile(EMPTY_PROFILE);
        setProfile(emptyProfile);
        setSavedProfile(emptyProfile);
        setNotice({ type: 'error', message: 'We could not load your saved profile. Please try again before making changes.' });
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [fallbackUser, profileLoadAttempt]);

  useEffect(() => () => {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
  }, [avatarPreview]);

  useEffect(() => {
    if (!notice) return undefined;
    const timeoutId = window.setTimeout(() => setNotice((current) => current === notice ? null : current), 3500);
    return () => window.clearTimeout(timeoutId);
  }, [notice]);

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
  // confirmedEmail stays active until the pending address is verified.
  const currentEmail = confirmedEmail;
  const pendingEmail = serverPendingEmail;
  const profileEmailMatchesPending = pendingEmail && profile.email.trim().toLowerCase() === pendingEmail.toLowerCase();
  const hasUnsubmittedEmailChange = profile.email.trim() && profile.email.trim() !== currentEmail;
  const completion = [profile.fullName, profile.email, profile.dateOfBirth, profile.gender, profile.bio].filter(Boolean).length * 20;
  const visibleAvatar = avatarPreview || (!avatarRemoved ? profile.avatarUrl : '');

  const scrollToSaveFeedback = () => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' })));
  };

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

  const retryProfileLoad = () => {
    setNotice(null);
    setProfileLoadAttempt((attempt) => attempt + 1);
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
    if (!hasLoadedProfile || savingRef.current) return;
    const nextErrors = validateProfile(profile);
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      setNotice({ type: 'error', message: 'Please review the highlighted fields before saving.' });
      scrollToSaveFeedback();
      return;
    }

    savingRef.current = true;
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
      const mapped = toFormProfile({
        ...profile,
        ...updated,
        ...avatarUpdate,
        email: updated.pendingEmail || updated.email,
        avatarUrl: nextAvatarUrl,
      }, fallbackUser);
      setProfile(mapped);
      setSavedProfile(mapped);
      setConfirmedEmail(updated.email || confirmedEmail);
      setServerPendingEmail(updated.pendingEmail || '');
      if (updated.pendingEmail) {
        setEmailVerificationTarget(updated.pendingEmail);
        setHasDismissedEmailVerification(false);
        setIsEmailVerificationOpen(true);
      }
      setAvatarFile(null);
      setAvatarPreview('');
      setAvatarRemoved(false);
      publishProfileUpdate(mapped);
      setNotice(updated.pendingEmail
        ? { type: 'info', message: `Profile saved. Your email change is pending verification. A code was sent to ${updated.pendingEmail}.` }
        : { type: 'success', message: 'Your profile has been updated successfully.' });
    } catch (error) {
      setNotice({ type: 'error', message: error?.message || 'We could not save your changes. Please try again.' });
    } finally {
      savingRef.current = false;
      setIsSaving(false);
      scrollToSaveFeedback();
    }
  };

  const handleEmailVerification = async (otp) => {
    const verified = await verifyMyEmailChange(otp);
    const confirmedProfile = { ...savedProfile, email: verified.email };
    setProfile(confirmedProfile);
    setSavedProfile(confirmedProfile);
    setConfirmedEmail(verified.email);
    setServerPendingEmail('');
    setNotice({ type: 'success', message: 'Your new email address has been verified.' });
    return verified;
  };

  const resendEmailVerification = async () => {
    const response = await updateMyProfile({
      username: savedProfile.username,
      fullName: savedProfile.fullName,
      email: pendingEmail,
      bio: savedProfile.bio || null,
      dateOfBirth: savedProfile.dateOfBirth || null,
      gender: savedProfile.gender || null,
    });
    setServerPendingEmail(response.pendingEmail || '');
  };

  const updatePasswordField = (event) => {
    const { name, value } = event.target;
    setPasswordForm((current) => ({ ...current, [name]: value }));
    setPasswordErrors((current) => ({ ...current, [name]: undefined }));
    if (notice?.type === 'info') setNotice(null);
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    const hasExistingPassword = Boolean(profile.hasPassword);
    const nextErrors = validatePasswordChange(passwordForm, hasExistingPassword);
    if (Object.keys(nextErrors).length) {
      setPasswordErrors(nextErrors);
      setNotice({ type: 'error', message: 'Please review the password requirements below.' });
      return;
    }

    try {
      setIsSavingPassword(true);
      const payload = {
        currentPassword: hasExistingPassword ? passwordForm.currentPassword : null,
        newPassword: passwordForm.newPassword,
        confirmPassword: passwordForm.confirmPassword,
      };
      await changeMyPassword(payload);
      setProfile((current) => ({ ...current, hasPassword: true }));
      setSavedProfile((current) => ({ ...current, hasPassword: true }));
      setIsPasswordDialogOpen(false);
      setPasswordForm(EMPTY_PASSWORD_FORM);
      setPasswordErrors({});
      setNotice({
        type: 'success',
        message: hasExistingPassword
          ? 'Your password has been changed successfully.'
          : 'Password set successfully! You can now log in with Google or your password.',
      });
    } catch (error) {
      setNotice({
        type: 'error',
        message: error?.message || 'Could not update your password. Please try again.',
      });
    } finally {
      setIsSavingPassword(false);
    }
  };

  const openPasswordDialog = () => {
    setPasswordForm(EMPTY_PASSWORD_FORM);
    setPasswordErrors({});
    setPasswordVisibility({ currentPassword: false, newPassword: false, confirmPassword: false });
    setIsPasswordDialogOpen(true);
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

          {notice && (
            <div className={`nb-profile-notice nb-profile-notice--${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}>
              {notice.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
              <span>{notice.message}</span>
              <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss notification"><X size={16} /></button>
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
              ) : !hasLoadedProfile ? (
                <div className="nb-profile-load-error" role="alert">
                  <AlertCircle size={22} />
                  <div>
                    <b>Your profile is unavailable.</b>
                    <span>Load the current account details before editing your profile.</span>
                  </div>
                  <button type="button" onClick={retryProfileLoad}>Try again</button>
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
                    <div><Mail size={17} /><input type="email" name="email" value={profile.email} onChange={updateField} placeholder="name@example.com" autoComplete="email" maxLength={255} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'email-error' : 'email-help'} /></div>
                    {errors.email ? <small id="email-error">{errors.email}</small> : <em id="email-help">{pendingEmail || hasUnsubmittedEmailChange ? `Current email: ${currentEmail}` : 'Used for account access and important updates.'}</em>}
                  </label>

                  {profileEmailMatchesPending && hasDismissedEmailVerification && !isEmailVerificationOpen && <button type="button" className="nb-profile-button nb-profile-button--secondary nb-profile-field--wide" onClick={() => { setEmailVerificationTarget(pendingEmail); setHasDismissedEmailVerification(false); setIsEmailVerificationOpen(true); }}>Reopen email verification</button>}

                  <label className="nb-profile-field nb-profile-field--wide">
                    <span>Password</span>
                    <div className="is-readonly nb-profile-password-summary">
                      <LockKeyhole size={17} />
                      <input
                        value={profile.hasPassword ? '••••••••••••' : 'Chưa thiết lập (Google)'}
                        readOnly
                        aria-readonly="true"
                        aria-label={profile.hasPassword ? 'Password is hidden' : 'No password set yet'}
                      />
                      <button type="button" onClick={openPasswordDialog}>
                        {profile.hasPassword ? 'Change password' : 'Set a password'}
                      </button>
                    </div>
                    <em>
                      {profile.hasPassword
                        ? 'Your password is hidden for your security.'
                        : 'Set a password to also log in with your username or email.'}
                    </em>
                  </label>

                  <label className="nb-profile-field">
                    <span>Date of birth</span>
                    <div><CalendarDays size={17} /><input type="date" name="dateOfBirth" value={profile.dateOfBirth} onChange={updateField} max={new Date().toISOString().slice(0, 10)} aria-invalid={Boolean(errors.dateOfBirth)} aria-describedby={errors.dateOfBirth ? 'dateOfBirth-error' : undefined} /></div>
                    {errors.dateOfBirth && <small id="dateOfBirth-error">{errors.dateOfBirth}</small>}
                  </label>

                  <label className="nb-profile-field">
                    <span>Gender</span>
                    <div className="nb-profile-select"><UserRound size={17} /><select name="gender" value={profile.gender} onChange={updateField}><option value="" disabled>Select gender</option><option value="Female">Female</option><option value="Male">Male</option></select><ChevronDown size={16} /></div>
                  </label>

                  <label className="nb-profile-field nb-profile-field--wide">
                    <span>Bio</span>
                    <div className="nb-profile-textarea"><textarea name="bio" value={profile.bio} onChange={updateField} placeholder="Share a little about your food journey..." maxLength={500} aria-invalid={Boolean(errors.bio)} aria-describedby={errors.bio ? 'bio-error' : 'bio-help'} /></div>
                    {errors.bio ? <small id="bio-error">{errors.bio}</small> : <em id="bio-help">{profile.bio.length}/500 characters</em>}
                  </label>

                </div>
              )}

              <footer className="nb-profile-actions">
                <button type="button" className="nb-profile-button nb-profile-button--secondary" onClick={resetForm} disabled={!isDirty || isSaving || isLoading || !hasLoadedProfile}><RotateCcw size={16} /> Discard changes</button>
                <button type="submit" className="nb-profile-button nb-profile-button--primary" disabled={!isDirty || isSaving || isLoading || !hasLoadedProfile}>{isSaving ? <LoaderCircle size={17} className="nb-profile-spinner" /> : <Save size={17} />} {isSaving ? 'Saving...' : 'Save profile'}</button>
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
                <p>{currentEmail || 'No email available'}</p>
                {pendingEmail && <small className="nb-profile-pending-email">New email: {pendingEmail}</small>}
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
      {isEmailVerificationOpen && emailVerificationTarget && (
        <AuthModal
          mode="verify-email"
          onClose={() => { setHasDismissedEmailVerification(true); setIsEmailVerificationOpen(false); }}
          verification={{
            email: emailVerificationTarget,
            purpose: 'emailChange',
            expirationSeconds: 30 * 60,
            onVerify: handleEmailVerification,
            onVerified: () => { setHasDismissedEmailVerification(false); setIsEmailVerificationOpen(false); },
            onResend: resendEmailVerification,
            onBack: () => { setHasDismissedEmailVerification(true); setIsEmailVerificationOpen(false); },
          }}
        />
      )}
      {isPasswordDialogOpen && (
        <div className="nb-password-dialog-backdrop" role="presentation" onClick={() => setIsPasswordDialogOpen(false)}>
          <form className="nb-password-dialog" role="dialog" aria-modal="true" aria-labelledby="change-password-title" onSubmit={handlePasswordSubmit} onClick={(event) => event.stopPropagation()} noValidate>
            <header>
              <div><p>Account security</p><h2 id="change-password-title">{profile.hasPassword ? 'Change password' : 'Set a password'}</h2></div>
              <button type="button" onClick={() => setIsPasswordDialogOpen(false)} aria-label="Close dialog"><X size={20} /></button>
            </header>
            <div className="nb-password-dialog__fields">
              {(profile.hasPassword
                ? [
                    ['currentPassword', 'Current password', 'current-password'],
                    ['newPassword', 'New password', 'new-password'],
                    ['confirmPassword', 'Confirm new password', 'new-password'],
                  ]
                : [
                    ['newPassword', 'New password', 'new-password'],
                    ['confirmPassword', 'Confirm new password', 'new-password'],
                  ]
              ).map(([name, label, autoComplete]) => (
                <label className="nb-profile-field" key={name}>
                  <span>{label}</span>
                  <div className="nb-password-input"><LockKeyhole size={17} /><input name={name} type={passwordVisibility[name] ? 'text' : 'password'} value={passwordForm[name]} onChange={updatePasswordField} autoComplete={autoComplete} aria-invalid={Boolean(passwordErrors[name])} aria-describedby={passwordErrors[name] ? `${name}-error` : undefined} /><button type="button" onClick={() => setPasswordVisibility((current) => ({ ...current, [name]: !current[name] }))} aria-label={passwordVisibility[name] ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}>{passwordVisibility[name] ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
                  {passwordErrors[name] && <small id={`${name}-error`}>{passwordErrors[name]}</small>}
                </label>
              ))}
              <p className="nb-password-hint">Use at least 8 characters, including uppercase, lowercase, a number, and one of @$!%*?&.</p>
            </div>
            <footer>
              <button type="button" className="nb-profile-button nb-profile-button--secondary" onClick={() => setIsPasswordDialogOpen(false)} disabled={isSavingPassword}>Cancel</button>
              <button type="submit" className="nb-profile-button nb-profile-button--primary" disabled={isSavingPassword}>
                {isSavingPassword ? <LoaderCircle size={17} className="nb-profile-spinner" /> : null}
                {isSavingPassword
                  ? (profile.hasPassword ? 'Changing...' : 'Setting...')
                  : (profile.hasPassword ? 'Change password' : 'Set password')}
              </button>
            </footer>
          </form>
        </div>
      )}
      <ChatbotWidget />
    </div>
  );
}
