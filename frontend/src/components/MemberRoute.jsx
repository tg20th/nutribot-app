import { Navigate, useLocation } from 'react-router-dom';

export default function MemberRoute({ children }) {
  const location = useLocation();
  const token = localStorage.getItem('nutribot-auth-token');

  return token
    ? children
    : <Navigate to="/login" replace state={{ from: location.pathname }} />;
}
