import { useNavigate, useSearchParams } from 'react-router-dom';
import AuthModal from '../components/AuthModal';

export default function NB07EmailChangeVerificationPreviewPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const parsedBoxCount = Number.parseInt(searchParams.get('boxCount') || '', 10);
  const boxCount = Number.isInteger(parsedBoxCount) && parsedBoxCount > 0 ? parsedBoxCount : undefined;
  const newEmail = searchParams.get('newEmail') || undefined;

  return <AuthModal
    mode="verify-email"
    onClose={() => navigate('/profile')}
    verification={{
      email: newEmail,
      boxCount,
      purpose: 'emailChange',
      onBack: () => navigate('/profile'),
    }}
  />;
}
