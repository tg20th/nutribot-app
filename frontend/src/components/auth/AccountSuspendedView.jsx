import { AlertTriangle, ArrowLeft, Mail, X } from 'lucide-react';
import '../../styles/auth-popup.css';

export default function AccountSuspendedView({ onClose }) {
  const configuredSupportEmail = import.meta.env.VITE_SUPPORT_EMAIL || '';
  const supportEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(configuredSupportEmail) ? configuredSupportEmail : '';
  const subject = encodeURIComponent('NutriBot Account Suspension Appeal');
  const openSupportComposer = () => {
    if (!supportEmail) return;
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(supportEmail)}&su=${subject}`;
    const mailtoUrl = `mailto:${encodeURIComponent(supportEmail)}?subject=${subject}`;
    const composeWindow = window.open(gmailUrl, '_blank', 'noopener,noreferrer');
    if (!composeWindow) window.location.href = mailtoUrl;
  };
  return <section className="suspended-view" role="dialog" aria-modal="true" aria-labelledby="suspended-title">
    <div className="suspended-view__topline" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}><div className="suspended-view__icon" aria-hidden="true"><AlertTriangle size={20}/></div><button type="button" className="suspended-view__close" onClick={onClose} aria-label="Close suspension notice" style={{ display: 'grid', placeItems: 'center', width: 30, height: 30, padding: 0, border: '1px solid #d8dfd2', borderRadius: '50%', background: 'transparent', color: '#526359', cursor: 'pointer' }}><X size={18}/></button></div>
    <h1 id="suspended-title">Your account has been suspended</h1>
    <p>Your account is currently unavailable. Contact support to request a manual review of the suspension.</p>
    <div className="suspended-view__status"><span>Account status</span><strong>BANNED</strong></div>
    {supportEmail && <button type="button" className="suspended-view__action" onClick={openSupportComposer}><Mail size={16}/> Contact support</button>}
    <button type="button" className="suspended-view__back" onClick={onClose}><ArrowLeft size={15}/> Back to login</button>
  </section>;
}
