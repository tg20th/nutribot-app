import { Menu } from 'lucide-react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import AdminSidebar from '../components/admin/AdminSidebar';
import { apiRequest } from '../services/apiClient';
import { clearAuthentication } from '../utils/auth';

export default function AdminLayout() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const logout = async () => {
    try {
      await apiRequest('/api/v1/auth/logout', { method: 'POST' });
    } catch {
      // Bỏ qua lỗi mạng hoặc token hết hạn để luôn đảm bảo phiên client được dọn sạch
    } finally {
      clearAuthentication();
      localStorage.removeItem('nutribot-dev-role');
      sessionStorage.removeItem('nutribot-profile-avatar');
      localStorage.removeItem('nutribot-profile-avatar');
      navigate('/', { replace: true });
    }
  };

  return (
    <div className="admin-shell">
      <AdminSidebar open={open} onClose={() => setOpen(false)} onLogout={logout} />
      {open && <button className="admin-sidebar-scrim" aria-label="Close navigation" onClick={() => setOpen(false)} />}
      <div className="admin-main">
        <header className="admin-topbar">
          <button
            className="sidebar-trigger"
            aria-label={open ? 'Close navigation' : 'Open navigation'}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            <Menu />
          </button>
          <Link className="admin-top-brand" to="/admin" aria-label="NutriBot admin home">
            <span>Nutri</span>Bot<small>Good Food. Brighter You.</small>
          </Link>
        </header>
        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
