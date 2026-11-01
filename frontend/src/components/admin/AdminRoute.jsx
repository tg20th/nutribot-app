import { Navigate, useLocation } from 'react-router-dom';
import { clearAuthentication, getCurrentUserFromToken, isAdminRole } from '../../utils/auth';
import ErrorPage from '../errors/ErrorPage';

export default function AdminRoute({ children }) {
  const location = useLocation();
  const user = getCurrentUserFromToken();
  const role = user?.role;
  const isAdmin = isAdminRole(role);

  if (!user) {
    clearAuthentication();
    return <Navigate to="/" replace state={{ authRequired: true, returnTo: location.pathname }} />;
  }

  if (!isAdmin) return <ErrorPage status={403}/>;

  return children;
}
