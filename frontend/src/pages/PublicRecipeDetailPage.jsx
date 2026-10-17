import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import DishDetailModal from '../components/community/DishDetailModal';
import { getDishDetail } from '../services/dishService';
import { isMockPublicProfileEnabled } from '../services/publicProfileApi';
import { getMockRecipe } from '../services/mockPublicProfileData';
import { isMockPublicProfileRecipe } from '../services/mockPublicProfileData';

export default function PublicRecipeDetailPage() {
  const { dishId } = useParams();
  const location = useLocation();
  const { search, state } = location;
  const queryDishId = new URLSearchParams(search).get('dish');
  const resolvedDishId = dishId ?? queryDishId;
  const navigate = useNavigate();
  const [meal, setMeal] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    const request = isMockPublicProfileEnabled && isMockPublicProfileRecipe(resolvedDishId) ? Promise.resolve(getMockRecipe(resolvedDishId)) : getDishDetail(resolvedDishId, controller.signal);
    request.then((dish) => { if (!controller.signal.aborted) setMeal(dish || state?.mockRecipe || null); }).catch(() => {});
    return () => controller.abort();
  }, [resolvedDishId, state?.mockRecipe]);
  const closeDetails = () => {
    const requestedReturnTo = state?.returnTo;
    if (typeof requestedReturnTo === 'string' && requestedReturnTo.startsWith('/') && !requestedReturnTo.startsWith('//')) {
      navigate(requestedReturnTo, { state: state?.returnState });
      return;
    }
    navigate('/home', { replace: true });
  };
  return <DishDetailModal meal={meal ?? { dishId: resolvedDishId }} initialDish={isMockPublicProfileEnabled && isMockPublicProfileRecipe(resolvedDishId) ? (meal ?? state?.mockRecipe) : null} onClose={closeDetails} />;
}
