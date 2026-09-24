import { Eye, EyeOff, LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError } from '../services/apiClient';
import { loginAccount } from '../services/authApi';
import AuthToast from '../components/AuthToast';
import '../styles/login.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ usernameOrEmail: '', password: '' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const updateField = (event) => { const { name, value } = event.target; setForm((current) => ({ ...current, [name]: value })); setErrors((current) => ({ ...current, [name]: '' })); setServerError(''); };
  const submit = async (event) => {
    event.preventDefault();
    const nextErrors = {};
    if (!form.usernameOrEmail.trim()) nextErrors.usernameOrEmail = 'Vui lòng nhập username hoặc email.';
    if (!form.password) nextErrors.password = 'Vui lòng nhập mật khẩu.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setSubmitting(true); setServerError('');
    try {
      const data = await loginAccount({ usernameOrEmail: form.usernameOrEmail.trim(), password: form.password });
      if (!data.token) throw new Error('Máy chủ chưa trả về token đăng nhập.');
      localStorage.setItem('nutribot-auth-token', data.token);
      setSuccess('Đăng nhập thành công. Đang chuyển đến NutriBot...');
      window.setTimeout(() => navigate('/home'), 700);
    } catch (error) {
      setServerError(error instanceof ApiError ? error.message : error.message || 'Không thể kết nối đến máy chủ. Vui lòng thử lại.');
    } finally { setSubmitting(false); }
  };
  return <><AuthToast error={serverError} success={success} /><main className="register-page login-page">
    <section className="register-intro" aria-label="Giới thiệu NutriBot"><Link className="register-brand" to="/" aria-label="Về trang chủ NutriBot"><span>Nutri</span>Bot</Link><div className="register-intro-copy"><p>CHÀO MỪNG BẠN TRỞ LẠI</p><h1>Tiếp tục hành trình ăn lành mạnh.</h1><span>Những mục tiêu sức khỏe, thực đơn và gợi ý phù hợp đang chờ bạn.</span></div></section>
    <section className="register-card-wrap"><form className="register-card" noValidate onSubmit={submit}>
      <div className="register-heading"><p>ĐĂNG NHẬP</p><h2>Chào mừng trở lại</h2><span>Đăng nhập để tiếp tục với không gian dinh dưỡng của bạn.</span></div>
      <div className="register-fields login-fields"><label htmlFor="usernameOrEmail">Username hoặc email<input id="usernameOrEmail" name="usernameOrEmail" autoComplete="username" value={form.usernameOrEmail} onChange={updateField} aria-invalid={Boolean(errors.usernameOrEmail)}/>{errors.usernameOrEmail && <small>{errors.usernameOrEmail}</small>}</label><label htmlFor="loginPassword">Mật khẩu<span className="password-input"><input id="loginPassword" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={form.password} onChange={updateField} aria-invalid={Boolean(errors.password)}/><button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></span>{errors.password && <small>{errors.password}</small>}</label></div>
      <button className="register-submit" type="submit" disabled={submitting || Boolean(success)}>{submitting ? <><LoaderCircle className="register-spinner" size={18}/>Đang đăng nhập...</> : 'Đăng nhập'}</button><p className="register-login">Chưa có tài khoản? <Link to="/register">Tạo tài khoản</Link></p>
    </form></section>
  </main></>;
}
