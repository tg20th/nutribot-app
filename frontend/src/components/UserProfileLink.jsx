import { Link } from 'react-router-dom';
import { getCurrentUserFromToken } from '../utils/auth';

export default function UserProfileLink({ userId, children, className = '', onClick, ...props }) {
  if (userId == null || userId === '') return <>{children}</>;
  const current = getCurrentUserFromToken();
  const target = current?.userId != null && String(current.userId) === String(userId)
    ? '/profile'
    : `/community/users/${encodeURIComponent(userId)}`;
  return <Link to={target} className={className} onClick={(event) => { event.stopPropagation(); onClick?.(event); }} {...props}>{children}</Link>;
}
