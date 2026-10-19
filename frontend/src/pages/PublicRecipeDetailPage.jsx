import { useLocation, useNavigate, useParams } from 'react-router-dom';
import DishDetailModal from '../components/community/DishDetailModal';

export default function PublicRecipeDetailPage() {
  const { dishId } = useParams();
  const location = useLocation();
  const { search, state } = location;
  const queryDishId = new URLSearchParams(search).get('dish');
  const resolvedDishId = dishId ?? queryDishId;
  const navigate = useNavigate();
  const closeDetails = () => {
    const requestedReturnTo = state?.returnTo;
    if (typeof requestedReturnTo === 'string' && requestedReturnTo.startsWith('/') && !requestedReturnTo.startsWith('//')) {
      navigate(requestedReturnTo, { state: state?.returnState });
      return;
    }
    navigate('/home', { replace: true });
  };
  return <DishDetailModal meal={{ dishId: resolvedDishId }} onClose={closeDetails} />;
}
