import { AlertCircle, CloudOff, LockKeyhole, SearchX } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import '../../styles/error-page.css';

const ERROR_CONFIG = {
  404: {
    Icon: SearchX,
    category: 'PAGE NOT FOUND',
    heading: "Looks like you've lost your way.",
    description: "We couldn't find the page you're looking for. It may have been moved, deleted, or the link might be incorrect.",
    secondary: 'Go Back',
  },
  403: {
    Icon: LockKeyhole,
    category: 'ACCESS RESTRICTED',
    heading: "This space isn't available to you.",
    description: "You don't have permission to access this page. If you believe this is a mistake, please check your account or return to a page you can access.",
    secondary: 'Go Back',
  },
  500: {
    Icon: AlertCircle,
    category: 'SOMETHING WENT WRONG',
    heading: "Something didn't go as planned.",
    description: 'We ran into an unexpected problem while loading this page. Please try again in a moment.',
    secondary: 'Try Again',
  },
  503: {
    Icon: CloudOff,
    category: 'SERVICE UNAVAILABLE',
    heading: 'A little pause in the kitchen.',
    description: "NutriBot is temporarily unavailable. We're having trouble connecting to our services right now. Please try again shortly.",
    secondary: 'Try Again',
  },
};

function hasSafeHistoryEntry(locationKey) {
  if (locationKey && locationKey !== 'default') return true;
  if (typeof window === 'undefined' || window.history.length <= 1) return false;
  return document.referrer.startsWith(window.location.origin);
}

export default function ErrorPage({ status = 500, onRetry }) {
  const navigate = useNavigate();
  const location = useLocation();
  const config = ERROR_CONFIG[status] ?? ERROR_CONFIG[500];
  const { Icon } = config;
  const canGoBack = hasSafeHistoryEntry(location.key);

  const goBack = () => {
    if (canGoBack) navigate(-1);
    else navigate('/');
  };

  const tryAgain = () => {
    if (onRetry) {
      onRetry();
      return;
    }
    window.location.reload();
  };

  return <div className="error-page">
    <main className="error-page__main" aria-labelledby="error-page-heading">
      <div className="error-page__icon" aria-hidden="true"><Icon size={30} strokeWidth={1.8}/></div>
      <p className="error-page__code">{status}</p>
      <p className="error-page__category">{config.category}</p>
      <h1 id="error-page-heading">{config.heading}</h1>
      <p className="error-page__description">{config.description}</p>
      <div className="error-page__actions">
        <button type="button" className="error-page__button error-page__button--primary" onClick={() => navigate('/')}>Back to Home</button>
        <button type="button" className="error-page__button error-page__button--secondary" onClick={status === 500 || status === 503 ? tryAgain : goBack}>{config.secondary}</button>
      </div>
    </main>
  </div>;
}
