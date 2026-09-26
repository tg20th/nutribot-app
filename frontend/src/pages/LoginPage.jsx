import { Eye, EyeOff, LoaderCircle, Search, X, TrendingUp, Clock, Heart } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError } from '../services/apiClient';
import { loginAccount } from '../services/authApi';
import AuthToast from '../components/AuthToast';
import '../styles/login.css';

const POPULAR_SEARCHES = [
  { text: 'Công thức healthy', icon: TrendingUp },
  { text: 'Món chay', icon: Heart },
  { text: 'Giảm cân', icon: Clock }
];

export default function LoginPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ usernameOrEmail: '', password: '' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const searchInputRef = useRef(null);

  const updateField = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: '' }));
    setServerError('');
  };

  const submit = async (event) => {
    event.preventDefault();
    const nextErrors = {};
    if (!form.usernameOrEmail.trim()) nextErrors.usernameOrEmail = 'Vui lòng nhập username hoặc email.';
    if (!form.password) nextErrors.password = 'Vui lòng nhập mật khẩu.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setSubmitting(true);
    setServerError('');
    try {
      const data = await loginAccount({ usernameOrEmail: form.usernameOrEmail.trim(), password: form.password });
      if (!data.token) throw new Error('Máy chủ chưa trả về token đăng nhập.');
      localStorage.setItem('nutribot-auth-token', data.token);
      setSuccess('Đăng nhập thành công. Đang chuyển đến NutriBot...');
      window.setTimeout(() => navigate('/home'), 700);
    } catch (error) {
      setServerError(error instanceof ApiError ? error.message : error.message || 'Không thể kết nối đến máy chủ. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleQuickSearch = (term) => {
    navigate(`/search?q=${encodeURIComponent(term)}`);
  };

  // Keyboard shortcut: Cmd/Ctrl+K to focus search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        searchInputRef.current?.blur();
        setSearchFocused(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      <AuthToast error={serverError} success={success} />
      <main className="login-page-container">
        {/* Left Panel - Branding & Search */}
        <section className="login-hero" aria-label="Giới thiệu NutriBot">
          <Link className="login-brand" to="/" aria-label="Về trang chủ NutriBot">
            <span>Nutri</span>Bot
          </Link>

          <div className="login-hero-content">
            <div className="login-hero-copy">
              <p className="login-hero-kicker">NỀN TẢNG DINH DƯỠNG THÔNG MINH</p>
              <h1>Tìm kiếm thực phẩm lành mạnh, công thức nấu ăn và hướng dẫn video.</h1>
              <span>Khám phá hàng ngàn công thức, bài viết và video về dinh dưỡng lành mạnh.</span>
            </div>

            {/* Search Bar */}
            <form className="login-search-form" onSubmit={handleSearch}>
              <div className={`login-search-wrap ${searchFocused ? 'login-search-wrap--focused' : ''}`}>
                <Search size={20} className="login-search-icon" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
                  placeholder="Tìm kiếm công thức, bài viết, video..."
                  className="login-search-input"
                  aria-label="Tìm kiếm nội dung"
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="login-search-clear"
                    onClick={() => setSearchQuery('')}
                    aria-label="Xóa tìm kiếm"
                  >
                    <X size={16} />
                  </button>
                )}
                <button type="submit" className="login-search-btn">
                  Tìm kiếm
                </button>
              </div>

              {/* Keyboard hint */}
              <div className="login-search-hint">
                <kbd>⌘</kbd><kbd>K</kbd> để tập trung
              </div>
            </form>

            {/* Popular Searches */}
            <div className="login-popular-searches">
              <span className="login-popular-label">Tìm kiếm phổ biến:</span>
              <div className="login-popular-chips">
                {POPULAR_SEARCHES.map(({ text, icon: Icon }) => (
                  <button
                    key={text}
                    type="button"
                    className="login-popular-chip"
                    onClick={() => handleQuickSearch(text)}
                  >
                    <Icon size={14} />
                    {text}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Decorative elements */}
          <div className="login-hero-decoration">
            <div className="login-hero-circle login-hero-circle--1" />
            <div className="login-hero-circle login-hero-circle--2" />
          </div>
        </section>

        {/* Right Panel - Login Form */}
        <section className="login-form-section">
          <form className="login-form-card" noValidate onSubmit={submit}>
            <div className="login-form-header">
              <p>ĐĂNG NHẬP</p>
              <h2>Chào mừng trở lại</h2>
              <span>Đăng nhập để tiếp tục với không gian dinh dưỡng của bạn.</span>
            </div>

            <div className="login-form-fields">
              <label htmlFor="usernameOrEmail">
                Username hoặc email
                <input
                  id="usernameOrEmail"
                  name="usernameOrEmail"
                  autoComplete="username"
                  value={form.usernameOrEmail}
                  onChange={updateField}
                  aria-invalid={Boolean(errors.usernameOrEmail)}
                  placeholder="Nhập username hoặc email"
                />
                {errors.usernameOrEmail && <small>{errors.usernameOrEmail}</small>}
              </label>

              <label htmlFor="loginPassword">
                Mật khẩu
                <span className="login-password-input">
                  <input
                    id="loginPassword"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={form.password}
                    onChange={updateField}
                    aria-invalid={Boolean(errors.password)}
                    placeholder="Nhập mật khẩu"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </span>
                {errors.password && <small>{errors.password}</small>}
              </label>
            </div>

            <button
              className="login-submit-btn"
              type="submit"
              disabled={submitting || Boolean(success)}
            >
              {submitting ? (
                <>
                  <LoaderCircle className="login-spinner" size={18} />
                  Đang đăng nhập...
                </>
              ) : (
                'Đăng nhập'
              )}
            </button>

            <p className="login-register-link">
              Chưa có tài khoản? <Link to="/register">Tạo tài khoản</Link>
            </p>
          </form>
        </section>
      </main>
    </>
  );
}
