import { Eye, EyeOff, LoaderCircle, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ApiError } from '../services/apiClient';
import { loginAccount, registerAccount } from '../services/authApi';
import AuthToast from './AuthToast';
import '../styles/auth-popup.css';

const emptyForm = { name: '', username: '', email: '', password: '', confirmPassword: '' };

export default function AuthModal({ mode, onClose, onSubmit, onGoogle, onAuthenticated }) {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const isSignup = mode === 'signup';
  useEffect(() => { const close = (event) => event.key === 'Escape' && onClose(); window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close); }, [onClose]);
  const update = (event) => { const { name, value } = event.target; setForm((current) => ({ ...current, [name]: value })); setError(''); };
  const submit = async (event) => {
    event.preventDefault();
    if (isSignup && !form.name.trim()) return setError('Please enter your full name.');
    if (isSignup && !form.username.trim()) return setError('Please enter a username.');
    if (!form.email.trim()) return setError(isSignup ? 'Please enter your email.' : 'Please enter your email or username.');
    if (!/^\S+@\S+\.\S+$/.test(form.email) && isSignup) return setError('Please enter a valid email address.');
    if (!form.password) return setError('Please enter your password.');
    if (isSignup && form.password.length < 8) return setError('Password must be at least 8 characters.');
    if (isSignup && form.password !== form.confirmPassword) return setError('Passwords do not match.');
    setSubmitting(true); setError('');
    try {
      const data = isSignup ? await registerAccount({ fullName: form.name.trim(), username: form.username.trim(), email: form.email.trim(), password: form.password }) : await loginAccount({ usernameOrEmail: form.email.trim(), password: form.password });
      if (data.token) localStorage.setItem('nutribot-auth-token', data.token);
      onAuthenticated?.(data, mode); setSuccess(isSignup ? 'Account created successfully.' : 'Welcome back.'); window.setTimeout(onClose, 700);
    } catch (requestError) { setError(requestError instanceof ApiError ? requestError.message : requestError.message || 'Something went wrong. Please try again.'); }
    finally { setSubmitting(false); }
  };
  return <><AuthToast error={error} success={success} /><div className="modal-backdrop auth-backdrop" role="dialog" aria-modal="true" aria-labelledby="auth-title" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><form className="auth-modal" onSubmit={submit}><button className="modal-close" type="button" onClick={onClose} aria-label="Close"><X size={19}/></button><p>Welcome to NutriBot</p><h2 id="auth-title">{isSignup ? 'Make nourishment personal.' : 'Welcome back.'}</h2><span>{isSignup ? 'Create an account to save ideas, videos and recipes.' : 'Sign in to continue your healthy routine.'}</span><button className="google-auth" type="button" onClick={onGoogle}><b className="google-mark">G</b><span>Continue with Google</span></button><div className="auth-divider"><span>or use email</span></div>{isSignup && <label>Full name<input required name="name" value={form.name} onChange={update} placeholder="Your name"/></label>}{isSignup && <label>Username<input required name="username" value={form.username} onChange={update} placeholder="Choose a username"/></label>}<label>{isSignup ? 'Email' : 'Email or username'}<input required name="email" type={isSignup ? 'email' : 'text'} value={form.email} onChange={update} placeholder={isSignup ? 'you@example.com' : 'you@example.com or username'}/></label><label>Password<span className="password-input"><input required name="password" type={showPassword ? 'text' : 'password'} minLength={isSignup ? 8 : 1} value={form.password} onChange={update} placeholder="Your password"/><button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></span></label>{isSignup && <label>Confirm password<span className="password-input"><input required name="confirmPassword" type={showConfirmation ? 'text' : 'password'} value={form.confirmPassword} onChange={update} placeholder="Repeat your password"/><button type="button" onClick={() => setShowConfirmation((current) => !current)} aria-label={showConfirmation ? 'Hide password confirmation' : 'Show password confirmation'}>{showConfirmation ? <EyeOff size={18}/> : <Eye size={18}/>}</button></span></label>}<button className="auth-submit" type="submit" disabled={submitting || Boolean(success)}>{submitting ? <><LoaderCircle className="register-spinner" size={17}/>Please wait...</> : isSignup ? 'Create account' : 'Log in'}</button><button className="auth-switch" type="button" onClick={() => onSubmit?.(null, isSignup ? 'login' : 'signup')}>{isSignup ? 'Already have an account? Log in' : 'New here? Create an account'}</button></form></div></>;
}
