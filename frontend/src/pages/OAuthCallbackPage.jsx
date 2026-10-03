import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getOAuthErrorState } from '../services/loginErrorState';
import { isAdminRole } from '../utils/auth';

export default function OAuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get('token');
    const username = searchParams.get('username');
    const role = searchParams.get('role');
    const error = searchParams.get('error');

    if (getOAuthErrorState({ error, token, username, role })) {
      localStorage.removeItem('nutribot-auth-token');
      localStorage.removeItem('nutribot-user');
      window.dispatchEvent(new Event('nutribot-auth-changed'));
      window.dispatchEvent(new CustomEvent('nutribot-auth-failure', { detail: { state: 'OAUTH_FAILED' } }));
      navigate('/', { replace: true });
      return;
    }

    if (token && username && role) {
      localStorage.setItem('nutribot-auth-token', token);
      localStorage.setItem('nutribot-user', JSON.stringify({ username, role }));
      window.dispatchEvent(new Event('nutribot-auth-changed'));
      const destination = isAdminRole(role) ? '/admin' : '/home';
      navigate(destination);
    }
  }, [searchParams, navigate]);

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid #e5e7eb',
          borderTopColor: '#22c55e',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 16px'
        }} />
        <p>Đang xử lý đăng nhập Google...</p>
      </div>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
