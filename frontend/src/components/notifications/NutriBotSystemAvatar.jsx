import { CircleAlert } from 'lucide-react';

export default function NutriBotSystemAvatar({ moderation = false, approved = false }) {
  return <span className={`nutribot-system-avatar${moderation ? ' is-moderation' : ''}${approved ? ' is-approved' : ''}`} role="img" aria-label="NutriBot system">
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="23" className="nutribot-system-avatar__surface"/>
      <path className="nutribot-system-avatar__leaf" d="M26.2 14.5c-7.3 1.2-11.2 5.1-10.1 10.6 1 5.1 5.4 7.8 10.5 6.5 5.5-1.4 8.2-6.6 6.8-13.7-2.3 1.1-4.7 3.2-6.6 6.3-1.1-3.1-1.4-6.1-.6-9.7Z"/>
      <path className="nutribot-system-avatar__stem" d="M19.2 32.5c2.4-5.3 5.5-9.4 10.1-12.8"/>
    </svg>
    {(moderation || approved) && <span className="nutribot-system-avatar__badge" aria-hidden="true">{approved ? '✓' : <CircleAlert size={11}/>}</span>}
  </span>;
}
