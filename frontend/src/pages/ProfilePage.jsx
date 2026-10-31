import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  AlertCircle,
  CalendarDays,
  Camera,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  Grid3X3,
  LoaderCircle,
  LockKeyhole,
  Mail,
  RotateCcw,
  Save,
  UserRound,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import ChatbotWidget from '../components/chatbot/ChatbotWidget';
import CommunitySideNav from '../components/community/CommunitySideNav';
import CommunityTopBar from '../components/community/CommunityTopBar';
import AuthModal from '../components/AuthModal';
import { useToast } from '../components/notifications/ToastProvider';
import { changeMyPassword, deleteMyAvatar, getMyProfile, getMyRecipes, updateMyAvatar, updateMyProfile, verifyMyEmailChange } from '../services/profileApi';
import { getPublicProfileContent } from '../services/publicProfileApi';
import { getCurrentUserFromToken } from '../utils/auth';
import ImageWithFallback from '../components/ImageWithFallback';
import DishDetailModal from '../components/community/DishDetailModal';
import '../styles/profile.css';
import '../styles/public-profile.css';
import '../styles/public-profile-recipe-button.css';

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

const profileViewState = { tab: 'info', scrollY: 0 };

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
  const { toast } = useToast();
  const location = useLocation();
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
  const [headerQuery, setHeaderQuery] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [avatarRemoved, setAvatarRemoved] = useState(false);
  const [passwordForm, setPasswordForm] = useState(EMPTY_PASSWORD_FORM);
  const [passwordErrors, setPasswordErrors] = useState({});
  const [passwordVisibility, setPasswordVisibility] = useState({ currentPassword: false, newPassword: false, confirmPassword: false });
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [activeTab, setActiveTab] = useState(() => location.state?.profileTab || profileViewState.tab || 'info');
  const [myPosts, setMyPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsLoaded, setPostsLoaded] = useState(false);
  const [postsError, setPostsError] = useState('');
  const [myRecipes, setMyRecipes] = useState([]);
  const [recipesLoading, setRecipesLoading] = useState(false);
  const [recipesLoaded, setRecipesLoaded] = useState(false);
  const [recipesError, setRecipesError] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState(null);

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

  useEffect(() => {
    if (activeTab !== 'posts' || postsLoaded || !profile.username) return undefined;
    const controller = new AbortController();
    setPostsLoading(true);
    setPostsError('');
    getPublicProfileContent(profile.username, { signal: controller.signal })
      .then((content) => {
        if (controller.signal.aborted) return;
        setMyPosts(Array.isArray(content?.posts) ? content.posts : []);
        setPostsLoaded(true);
      })
      .catch((error) => {
        if (controller.signal.aborted || error?.name === 'AbortError') return;
        setMyPosts([]);
        setPostsError('We could not load your published posts. Please try again.');
        setPostsLoaded(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setPostsLoading(false);
      });
    return () => controller.abort();
  }, [activeTab, postsLoaded, profile.username]);

  useEffect(() => {
    if (activeTab !== 'recipes' || recipesLoaded) return undefined;
    const controller = new AbortController();
    setRecipesLoading(true);
    getMyRecipes(controller.signal)
      .then((recipes) => {
        if (!controller.signal.aborted) {
          setMyRecipes(Array.isArray(recipes) ? recipes : []);
          setRecipesLoaded(true);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setMyRecipes([]);
          setRecipesError('We could not load your approved recipes. Please try again.');
          setRecipesLoaded(true);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setRecipesLoading(false);
        }
      });
    return () => controller.abort();
  }, [activeTab, recipesLoaded]);

  useEffect(() => {
    profileViewState.tab = activeTab;
    profileViewState.scrollY = window.scrollY;
    return () => {
      profileViewState.tab = activeTab;
      profileViewState.scrollY = window.scrollY;
    };
  }, [activeTab]);

  useEffect(() => {
    if (!hasLoadedProfile) return undefined;
    const scrollY = location.state?.profileScrollY ?? profileViewState.scrollY;
    if (!scrollY) return undefined;
    const frame = window.requestAnimationFrame(() => window.scrollTo({ top: scrollY, left: 0, behavior: 'auto' }));
    return () => window.cancelAnimationFrame(frame);
  }, [hasLoadedProfile, location.state?.profileScrollY]);

  useEffect(() => {
    if (!notice) return;
    toast[notice.type === 'error' ? 'error' : notice.type === 'info' ? 'info' : 'success'](notice.message);
  }, [notice, toast]);

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

  const profileReturnTo = `${location.pathname}${location.search}${location.hash}`;

  return (
    <div className="community-page nb-profile-page" ref={pageRef}>
      <CommunityTopBar query={headerQuery} onQueryChange={setHeaderQuery} activePath="/profile" />
      <div className="community-shell">
        <CommunitySideNav activePath="/profile" />
        <span className="community-sidenav-spacer" aria-hidden="true" />

        <main className="nb-profile-main">
          <section className="nb-profile-hero nb-profile-hero--compact" aria-labelledby="profile-title">
            <div className="nb-profile-hero__copy">
              <p>Personal profile</p>
              <h1 id="profile-title">{profile.fullName || profile.username || 'Your profile'}</h1>
              {profile.username && <span className="nb-profile-hero__username">@{profile.username}</span>}
              {profile.bio && <blockquote>{profile.bio}</blockquote>}
            </div>
            <button
              type="button"
              className="nb-profile-avatar"
              onClick={() => avatarInputRef.current?.click()}
              aria-label={visibleAvatar ? 'Change profile photo' : 'Upload profile photo'}
            >
              {visibleAvatar ? <span className="nb-profile-avatar__crop"><img src={visibleAvatar} alt="Your profile preview" /></span> : <span>{getInitials(profile)}</span>}
              <i><Camera size={14} strokeWidth={2.5} /></i>
            </button>
            <input ref={avatarInputRef} className="nb-profile-avatar-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarChange} tabIndex={-1} />
          </section>

          <div className="nb-profile-grid">
            <nav className="public-profile-tabs nb-profile-tabs" aria-label="Profile content">
              <button type="button" className={activeTab === 'info' ? 'is-active' : ''} onClick={() => setActiveTab('info')}>
                <Grid3X3 size={16} /> About
              </button>
              <button type="button" className={activeTab === 'posts' ? 'is-active' : ''} onClick={() => setActiveTab('posts')}>
                <Grid3X3 size={16} /> Posts
              </button>
              <button type="button" className={activeTab === 'recipes' ? 'is-active' : ''} onClick={() => setActiveTab('recipes')}>
                <UtensilsCrossed size={16} /> Recipes
              </button>
            </nav>

            {activeTab === 'info' && (
            <form className="nb-profile-form" onSubmit={handleSubmit} noValidate>
              <header>
                <div>
                  <p>Personal information</p>
                  <h2>About you</h2>
                  <span className="nb-profile-form-intro">A little about you and your journey with NutriBot.</span>
                </div>
                <span className="nb-profile-secure"><LockKeyhole size={14} /> Secure profile</span>
              </header>

              {!isLoading && hasLoadedProfile && (
                <section className={`nb-profile-completion-inline${completion === 100 ? ' is-complete' : ''}`} aria-label="Profile completion">
                  <div className="nb-profile-completion-copy">
                    <span className="nb-profile-completion-status">
                      {completion === 100 && <Check size={15} strokeWidth={2.5} />}
                      {completion === 100 ? 'Profile complete' : 'Profile progress'}
                    </span>
                    <small>{completion === 100 ? 'Your essential details are up to date.' : 'Complete the essential details in your profile.'}</small>
                  </div>
                  <strong>{completion}%</strong>
                  {completion < 100 && <span className="nb-profile-completion-track" aria-hidden="true"><span style={{ width: `${completion}%` }} /></span>}
                </section>
              )}

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
                  <div className="nb-profile-section-label nb-profile-field--wide">
                    <span>Basic details</span>
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

                  <div className="nb-profile-section-label nb-profile-section-label--security nb-profile-field--wide">
                    <span>Account security</span>
                  </div>

                  <label className="nb-profile-field nb-profile-field--wide nb-profile-security-field">
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
                    {errors.bio ? <small id="bio-error">{errors.bio}</small> : <em id="bio-help">A short introduction shown on your public profile. {profile.bio.length}/500 characters</em>}
                  </label>

                </div>
              )}

              <footer className="nb-profile-actions">
                <button type="button" className="nb-profile-button nb-profile-button--secondary" onClick={resetForm} disabled={!isDirty || isSaving || isLoading || !hasLoadedProfile}><RotateCcw size={16} /> Discard changes</button>
                <button type="submit" className="nb-profile-button nb-profile-button--primary" disabled={!isDirty || isSaving || isLoading || !hasLoadedProfile}>{isSaving ? <LoaderCircle size={17} className="nb-profile-spinner" /> : <Save size={17} />} {isSaving ? 'Saving...' : 'Save profile'}</button>
              </footer>
            </form>
            )}

            {activeTab === 'posts' && (
              <section className="nb-profile-content nb-profile-posts" aria-label="Your published posts">
                <header className="nb-profile-content-head">
                  <div>
                    <p>Published stories</p>
                    <h2>Your posts</h2>
                  </div>
                  <Link className="nb-profile-manage-link" to="/community/my-blogs">Manage posts</Link>
                </header>
                {postsLoading ? (
                  <div className="nb-profile-loading" role="status">
                    <LoaderCircle size={25} className="nb-profile-spinner" />
                    <span>Loading your published posts...</span>
                  </div>
                ) : postsError ? (
                  <div className="nb-profile-content-error" role="alert">
                    <span>{postsError}</span>
                    <button type="button" onClick={() => setPostsLoaded(false)}>Try again</button>
                  </div>
                ) : myPosts.length > 0 ? (
                  <div className="public-profile-grid">
                    {myPosts.map((post) => (
                      <Link
                        key={`${post.type}-${post.id}`}
                        to={`/community/posts/${post.id}`}
                        state={{ returnTo: profileReturnTo, returnState: { profileTab: 'posts', profileScrollY: window.scrollY } }}
                        className="public-profile-grid-item"
                      >
                        {post.image ? <ImageWithFallback src={post.image} alt={post.title || 'Post'} loading="lazy" /> : <span>{post.title || 'Published post'}</span>}
                        {post.images?.length > 1 && <small aria-label="Gallery">{post.images.length}</small>}
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="public-profile-empty">No published posts yet. Your public stories will appear here.</p>
                )}
              </section>
            )}

            {activeTab === 'recipes' && (
              <section className="nb-profile-content nb-profile-recipes" aria-label="Your recipes">
                <header className="nb-profile-content-head">
                  <div>
                    <p>Approved contributions</p>
                    <h2>Your recipes</h2>
                  </div>
                </header>
                {recipesLoading ? (
                  <div className="nb-profile-loading" role="status">
                    <LoaderCircle size={25} className="nb-profile-spinner" />
                    <span>Loading your recipes...</span>
                  </div>
                ) : recipesError ? (
                  <div className="nb-profile-content-error" role="alert">
                    <span>{recipesError}</span>
                    <button type="button" onClick={() => { setRecipesError(''); setRecipesLoaded(false); }}>Try again</button>
                  </div>
                ) : myRecipes.length > 0 ? (
                  <div className="public-profile-recipes">
                    {myRecipes.map((recipe) => (
                      <button
                        type="button"
                        key={`${recipe.recipeId ?? recipe.dishId}`}
                        onClick={() => setSelectedRecipe(recipe)}
                        className="public-profile-recipe"
                      >
                        {(recipe.imageUrl || recipe.image) ? (
                          <ImageWithFallback src={recipe.imageUrl || recipe.image} alt={recipe.name || recipe.title || ''} loading="lazy" />
                        ) : (
                          <span className="public-profile-recipe-fallback"><UtensilsCrossed size={20} /></span>
                        )}
                        <div>
                          <h2>{recipe.name || recipe.title}</h2>
                          {recipe.description && <p>{recipe.description}</p>}
                          <small>
                            {(recipe.preparationTime || recipe.prepTimeMinutes || recipe.prepTime || '')}
                            {recipe.servings ? ` · Serves ${recipe.servings}` : ''}
                          </small>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="public-profile-empty">No recipes yet. Recipes created from your blog posts with recipe consent will appear here.</p>
                )}
              </section>
            )}

            {selectedRecipe && (
              <DishDetailModal
                meal={selectedRecipe}
                onClose={() => setSelectedRecipe(null)}
              />
            )}

          </div>

        </main>
      </div>
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
