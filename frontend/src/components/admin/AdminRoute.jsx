import { Navigate, useLocation } from 'react-router-dom';
import { getCurrentUserFromToken } from '../../utils/auth';

export default function AdminRoute({ children }) {
  const user = getCurrentUserFromToken();
  const role = user?.role;
  const isAdmin = role === 'ROLE_ADMIN' || role === 'Admin';

  return isAdmin ? children : <Navigate to="/" replace state={{ from: useLocation().pathname }} />;
}
