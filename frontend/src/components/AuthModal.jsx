import { Eye, EyeOff, LoaderCircle, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ApiError } from '../services/apiClient';
import { loginAccount, registerAccount, resendRegistrationOtp, verifyRegistrationOtp } from '../services/authApi';
import AuthToast from './AuthToast';
import EmailVerificationStep from './auth/EmailVerificationStep';
import '../styles/auth-popup.css';

const emptyForm = { name: '', username: '', email: '', password: '', confirmPassword: '' };
const OTP_VALIDITY_SECONDS = 5 * 60;
const EMAIL_CHANGE_OTP_VALIDITY_SECONDS = 30 * 60;
const PENDING_OTP_STORAGE_KEY = 'nutribot-pending-email-verification';

function normalizeEmail(value) {
  return String(value || '').trim().toLocaleLowerCase();
}

function isEmail(value) {
  return /^\S+@\S+\.\S+$/.test(value);
}

function getPendingOtp() {
  if (typeof window === 'undefined') return null;
  try {
    const pendingOtp = JSON.parse(window.sessionStorage.getItem(PENDING_OTP_STORAGE_KEY) || 'null');
    return isEmail(pendingOtp?.email) && Number.isFinite(pendingOtp?.expiresAt) ? pendingOtp : null;
  } catch {
    return null;
  }
}

function savePendingOtp(email, expiresAt = Date.now() + OTP_VALIDITY_SECONDS * 1000) {
  if (typeof window === 'undefined' || !isEmail(email)) return null;
  const pendingOtp = { email: normalizeEmail(email), expiresAt };
  window.sessionStorage.setItem(PENDING_OTP_STORAGE_KEY, JSON.stringify(pendingOtp));
  return pendingOtp;
}

function clearPendingOtp() {
  if (typeof window !== 'undefined') window.sessionStorage.removeItem(PENDING_OTP_STORAGE_KEY);
}

function isUnverifiedAccountError(error) {
  const message = String(error?.message || '').toLocaleLowerCase();
  return message.includes('chưa xác thực') || message.includes('not verified') || message.includes('verify your email');
}

function otpErrorState(error) {
  const message = (error?.message || '').toLocaleLowerCase();
  if (message.includes('incorrect')) return 'invalid';
  if (message.includes('hết hạn') || message.includes('expired')) return 'expired';
  if (message.includes('đã sử dụng') || message.includes('already been used')) return 'alreadyUsed';
  if (message.includes('quá nhiều') || message.includes('too many')) return 'tooManyAttempts';
  return message.includes('otp') || message.includes('mã') || message.includes('invalid') ? 'invalid' : 'error';
}

function validateSignup(form) {
  const errors = {};
  if (!form.name.trim()) errors.name = 'Please enter your full name.';
  if (!form.username.trim()) errors.username = 'Please enter a username.';
  else if (form.username.trim().length < 3) errors.username = 'Username must be at least 3 characters.';
  if (!form.email.trim()) errors.email = 'Please enter your email.';
  else if (!/^\S+@\S+\.\S+$/.test(form.email)) errors.email = 'Please enter a valid email address.';
  if (!form.password) errors.password = 'Please enter your password.';
  else if (form.password.length < 8) errors.password = 'Password must be at least 8 characters.';
  if (!form.confirmPassword) errors.confirmPassword = 'Please confirm your password.';
  else if (form.password !== form.confirmPassword) errors.confirmPassword = 'Passwords do not match.';
  return errors;
}

function validateLogin(form) {
  const errors = {};
  if (!form.email.trim()) errors.email = 'Please enter your email or username.';
  if (!form.password) errors.password = 'Please enter your password.';
  return errors;
}

