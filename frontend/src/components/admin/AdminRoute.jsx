import { Navigate, useLocation } from 'react-router-dom';
export default function AdminRoute({ children }) { const role = localStorage.getItem('nutribot-dev-role') || 'ADMIN'; return role === 'ADMIN' ? children : <Navigate to="/" replace state={{ from: useLocation().pathname }}/>; }
