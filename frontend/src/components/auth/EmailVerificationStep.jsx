import { useEffect, useId, useRef, useState } from 'react';

const statusMessages = {
  verifying: 'Verifying...',
  invalid: 'Invalid verification code. Please try again.',
  expired: 'Mã OTP đã hết hạn. Vui lòng gửi lại mã mới.',
  alreadyUsed: 'This verification code has already been used.',
  tooManyAttempts: 'Too many verification attempts. Please request a new code.',
  resending: 'Sending...',
  resendSuccess: 'A new verification code has been sent to your email.',
  verified: 'Email verified successfully.',
  error: 'Something went wrong. Please try again.',
};

const copyByPurpose = {
  registration: {
    eyebrow: 'EMAIL VERIFICATION',
    title: 'Verify your email',
    description: 'We\'ve sent a verification code to your email. Enter the code below to verify your account.',
    backLabel: 'Back to registration',
  },
  emailChange: {
    eyebrow: 'EMAIL CONFIRMATION',
    title: 'Verify your new email',
    description: 'We\'ve sent a verification code to your new email address. Enter the code below to confirm the change.',
    backLabel: 'Back to profile',
  },
};

const errorStates = new Set(['invalid', 'expired', 'alreadyUsed', 'tooManyAttempts', 'error']);

function createBoxes(value, boxCount) {
  return Array.from({ length: boxCount }, (_, index) => Array.from(value || '')[index] || '');
}

/**
 * OTP presentation component. Network handlers are supplied by AuthModal.
 * Presentation-only OTP step. API handlers and every verification state must
 * be supplied by a backend integration; this component never verifies a code.
 */
