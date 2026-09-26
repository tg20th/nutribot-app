import { Navigate, useLocation } from 'react-router-dom';

export default function MemberRoute({ children }) {
  const location = useLocation();
  const token = localStorage.getItem('nutribot-auth-token');

  return token
    ? children
    : <Navigate to="/" replace state={{ authRequired: true, returnTo: location.pathname }} />;
}
