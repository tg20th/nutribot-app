import { Navigate, useLocation } from 'react-router-dom';
import { getCurrentUserFromToken, isAdminRole } from '../../utils/auth';

export default function AdminRoute({ children }) {
  const user = getCurrentUserFromToken();
  const role = user?.role;
  const isAdmin = isAdminRole(role);

  return isAdmin ? children : <Navigate to="/" replace state={{ from: useLocation().pathname }} />;
}