export default function EmailVerificationStep({
  email,
  code,
  boxCount = 6,
  onEmailChange,
  onCodeChange,
  onVerify,
  onResend,
  onBack,
  purpose = 'registration',
  verificationState = 'idle',
  otpRemainingSeconds,
}) {
  const resolvedBoxCount = Number.isInteger(boxCount) && boxCount > 0 ? boxCount : 6;
  const copy = copyByPurpose[purpose] ?? copyByPurpose.registration;
  const [boxes, setBoxes] = useState(() => createBoxes(code, resolvedBoxCount));
  const inputRefs = useRef([]);
  const inputId = useId();
  const messageId = `${inputId}-message`;
  const isVerifying = verificationState === 'verifying';
  const isResending = verificationState === 'resending';
  const isVerified = verificationState === 'verified';
  const hasOtpTimer = Number.isFinite(otpRemainingSeconds);
  const isExpired = verificationState === 'expired' || otpRemainingSeconds === 0;
  const statusMessage = statusMessages[verificationState];
  const isError = errorStates.has(verificationState);
  const verificationCode = boxes.join('');
  const formattedRemainingTime = hasOtpTimer
    ? `${String(Math.floor(otpRemainingSeconds / 60)).padStart(2, '0')}:${String(otpRemainingSeconds % 60).padStart(2, '0')}`
    : null;

  useEffect(() => {
    setBoxes(createBoxes(code, resolvedBoxCount));
  }, [code, resolvedBoxCount]);

  useEffect(() => {
    inputRefs.current.find(Boolean)?.focus();
  }, []);

  const updateBoxes = (nextBoxes) => {
    setBoxes(nextBoxes);
    onCodeChange?.(nextBoxes.join(''));
  };

  const focusBox = (index) => inputRefs.current[index]?.focus();

  const fillFrom = (startIndex, rawValue) => {
    const characters = Array.from(rawValue).filter((character) => /\d/.test(character));
    if (!characters.length) return;
    const nextBoxes = [...boxes];
    characters.slice(0, resolvedBoxCount - startIndex).forEach((character, offset) => {
      nextBoxes[startIndex + offset] = character;
    });
    updateBoxes(nextBoxes);
    focusBox(Math.min(startIndex + characters.length, resolvedBoxCount - 1));
  };

  const changeBox = (index, event) => {
    const value = event.target.value.replace(/\D/g, '');
    if (value.length > 1) {
      fillFrom(index, value);
      return;
    }
    const nextBoxes = [...boxes];
    nextBoxes[index] = value;
    updateBoxes(nextBoxes);
    if (value && index < resolvedBoxCount - 1) focusBox(index + 1);
  };

  const handleKeyDown = (index, event) => {
    if (event.key === 'Backspace' && !boxes[index] && index > 0) {
      event.preventDefault();
      const nextBoxes = [...boxes];
      nextBoxes[index - 1] = '';
      updateBoxes(nextBoxes);
      focusBox(index - 1);
    }
    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      focusBox(index - 1);
    }
    if (event.key === 'ArrowRight' && index < resolvedBoxCount - 1) {
      event.preventDefault();
      focusBox(index + 1);
    }
  };

  const handlePaste = (index, event) => {
    event.preventDefault();
    fillFrom(index, event.clipboardData.getData('text'));
  };

  const verify = (event) => {
    event.preventDefault();
    onVerify?.(verificationCode);
  };

  return <section className="email-verification" aria-labelledby="email-verification-title">
    <div className="email-verification__heading">
      <p>{copy.eyebrow}</p>
      <h2 id="email-verification-title" tabIndex="-1">{copy.title}</h2>
      <span>{copy.description}</span>
    </div>

    {email
      ? <p className="email-verification__recipient">Code sent to <strong>{email}</strong></p>
      : <label className="email-verification__email">Email<input type="email" value={email || ''} onChange={(event) => onEmailChange?.(event.target.value)} placeholder="you@example.com" autoComplete="email" /></label>}

    <form className="email-verification__form" noValidate onSubmit={verify}>
      <fieldset className={`email-verification__code${isError ? ' email-verification__code--error' : ''}`} disabled={isVerified} aria-describedby={statusMessage ? messageId : undefined}>
        <legend>Enter verification code</legend>
        <div className="email-verification__boxes" style={{ '--otp-box-count': resolvedBoxCount }}>
          {boxes.map((character, index) => <input
            key={index}
            ref={(element) => { inputRefs.current[index] = element; }}
            id={`${inputId}-${index}`}
            name={`verificationCode-${index}`}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            spellCheck="false"
            maxLength={index === 0 ? resolvedBoxCount : 1}
            value={character}
            onChange={(event) => changeBox(index, event)}
            onKeyDown={(event) => handleKeyDown(index, event)}
            onPaste={(event) => handlePaste(index, event)}
            aria-label={`Verification code character ${index + 1} of ${resolvedBoxCount}`}
            aria-invalid={isError}
            className={character ? 'is-filled' : ''}
          />)}
        </div>
      </fieldset>

      {statusMessage && <p id={messageId} className={`email-verification__status${isError ? ' email-verification__status--error' : ''}`} role={isError ? 'alert' : 'status'} aria-live="polite">{statusMessage}</p>}

      <button className="auth-submit" type="submit" disabled={!onVerify || verificationCode.length !== resolvedBoxCount || isVerifying || isResending || isVerified || isExpired}>{isVerifying ? 'Verifying...' : 'Verify'}</button>
    </form>

    <div className="email-verification__resend">
      <span>Didn't receive the code?</span>
      <button type="button" onClick={() => onResend?.()} disabled={!onResend || !email || isVerifying || isResending || isVerified}>{isResending ? 'Sending...' : 'Resend code'}</button>
    </div>

    {formattedRemainingTime && <p className={`email-verification__timer${isExpired ? ' email-verification__timer--expired' : ''}`} role="status" aria-live="polite">{isExpired ? 'Mã OTP đã hết hạn' : `Mã OTP còn hiệu lực: ${formattedRemainingTime}`}</p>}

    {onBack && <button className="auth-switch email-verification__back" type="button" onClick={onBack}>{copy.backLabel}</button>}
  </section>;
}
