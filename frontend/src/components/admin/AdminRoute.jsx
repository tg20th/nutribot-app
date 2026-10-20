import { Navigate, useLocation } from 'react-router-dom';
import { clearAuthentication, getCurrentUserFromToken, isAdminRole } from '../../utils/auth';

export default function AdminRoute({ children }) {
  const location = useLocation();
  const user = getCurrentUserFromToken();
  const role = user?.role;
  const isAdmin = isAdminRole(role);

  if (!isAdmin) {
    clearAuthentication();
    return <Navigate to="/" replace state={{ authRequired: true, returnTo: location.pathname }} />;
  }

  return children;
}