export default function AuthModal({ mode, onClose, onSubmit, onGoogle, onAuthenticated, verification = {}, backdropClassName = '' }) {
  const [form, setForm] = useState(emptyForm);
  const [touched, setTouched] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState(() => verification.email || getPendingOtp()?.email || '');
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationState, setVerificationState] = useState('idle');
  const [otpExpiresAt, setOtpExpiresAt] = useState(() => verification.onVerify ? verification.expiresAt || null : getPendingOtp()?.expiresAt || null);
  const [otpRemainingSeconds, setOtpRemainingSeconds] = useState(null);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState('');
  const isVerification = mode === 'verify-email';
  const isSignup = mode === 'signup';
  const validationErrors = isSignup ? validateSignup(form) : validateLogin(form);
  const fieldError = (name) => touched[name] && validationErrors[name];
  const email = verification.email || registeredEmail;

  useEffect(() => {
    const close = (event) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [onClose]);

  const rememberOtp = (email, expiresAt) => {
    const pendingOtp = savePendingOtp(email, expiresAt);
    if (!pendingOtp) return false;
    setRegisteredEmail(pendingOtp.email);
    setOtpExpiresAt(pendingOtp.expiresAt);
    return true;
  };

  useEffect(() => {
    if (!isVerification || !email || !otpExpiresAt) {
      setOtpRemainingSeconds(null);
      return undefined;
    }
    const updateRemainingTime = () => {
      const seconds = Math.max(0, Math.ceil((otpExpiresAt - Date.now()) / 1000));
      setOtpRemainingSeconds(seconds);
      if (seconds === 0) setVerificationState((current) => current === 'verified' ? current : 'expired');
    };
    updateRemainingTime();
    const timer = window.setInterval(updateRemainingTime, 1000);
    return () => window.clearInterval(timer);
  }, [isVerification, email, otpExpiresAt]);

  const update = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setError('');
  };
  const touch = (name) => setTouched((current) => ({ ...current, [name]: true }));

  const submit = async (event) => {
    event.preventDefault();
    const fieldNames = isSignup ? ['name', 'username', 'email', 'password', 'confirmPassword'] : ['email', 'password'];
    setTouched(Object.fromEntries(fieldNames.map((name) => [name, true])));
    if (Object.keys(validationErrors).length) return;

    setSubmitting(true);
    setError('');
    try {
      const data = isSignup
        ? await registerAccount({ fullName: form.name.trim(), username: form.username.trim(), email: form.email.trim(), password: form.password })
        : await loginAccount({ usernameOrEmail: form.email.trim(), password: form.password });
      if (isSignup) {
        rememberOtp(form.email.trim());
        setVerificationCode('');
        setVerificationState('idle');
        onSubmit?.(null, 'verify-email');
        return;
      }
      if (data.token) localStorage.setItem('nutribot-auth-token', data.token);
      if (data.username && data.role) {
        localStorage.setItem('nutribot-user', JSON.stringify({ username: data.username, role: data.role }));
      }
      onAuthenticated?.(data, mode);
      setSuccess('Welcome back.');
      window.setTimeout(onClose, 700);
    } catch (requestError) {
      const message = requestError instanceof ApiError ? requestError.message : requestError.message || 'Something went wrong. Please try again.';
      setError(message);
      if (!isSignup && isUnverifiedAccountError(requestError)) {
        const pendingOtp = getPendingOtp();
        setPendingVerificationEmail(pendingOtp?.email || (isEmail(form.email) ? normalizeEmail(form.email) : ''));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const verifyOtp = async (otpCode) => {
    if (!email || otpCode.length !== 6) return;
    if (otpRemainingSeconds === 0) {
      setVerificationState('expired');
      return;
    }
    setVerificationState('verifying');
    try {
      if (verification.onVerify) {
        const data = await verification.onVerify(otpCode);
        setVerificationState('verified');
        verification.onVerified?.(data);
        return;
      }
      const data = await verifyRegistrationOtp({ email, otpCode });
      localStorage.setItem('nutribot-auth-token', data.token);
      clearPendingOtp();
      setVerificationState('verified');
      onAuthenticated?.(data, 'verify-email');
    } catch (requestError) {
      setVerificationState(otpErrorState(requestError));
    }
  };
  const resendOtp = async () => {
    if (!isEmail(email)) {
      setVerificationState('error');
      return;
    }
    setVerificationState('resending');
    try {
      if (verification.onResend) {
        await verification.onResend();
        setVerificationCode('');
        setOtpExpiresAt(Date.now() + (verification.expirationSeconds || EMAIL_CHANGE_OTP_VALIDITY_SECONDS) * 1000);
        setVerificationState('resendSuccess');
        return;
      }
      await resendRegistrationOtp(email);
      setVerificationCode('');
      setVerificationState('resendSuccess');
      rememberOtp(email);
    } catch (requestError) {
      setVerificationState(otpErrorState(requestError));
    }
  };
  const backToSignup = () => {
    setVerificationCode('');
    setVerificationState('idle');
    verification.onBack?.();
    if (!verification.onBack) onSubmit?.(null, 'signup');
  };

  const openPendingVerification = () => {
    const pendingOtp = getPendingOtp();
    const emailToVerify = pendingVerificationEmail || pendingOtp?.email;
    if (emailToVerify) rememberOtp(emailToVerify, pendingOtp?.expiresAt);
    onSubmit?.(null, 'verify-email');
  };

  const updateVerificationEmail = (nextEmail) => {
    setRegisteredEmail(nextEmail);
    if (isEmail(nextEmail)) {
      const pendingOtp = getPendingOtp();
      rememberOtp(nextEmail, normalizeEmail(nextEmail) === pendingOtp?.email ? pendingOtp.expiresAt : undefined);
    }
  };

  if (isVerification) return <div className={`modal-backdrop auth-backdrop ${backdropClassName}`.trim()} role="dialog" aria-modal="true" aria-labelledby="email-verification-title" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <div className="auth-modal auth-modal--verification">
      <button className="modal-close" type="button" onClick={onClose} aria-label="Close"><X size={19} /></button>
      <EmailVerificationStep {...verification} email={email} code={verificationCode} onEmailChange={updateVerificationEmail} onCodeChange={(code) => { setVerificationCode(code); if (otpRemainingSeconds !== 0) setVerificationState('idle'); }} onVerify={verifyOtp} onResend={resendOtp} onBack={backToSignup} verificationState={verificationState} otpRemainingSeconds={otpRemainingSeconds} />
    </div>
  </div>;

  return <>
    <AuthToast error={error} success={success} />
    <div className={`modal-backdrop auth-backdrop ${backdropClassName}`.trim()} role="dialog" aria-modal="true" aria-labelledby="auth-title" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form className="auth-modal" noValidate onSubmit={submit}>
        <button className="modal-close" type="button" onClick={onClose} aria-label="Close"><X size={19} /></button>
        <p>Welcome to NutriBot</p>
        <h2 id="auth-title">{isSignup ? 'Make nourishment personal.' : 'Welcome back.'}</h2>
        <span>{isSignup ? 'Create an account to save ideas, videos and recipes.' : 'Sign in to continue your healthy routine.'}</span>
        <button className="google-auth" type="button" onClick={onGoogle}><b className="google-mark">G</b><span>Continue with Google</span></button>
        <div className="auth-divider"><span>or use email</span></div>
        {isSignup && <label>Full name<input name="name" autoComplete="name" value={form.name} onChange={update} onBlur={() => touch('name')} aria-invalid={Boolean(fieldError('name'))} aria-describedby={fieldError('name') ? 'name-error' : undefined} placeholder="Your name" />{fieldError('name') && <small id="name-error">{fieldError('name')}</small>}</label>}
        {isSignup && <label>Username<input name="username" autoComplete="username" value={form.username} onChange={update} onBlur={() => touch('username')} aria-invalid={Boolean(fieldError('username'))} aria-describedby={fieldError('username') ? 'username-error' : undefined} placeholder="Choose a username" />{fieldError('username') && <small id="username-error">{fieldError('username')}</small>}</label>}
        <label>
          {isSignup ? 'Email' : 'Email or username'}
          <input name="email" type={isSignup ? 'email' : 'text'} autoComplete={isSignup ? 'email' : 'username'} value={form.email} onChange={update} onBlur={() => touch('email')} aria-invalid={Boolean(fieldError('email'))} aria-describedby={fieldError('email') ? 'email-error' : undefined} placeholder={isSignup ? 'you@example.com' : 'you@example.com or username'} />
          {fieldError('email') && <small id="email-error">{fieldError('email')}</small>}
        </label>
        <label>
          Password
          <span className="password-input">
            <input name="password" type={showPassword ? 'text' : 'password'} autoComplete={isSignup ? 'new-password' : 'current-password'} value={form.password} onChange={update} onBlur={() => touch('password')} aria-invalid={Boolean(fieldError('password'))} aria-describedby={fieldError('password') ? 'password-error' : undefined} placeholder="Your password" />
            <button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
          </span>
          {fieldError('password') && <small id="password-error">{fieldError('password')}</small>}
        </label>
        {isSignup && <label>Confirm password<span className="password-input"><input name="confirmPassword" type={showConfirmation ? 'text' : 'password'} autoComplete="new-password" value={form.confirmPassword} onChange={update} onBlur={() => touch('confirmPassword')} aria-invalid={Boolean(fieldError('confirmPassword'))} aria-describedby={fieldError('confirmPassword') ? 'confirm-password-error' : undefined} placeholder="Repeat your password" /><button type="button" onClick={() => setShowConfirmation((current) => !current)} aria-label={showConfirmation ? 'Hide password confirmation' : 'Show password confirmation'}>{showConfirmation ? <EyeOff size={18} /> : <Eye size={18} />}</button></span>{fieldError('confirmPassword') && <small id="confirm-password-error">{fieldError('confirmPassword')}</small>}</label>}
        <button className="auth-submit" type="submit" disabled={submitting || Boolean(success)}>{submitting ? <><LoaderCircle className="auth-spinner" size={17} />Please wait...</> : isSignup ? 'Create account' : 'Log in'}</button>
        {!isSignup && isUnverifiedAccountError({ message: error }) && <button className="auth-verification-action" type="button" onClick={openPendingVerification}>Nhập mã OTP / Xác thực email</button>}
        <button className="auth-switch" type="button" onClick={() => onSubmit?.(null, isSignup ? 'login' : 'signup')}>{isSignup ? 'Already have an account? Log in' : 'New here? Create an account'}</button>
      </form>
    </div>
  </>;
}
