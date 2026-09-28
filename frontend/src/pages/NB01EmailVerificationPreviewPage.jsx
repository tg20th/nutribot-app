import { useNavigate, useSearchParams } from 'react-router-dom';
import AuthModal from '../components/AuthModal';

export default function NB01EmailVerificationPreviewPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const parsedBoxCount = Number.parseInt(searchParams.get('boxCount') || '', 10);
  const boxCount = Number.isInteger(parsedBoxCount) && parsedBoxCount > 0 ? parsedBoxCount : undefined;

  return <AuthModal
    mode="verify-email"
    onClose={() => navigate('/')}
    onSubmit={(_, nextMode) => navigate('/', { state: { authMode: nextMode } })}
    verification={{
      email: searchParams.get('email') || undefined,
      boxCount
    }}
  />;
}
