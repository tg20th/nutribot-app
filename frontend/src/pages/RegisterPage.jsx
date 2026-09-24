import { CheckCircle2, Eye, EyeOff, LoaderCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError } from '../services/apiClient';
import { registerAccount } from '../services/authApi';

const initialForm = { fullName: '', username: '', email: '', password: '', confirmPassword: '' };

function validate(form) {
  const errors = {};
  if (!form.fullName.trim()) errors.fullName = 'Vui lòng nhập họ và tên.';
  if (!form.username.trim()) errors.username = 'Vui lòng nhập tên đăng nhập.';
  else if (form.username.trim().length < 3) errors.username = 'Tên đăng nhập cần có ít nhất 3 ký tự.';
  if (!form.email.trim()) errors.email = 'Vui lòng nhập địa chỉ email.';
  else if (!/^\S+@\S+\.\S+$/.test(form.email)) errors.email = 'Email chưa đúng định dạng.';
  if (!form.password) errors.password = 'Vui lòng nhập mật khẩu.';
  else if (form.password.length < 8) errors.password = 'Mật khẩu cần có ít nhất 8 ký tự.';
  if (!form.confirmPassword) errors.confirmPassword = 'Vui lòng xác nhận mật khẩu.';
  else if (form.password !== form.confirmPassword) errors.confirmPassword = 'Mật khẩu xác nhận chưa trùng khớp.';
  return errors;
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [touched, setTouched] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const errors = useMemo(() => validate(form), [form]);
  const fieldError = (name) => touched[name] && errors[name];

  const updateField = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setServerError('');
  };
  const touch = (name) => setTouched((current) => ({ ...current, [name]: true }));

  const submit = async (event) => {
    event.preventDefault();
    setTouched(Object.fromEntries(Object.keys(initialForm).map((key) => [key, true])));
    if (Object.keys(errors).length) return;
    setSubmitting(true);
    setServerError('');
    try {
      const data = await registerAccount({ fullName: form.fullName.trim(), username: form.username.trim(), email: form.email.trim(), password: form.password });
      if (data.token) localStorage.setItem('nutribot-auth-token', data.token);
      setSuccess('Đăng ký thành công. Chào mừng bạn đến với NutriBot!');
      window.setTimeout(() => navigate('/'), 1400);
    } catch (error) {
      setServerError(error instanceof ApiError ? error.message : 'Không thể kết nối đến máy chủ. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  return <main className="register-page">
    <section className="register-intro" aria-label="Giới thiệu NutriBot">
      <Link className="register-brand" to="/" aria-label="Về trang chủ NutriBot"><span>Nutri</span>Bot</Link>
      <div className="register-intro-copy"><p>DINH DƯỠNG CÁ NHÂN HÓA</p><h1>Ăn lành mạnh, theo cách của bạn.</h1><span>Lưu thực đơn, theo dõi mục tiêu sức khỏe và nhận gợi ý dinh dưỡng phù hợp mỗi ngày.</span></div>
    </section>
    <section className="register-card-wrap">
      <form className="register-card" noValidate onSubmit={submit}>
        <div className="register-heading"><p>TẠO TÀI KHOẢN</p><h2>Bắt đầu cùng NutriBot</h2><span>Chỉ mất chưa đến một phút để thiết lập tài khoản của bạn.</span></div>
        {serverError && <p className="form-alert form-alert-error" role="alert">{serverError}</p>}
        {success && <p className="form-alert form-alert-success" role="status"><CheckCircle2 size={18}/>{success}</p>}
        <div className="register-fields">
          <label htmlFor="fullName">Họ và tên<input id="fullName" name="fullName" autoComplete="name" value={form.fullName} onChange={updateField} onBlur={() => touch('fullName')} aria-invalid={Boolean(fieldError('fullName'))}/>{fieldError('fullName') && <small>{fieldError('fullName')}</small>}</label>
          <label htmlFor="username">Tên đăng nhập<input id="username" name="username" autoComplete="username" value={form.username} onChange={updateField} onBlur={() => touch('username')} aria-invalid={Boolean(fieldError('username'))}/>{fieldError('username') && <small>{fieldError('username')}</small>}</label>
          <label htmlFor="email">Email<input id="email" name="email" type="email" autoComplete="email" value={form.email} onChange={updateField} onBlur={() => touch('email')} aria-invalid={Boolean(fieldError('email'))}/>{fieldError('email') && <small>{fieldError('email')}</small>}</label>
          <label htmlFor="password">Mật khẩu<span className="password-input"><input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={form.password} onChange={updateField} onBlur={() => touch('password')} aria-invalid={Boolean(fieldError('password'))}/><button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></span>{fieldError('password') ? <small>{fieldError('password')}</small> : <em>Tối thiểu 8 ký tự.</em>}</label>
          <label htmlFor="confirmPassword">Xác nhận mật khẩu<span className="password-input"><input id="confirmPassword" name="confirmPassword" type={showConfirmation ? 'text' : 'password'} autoComplete="new-password" value={form.confirmPassword} onChange={updateField} onBlur={() => touch('confirmPassword')} aria-invalid={Boolean(fieldError('confirmPassword'))}/><button type="button" onClick={() => setShowConfirmation((current) => !current)} aria-label={showConfirmation ? 'Ẩn mật khẩu xác nhận' : 'Hiện mật khẩu xác nhận'}>{showConfirmation ? <EyeOff size={18}/> : <Eye size={18}/>}</button></span>{fieldError('confirmPassword') && <small>{fieldError('confirmPassword')}</small>}</label>
        </div>
        <button className="register-submit" type="submit" disabled={submitting || Boolean(success)}>{submitting ? <><LoaderCircle className="register-spinner" size={18}/>Đang tạo tài khoản...</> : 'Tạo tài khoản'}</button>
        <p className="register-login">Đã có tài khoản? <button type="button" onClick={() => navigate('/')}>Đăng nhập từ trang chủ</button></p>
      </form>
    </section>
  </main>;
}
