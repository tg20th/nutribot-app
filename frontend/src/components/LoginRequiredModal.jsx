import { Lock, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useState } from 'react';
import AuthModal from './AuthModal';
import '../styles/login-required-modal.css';

export default function LoginRequiredModal({ onClose, onAuthMode, onAuthenticated, onGoogle, initialMode }) {
  const [authMode, setAuthMode] = useState(initialMode ?? null);

  function handleClose() {
    setAuthMode(null);
    onClose?.();
  }

  function switchToAuthMode(mode) {
    if (onAuthMode) {
      onAuthMode(null, mode);
    } else {
      setAuthMode(mode);
    }
  }

  const handleAuthenticated = (data, mode) => {
    if (onAuthMode) {
      onAuthenticated?.(data, mode);
    } else {
      onAuthenticated?.(data, mode);
      handleClose();
    }
  };

  return createPortal(
    <div
      className="login-required-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-required-title"
      onMouseDown={(event) => event.target === event.currentTarget && handleClose()}
    >
      {authMode ? (
        <AuthModal
          mode={authMode}
          onClose={() => setAuthMode(null)}
          onSubmit={(_, mode) => mode && setAuthMode(mode)}
          onAuthenticated={handleAuthenticated}
          onGoogle={onGoogle}
        />
      ) : (
        <div className="login-required-modal">
          <button
            type="button"
            className="login-required-close"
            onClick={handleClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
          <div className="login-required-icon" aria-hidden="true">
            <Lock size={36} strokeWidth={1.5} />
          </div>
          <h2 id="login-required-title">Join the conversation</h2>
          <p>
            Sign in or create an account to vote and comment on posts from the NutriBot community.
          </p>
          <div className="login-required-actions">
            <button
              type="button"
              className="login-required-btn login-required-btn--primary"
              onClick={() => switchToAuthMode('login')}
            >
              Sign In
            </button>
            <button
              type="button"
              className="login-required-btn login-required-btn--secondary"
              onClick={() => switchToAuthMode('signup')}
            >
              Create Account
            </button>
          </div>
          {onGoogle && (
            <>
              <div className="login-required-divider">
                <span>or</span>
              </div>
              <button
                type="button"
                className="login-required-google"
                onClick={onGoogle}
              >
                <b className="google-mark">G</b>
                Continue with Google
              </button>
            </>
          )}
        </div>
      )}
    </div>,
    document.body
  );
}
