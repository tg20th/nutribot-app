import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  History,
  Leaf,
  Image as ImageIcon,
  Loader2,
  Maximize2,
  MoreHorizontal,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  Plus,
  Search,
  SquarePen,
  Send,
  Sunrise,
  Utensils,
  Clock3,
  Video,
  X,
} from 'lucide-react';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { deleteChatSession, getChatMessages, getChatSessions, requestNutritionAdvice } from '../../services/chatbotApi';
import { googleAuthUrl } from '../../services/contentApi';
import { isAdminRole } from '../../utils/auth';
import AuthModal from '../AuthModal';
import MessageMarkdown, { markdownToPlainText } from './MessageMarkdown';
import NutriBotIcon from './NutriBotIcon';
import '../../styles/chatbot-widget.css';

const GUEST_TRIAL_LIMIT = 3;
const GUEST_SESSION_KEY = 'nutribot_guest_chat_session_id';
const MAX_MESSAGE_LENGTH = 2_000;
const CHATBOT_TIMEOUTS = {
  // AI text processing is bounded at 30s; leave room for the backend
  // gateway and network response without changing image/video deadlines.
  text: 45_000,
  image: 55_000,
  video: 140_000,
};
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 25 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

const QUICK_PROMPTS = {
  en: ['Build a balanced plate', 'High-protein meal ideas', 'Healthy afternoon snacks', 'Plan an easy breakfast'],
  vi: ['Xây dựng một đĩa ăn cân bằng', 'Gợi ý bữa ăn giàu đạm', 'Món ăn nhẹ lành mạnh buổi chiều', 'Lên kế hoạch bữa sáng đơn giản'],
};
const COMPACT_WELCOME_PROMPTS = [
  { label: 'What should I eat tonight?', Icon: Utensils },
  { label: 'High-protein meal ideas', Icon: Leaf },
  { label: 'Healthy snack ideas', Icon: Clock3 },
  { label: 'Plan a balanced breakfast', Icon: Sunrise },
];

const INITIAL_MESSAGES = [{
  id: 'welcome',
  sender: 'assistant',
  text: 'Hi, I am NutriBot. Ask me about everyday nutrition, balanced meals, or healthier food choices.',
}];

const getGuestSessionId = () => {
  let sessionId = localStorage.getItem(GUEST_SESSION_KEY);
  if (!sessionId) {
    sessionId = globalThis.crypto?.randomUUID?.() || `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(GUEST_SESSION_KEY, sessionId);
  }
  return sessionId;
};

const getActionStorageKey = (sessionId, messageId) => `nutribot-action:${sessionId || 'guest'}:${messageId}`;
const startOfLocalDay = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
};
const getHistoryGroup = (updatedAt) => {
  const timestamp = startOfLocalDay(updatedAt);
  if (timestamp == null) return 'Older';
  const today = startOfLocalDay(new Date());
  const daysAgo = Math.floor((today - timestamp) / 86_400_000);
  if (daysAgo <= 0) return 'Today';
  if (daysAgo === 1) return 'Yesterday';
  if (daysAgo <= 7) return 'Previous 7 days';
  return 'Older';
};
const HISTORY_GROUPS = ['Today', 'Yesterday', 'Previous 7 days', 'Older'];
const getInternalHistoryContent = (item) => {
  const parts = [item.text || ''];
  const image = item.analysis;
  if (image?.imageContext) parts.push(`image_context: ${image.imageContext}`);
  if (image?.recognizedIngredients?.length) parts.push(`recognized_ingredients: ${image.recognizedIngredients.join(', ')}`);
  if (image?.uncertainIngredients?.length) parts.push(`uncertain_ingredients: ${image.uncertainIngredients.join(', ')}`);
  if (image?.warnings?.length) parts.push(`warnings: ${image.warnings.join(' ')}`);
  if (item.videoAnalysis) parts.push(`video_analysis: ${JSON.stringify(item.videoAnalysis)}`);
  if (item.videoSummary) parts.push(`video_context: ${item.videoSummary}`);
  if (item.videoSource) parts.push(`video_source: ${JSON.stringify(item.videoSource)}`);
  return parts.filter(Boolean).join('\n');
};

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
const formatBytes = (value) => `${(value / (1024 * 1024)).toFixed(value >= 1024 * 1024 ? 1 : 2)} MB`;
const normalizeList = (value) => Array.isArray(value) ? value.filter(Boolean) : [];
const getRequestType = (attachment, youtubeUrl) => {
  if (attachment?.type === 'IMAGE') return 'image';
  if (attachment?.type === 'VIDEO' || youtubeUrl) return 'video';
  return 'text';
};

const YOUTUBE_HOSTS = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'];
const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const isValidYoutubeUrl = (value) => {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (!YOUTUBE_HOSTS.includes(host)) return false;
    if (host === 'youtu.be') return YOUTUBE_VIDEO_ID.test(url.pathname.slice(1));
    if (url.pathname === '/watch') return YOUTUBE_VIDEO_ID.test(url.searchParams.get('v') || '');
    const segments = url.pathname.split('/').filter(Boolean);
    return segments.length === 2 && ['shorts', 'embed', 'live'].includes(segments[0]) && YOUTUBE_VIDEO_ID.test(segments[1]);
  } catch {
    return false;
  }
};

const validateSignature = async (file, kind) => {
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (kind === 'image') {
    const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((item, index) => bytes[index] === item);
    const webp = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
    return jpeg || png || webp;
  }
  const mp4 = bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70;
  const webm = bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
  const quicktime = mp4;
  return mp4 || webm || quicktime;
};

const readAsBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
  reader.onerror = () => reject(new Error('Unable to read the selected file.'));
  reader.readAsDataURL(file);
});

function AnalysisCard({ attachment, videoAnalysis, videoSource, videoSummary, showSteps = false, language = 'en' }) {
  const vi = language === 'vi';
  const [expanded, setExpanded] = useState(false);
  if (attachment?.type === 'IMAGE') {
    const recognized = normalizeList(attachment.recognizedIngredients);
    const uncertain = normalizeList(attachment.uncertainIngredients);
    const warnings = normalizeList(attachment.warnings);
    if (!recognized.length && !uncertain.length && !warnings.length) return null;
    return <section className="chatbot-analysis-card chatbot-analysis-card--image" aria-label={vi ? 'Phân tích nguyên liệu' : 'Ingredient analysis'}>
      <header><span className="chatbot-analysis-card__icon"><ImageIcon size={15} /></span><strong>{vi ? 'Phân tích nguyên liệu' : 'Ingredient analysis'}</strong></header>
      {recognized.length > 0 && <div className="chatbot-analysis-card__group"><span className="chatbot-analysis-card__label">{vi ? 'Nhìn thấy rõ' : 'Clearly visible'}</span><ul>{recognized.map((item) => <li key={item}>{item}</li>)}</ul></div>}
      {uncertain.length > 0 && <div className="chatbot-analysis-card__group is-muted"><span className="chatbot-analysis-card__label">{vi ? 'Chưa chắc chắn' : 'Uncertain'}</span><ul>{uncertain.map((item) => <li key={item}>{item}</li>)}</ul></div>}
      {warnings.length > 0 && <p className="chatbot-analysis-card__warning"><AlertCircle size={14} />{warnings.join(' ')}</p>}
    </section>;
  }

  if (attachment?.type === 'VIDEO' || !videoAnalysis) return null;
  const ingredients = normalizeList(videoAnalysis.ingredients);
  const steps = showSteps ? normalizeList(videoAnalysis.steps) : [];
  const uncertainties = normalizeList(videoAnalysis.uncertainties);
  const visibleSteps = expanded ? steps : steps.slice(0, 3);
  return <section className="chatbot-analysis-card chatbot-analysis-card--video" aria-label={vi ? 'Đã phân tích video' : 'Video analyzed'}>
    <header><span className="chatbot-analysis-card__icon"><Video size={15} /></span><strong>{vi ? 'Đã phân tích video' : 'Video analyzed'}</strong></header>
    <h4>{videoAnalysis.dish_name || videoAnalysis.dishName || 'Dish name unavailable'}</h4>
    <p className="chatbot-analysis-card__summary">{ingredients.length} ingredients · {steps.length} instructions</p>
    {ingredients.length > 0 && <div className="chatbot-analysis-card__group"><span className="chatbot-analysis-card__label">Ingredients</span><p>{ingredients.map((item) => typeof item === 'string' ? item : item.name).join(', ')}</p></div>}
    {steps.length > 0 && <div className="chatbot-analysis-card__group"><span className="chatbot-analysis-card__label">Instructions</span><ol>{visibleSteps.map((item, index) => <li key={`${item.instruction || item}-${index}`}>{typeof item === 'string' ? item : item.instruction}</li>)}</ol>{steps.length > 3 && <button type="button" className="chatbot-analysis-card__expand" onClick={() => setExpanded((current) => !current)}>{expanded ? 'Show less' : 'Show all'} <ChevronRight size={14} className={expanded ? 'is-rotated' : ''} /></button>}</div>}
    {uncertainties.length > 0 && <p className="chatbot-analysis-card__warning"><AlertCircle size={14} />{uncertainties.join(' ')}</p>}
  </section>;
}

function CookingFollowUp({ item, onSelect, disabled, language = 'en' }) {
  const action = normalizeList(item.suggestedActions || item.suggested_actions).find((candidate) => (candidate.type || '').toUpperCase() === 'COOKING_INSTRUCTIONS');
  if (!action || item.actionState) return null;
  const vi = language === 'vi';
  return <section className="chatbot-cooking-follow-up" aria-label={vi ? 'Yêu cầu hướng dẫn nấu ăn' : 'Cooking instructions follow-up'}><p>{vi ? 'Bạn có muốn xem hướng dẫn nấu ăn không?' : 'Would you like to see the cooking instructions?'}</p><div><button type="button" onClick={() => onSelect('yes')} disabled={disabled}>{vi ? 'Có, hiển thị các bước' : 'Yes, show steps'}</button><button type="button" className="is-secondary" onClick={() => onSelect('no')} disabled={disabled}>{vi ? 'Không, cảm ơn' : 'No, thanks'}</button></div></section>;
}

function YoutubeIcon() {
  return <span className="chatbot-widget__youtube-icon" aria-hidden="true">▶</span>;
}

function SentMedia({ attachment }) {
  if (!attachment?.type) return null;
  const isImage = attachment.type === 'IMAGE';
  const isYoutube = attachment.type === 'VIDEO' && Boolean(attachment.url);
  const hasSize = Number.isFinite(attachment.size) && attachment.size > 0;
  const label = attachment.filename || (isImage ? 'Ingredient image' : 'Cooking video');

  return <div className={`chatbot-widget__sent-media${isYoutube ? ' chatbot-widget__sent-media--youtube' : ''}`}>
    {isImage && attachment.preview ? <img src={attachment.preview} alt={attachment.filename || 'Ingredient image'} /> : isImage ? <ImageIcon size={17} aria-hidden="true" /> : isYoutube ? <YoutubeIcon /> : <span className="chatbot-widget__video-placeholder"><Play size={16} fill="currentColor" aria-hidden="true" /></span>}
    <span title={attachment.url || label}>{attachment.url || label}</span>
    {hasSize && <small>{formatBytes(attachment.size)}</small>}
  </div>;
}

function ComposerAttachmentPreview({ attachment, youtubeUrl, onRemoveAttachment, onRemoveYoutube }) {
  if (youtubeUrl) {
    const tile = youtubeUrl.length > 30;
    return <div className={`chatbot-widget__attachment-preview chatbot-widget__attachment-preview--youtube${tile ? ' is-tile' : ''}`}>
      <YoutubeIcon />
      <span><strong>YouTube video</strong><small title={youtubeUrl}>{youtubeUrl}</small></span>
      <button type="button" onClick={onRemoveYoutube} aria-label="Remove YouTube URL"><X size={15} /></button>
    </div>;
  }
  if (!attachment) return null;
  const tile = attachment.filename.length > 26;
  return <div className={`chatbot-widget__attachment-preview${tile ? ' is-tile' : ''}`} title={tile ? attachment.filename : undefined} aria-label={tile ? attachment.filename : undefined}>
    {attachment.kind === 'image' && attachment.preview ? <img src={attachment.preview} alt="Selected image" /> : <span className="chatbot-widget__attachment-video-icon"><Play size={18} fill="currentColor" aria-hidden="true" /></span>}
    <span><strong>{attachment.filename}</strong><small>{formatBytes(attachment.size)}</small></span>
    <button type="button" onClick={onRemoveAttachment} aria-label="Remove attachment"><X size={15} /></button>
  </div>;
}

export default function ChatbotWidget({ onSend, onAuth }) {
  const navigate = useNavigate();
  const [isMounted, setIsMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [displayMode, setDisplayMode] = useState('compact');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historySidebarOpen, setHistorySidebarOpen] = useState(true);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [conversationState, setConversationState] = useState('new');
  const [conversationError, setConversationError] = useState('');
  const [sessions, setSessions] = useState([]);
  const [historyState, setHistoryState] = useState('idle');
  const [historyError, setHistoryError] = useState('');
  const [historyQuery, setHistoryQuery] = useState('');
  const [openHistoryMenu, setOpenHistoryMenu] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationLanguage, setConversationLanguage] = useState('en');
  const [activeRequestType, setActiveRequestType] = useState('text');
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [authMode, setAuthMode] = useState(null);
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('nutribot-auth-token'));
  const [guestTrialsLeft, setGuestTrialsLeft] = useState(null);
  const [attachment, setAttachment] = useState(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [textareaExpanded, setTextareaExpanded] = useState(false);
  const [youtubeEditorOpen, setYoutubeEditorOpen] = useState(false);
  const [youtubeDraft, setYoutubeDraft] = useState('');
  const [youtubeEditorError, setYoutubeEditorError] = useState('');
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [mediaError, setMediaError] = useState('');
  const panelRef = useRef(null);
  const threadRef = useRef(null);
  const inputRef = useRef(null);
  const launcherRef = useRef(null);
  const mediaInputRef = useRef(null);
  const youtubeInputRef = useRef(null);
  const historySearchInputRef = useRef(null);
  const attachmentMenuRef = useRef(null);
  const requestControllerRef = useRef(null);
  const activeRequestRef = useRef(null);
  const requestSequenceRef = useRef(0);
  const conversationKeyRef = useRef(0);
  const sendingRef = useRef(false);
  const composingRef = useRef(false);
  const sessionIdRef = useRef(null);
  const isGuest = !authToken;
  const detectLanguage = (text) => /[ăâđêôơư]|\b(ăn|nên|gì|vào|trưa|tối|sáng|bữa|món|không|cho|tôi|mình|giúp|hôm|nay)\b/i.test(text || '') ? 'vi' : 'en';

  const refreshAuthState = useCallback(() => {
    const token = localStorage.getItem('nutribot-auth-token');
    setAuthToken(token);
    if (token) setShowLimitModal(false);
  }, []);
  const syncGuestTrialCount = useCallback((remaining) => {
    if (!isGuest || !Number.isInteger(remaining)) return;
    const count = Math.max(0, Math.min(GUEST_TRIAL_LIMIT, remaining));
    setGuestTrialsLeft(count);
    if (count === 0) setShowLimitModal(true);
  }, [isGuest]);
  const showTrialBadge = isGuest && Number.isInteger(guestTrialsLeft) && guestTrialsLeft > 0;
  const resizeComposer = (element) => {
    if (!element) return;
    element.style.height = 'auto';
    const nextHeight = Math.min(element.scrollHeight, 132);
    element.style.height = `${nextHeight}px`;
    setTextareaExpanded(element.scrollHeight > 42);
  };
  useEffect(() => {
    resizeComposer(inputRef.current);
  }, [draft]);
  useEffect(() => {
    resizeComposer(inputRef.current);
  }, [attachment, youtubeUrl, displayMode]);
  const handleComposerKeyDown = (event) => {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing || composingRef.current) return;
    event.preventDefault();
    submitMessage();
  };
  const handleMessageChange = (event) => {
    setDraft(event.target.value);
    resizeComposer(event.currentTarget);
  };
  const messageOverLimit = draft.length > MAX_MESSAGE_LENGTH;

  const loadSessions = useCallback(async () => {
    setHistoryState('loading'); setHistoryError('');
    try { setSessions(await getChatSessions()); setHistoryState('ready'); }
    catch { setHistoryError('Chat history is unavailable. Please try again.'); setHistoryState('error'); }
  }, []);
  const handleDeleteSession = async (sessionId) => {
    setOpenHistoryMenu(null);
    if (!window.confirm('Delete this conversation?')) return;
    try {
      await deleteChatSession(sessionId);
      if (String(sessionId) === String(sessionIdRef.current)) startNewConversation();
      await loadSessions();
    } catch {
      setHistoryError('Unable to delete this conversation. Please try again.');
      setHistoryState('error');
    }
  };
  const openWidget = useCallback(() => { refreshAuthState(); setIsMounted(true); setIsOpen(true); }, [refreshAuthState]);
  const openHistory = async () => { if (isGuest) return; setHistoryOpen(true); if (historyState !== 'loading') await loadSessions(); };
  const openFullscreenHistorySearch = () => {
    if (!historySidebarOpen) setHistorySidebarOpen(true);
    requestAnimationFrame(() => historySearchInputRef.current?.focus());
  };
  const abortActiveRequest = useCallback(() => {
    conversationKeyRef.current += 1;
    requestControllerRef.current?.abort();
    requestControllerRef.current = null; activeRequestRef.current = null; sendingRef.current = false; setIsLoading(false); setActiveRequestType('text');
  }, []);
  const startNewConversation = () => {
    abortActiveRequest();
    sessionIdRef.current = null;
    setConversationState('new');
    setConversationError('');
    setMessages(INITIAL_MESSAGES);
    setConversationLanguage('en');
    setHistoryOpen(false);
    setOpenHistoryMenu(null);
    setAttachmentMenuOpen(false);
  };
  const selectSession = async (sessionId) => {
    abortActiveRequest();
    if (displayMode === 'compact') setHistoryOpen(false);
    const key = conversationKeyRef.current;
    setConversationState('loading');
    setConversationError('');
    setHistoryState('loading');
    setHistoryError('');
    setMessages([]);
    setAttachmentMenuOpen(false);
    setOpenHistoryMenu(null);
    let loaded = false;
    try {
      const persisted = await getChatMessages(sessionId);
      if (key !== conversationKeyRef.current) return;
      sessionIdRef.current = sessionId;
      setMessages(persisted.map((item) => ({ id: item.messageId, sender: item.senderType === 'USER' ? 'user' : 'assistant', text: item.content, createdAt: item.createdAt, attachment: item.attachments?.[0], actionState: localStorage.getItem(getActionStorageKey(sessionId, item.messageId)) || undefined, ...(item.metadata || {}) })));
      setConversationLanguage(detectLanguage(persisted.find((item) => item.senderType === 'USER')?.content));
      setConversationState('existing');
      setHistoryOpen(false);
      loaded = true;
    } catch {
      setConversationError('Unable to load this conversation. Please try again.');
      setConversationState('existing');
      setHistoryError('Unable to load this conversation. Please try again.');
      setHistoryState('error');
    }
    finally { if (loaded) setHistoryState('ready'); }
  };
  const closeWidget = useCallback(() => {
    if (displayMode === 'fullscreen' || !panelRef.current || prefersReducedMotion()) {
      setIsOpen(false);
      setIsMounted(false);
      setDisplayMode('compact');
      setHistoryOpen(false);
      setAttachmentMenuOpen(false);
      requestAnimationFrame(() => launcherRef.current?.focus());
      return;
    }
    gsap.to(panelRef.current, { autoAlpha: 0, x: 22, y: 14, scale: .97, duration: .24, ease: 'power2.in', onComplete: () => { setIsOpen(false); setIsMounted(false); requestAnimationFrame(() => launcherRef.current?.focus()); } });
  }, [displayMode]);

  useEffect(() => {
    const externalOpen = () => openWidget();
    const keydown = (event) => {
      if (event.key !== 'Escape' || !isOpen) return;
      if (youtubeEditorOpen) { setYoutubeEditorOpen(false); setYoutubeEditorError(''); return; }
      if (attachmentMenuOpen) { setAttachmentMenuOpen(false); return; }
      closeWidget();
    };
    window.addEventListener('open-nutribot-chat', externalOpen); window.addEventListener('keydown', keydown);
    return () => { window.removeEventListener('open-nutribot-chat', externalOpen); window.removeEventListener('keydown', keydown); };
  }, [attachmentMenuOpen, closeWidget, isOpen, openWidget, youtubeEditorOpen]);
  useEffect(() => {
    const storage = (event) => { if (event.key === 'nutribot-auth-token') refreshAuthState(); };
    window.addEventListener('storage', storage); window.addEventListener('focus', refreshAuthState); window.addEventListener('nutribot-auth-changed', refreshAuthState);
    return () => { window.removeEventListener('storage', storage); window.removeEventListener('focus', refreshAuthState); window.removeEventListener('nutribot-auth-changed', refreshAuthState); };
  }, [refreshAuthState]);
  useEffect(() => {
    if (!youtubeEditorOpen) return undefined;
    youtubeInputRef.current?.focus();
    return undefined;
  }, [youtubeEditorOpen]);
  useEffect(() => {
    if (displayMode === 'fullscreen' && !isGuest && historyState === 'idle') loadSessions();
  }, [displayMode, historyState, isGuest, loadSessions]);
  useEffect(() => {
    if (!attachmentMenuOpen) return undefined;
    const closeOnOutsideClick = (event) => {
      if (!attachmentMenuRef.current?.contains(event.target)) setAttachmentMenuOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setAttachmentMenuOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [attachmentMenuOpen]);
  useEffect(() => () => requestControllerRef.current?.abort(), []);
  useEffect(() => { if (!isGuest) { setShowLimitModal(false); setHistoryOpen(false); } }, [isGuest]);
  useEffect(() => {
    const thread = threadRef.current;
    if (!thread) return undefined;
    const frame = requestAnimationFrame(() => thread.scrollTo?.({ top: thread.scrollHeight, behavior: conversationState === 'existing' ? 'auto' : 'smooth' }));
    return () => cancelAnimationFrame(frame);
  }, [conversationState, messages]);
  useGSAP(() => {
    if (!isMounted || !isOpen || !panelRef.current) return;
    if (prefersReducedMotion()) { gsap.set(panelRef.current, { autoAlpha: 1, x: 0, y: 0, scale: 1 }); inputRef.current?.focus(); return; }
    gsap.fromTo(panelRef.current, { autoAlpha: 0, x: 24, y: 16, scale: .96 }, { autoAlpha: 1, x: 0, y: 0, scale: 1, duration: .35, ease: 'power3.out', onComplete: () => inputRef.current?.focus() });
  }, { dependencies: [isMounted, isOpen], scope: panelRef });

  const chooseMedia = async (event, kind) => {
    const file = event.target.files?.[0]; event.target.value = ''; setAttachmentMenuOpen(false); setMediaError('');
    if (!file) return;
    if (isGuest) { setMediaError('Sign in to send an image or video for analysis.'); return; }
    const accepted = kind === 'image' ? IMAGE_TYPES : VIDEO_TYPES;
    const limit = kind === 'image' ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
    if (!accepted.includes(file.type)) { setMediaError(kind === 'image' ? 'Images must be JPEG, PNG or WebP.' : 'Videos must be MP4, WebM or QuickTime.'); return; }
    if (file.size > limit) { setMediaError(`${kind === 'image' ? 'Image' : 'Video'} exceeds the ${kind === 'image' ? '10' : '25'} MB limit.`); return; }
    try {
      if (!(await validateSignature(file, kind))) { setMediaError('The file content does not match its declared format.'); return; }
      const dataBase64 = await readAsBase64(file);
      setAttachment({ kind, file, preview: kind === 'image' ? URL.createObjectURL(file) : null, dataBase64, type: kind === 'image' ? 'IMAGE' : 'VIDEO', mimeType: file.type, filename: file.name, size: file.size });
      setYoutubeUrl('');
    } catch (error) { setMediaError(error.message || 'Unable to read the selected file.'); }
  };
  const clearAttachment = () => { if (attachment?.preview) URL.revokeObjectURL(attachment.preview); setAttachment(null); setMediaError(''); };
  const chooseYoutube = () => {
    setAttachmentMenuOpen(false);
    if (isGuest) { setMediaError('Sign in to send an image or video for analysis.'); return; }
    setYoutubeDraft(youtubeUrl);
    setYoutubeEditorError('');
    setYoutubeEditorOpen(true);
  };
  const choosePhotoOrVideo = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    chooseMedia(event, IMAGE_TYPES.includes(file.type) ? 'image' : 'video');
  };
  const closeYoutubeEditor = () => {
    setYoutubeEditorOpen(false);
    setYoutubeEditorError('');
  };
  const confirmYoutube = (event) => {
    event.preventDefault();
    const value = youtubeDraft.trim();
    if (!value) {
      setYoutubeEditorError('Paste a YouTube video URL to continue.');
      return;
    }
    if (!isValidYoutubeUrl(value)) {
      setYoutubeEditorError('Enter a valid YouTube video URL.');
      return;
    }
    setMediaError('');
    if (attachment?.preview) URL.revokeObjectURL(attachment.preview);
    setAttachment(null);
    setYoutubeUrl(value);
    closeYoutubeEditor();
  };
  const youtubeValue = youtubeDraft.trim();
  const canConfirmYoutube = Boolean(youtubeValue && isValidYoutubeUrl(youtubeValue));

  const submitMessage = async (value = draft, retryContext = null) => {
    const message = value.trim(); const requestMessage = retryContext?.requestMessage ?? message; const displayMessage = retryContext?.displayMessage ?? message; const selectedAttachment = retryContext?.attachment ?? attachment;
    const selectedYoutube = retryContext?.youtubeUrl ?? youtubeUrl;
    if (!retryContext && detectLanguage(displayMessage) === 'vi') setConversationLanguage('vi');
    const requestType = getRequestType(selectedAttachment, selectedYoutube);
    if (!requestMessage && !selectedAttachment && !selectedYoutube) return;
    if (requestMessage.length > MAX_MESSAGE_LENGTH) {
      setConversationError('Message cannot exceed 2000 characters.');
      return;
    }
    if (isLoading || sendingRef.current) return;
    if ((selectedAttachment || selectedYoutube) && isGuest) { setMediaError('Sign in to send an image or video for analysis.'); return; }
    sendingRef.current = true;
    const conversationHistory = retryContext?.conversationHistory ?? messages.filter((item) => item.id !== 'welcome' && !item.pending && !item.error).slice(-40).map((item) => ({ sender: item.sender === 'user' ? 'USER' : 'ASSISTANT', content: getInternalHistoryContent(item) }));
    const guest = retryContext?.guest ?? isGuest;
    const sessionId = retryContext?.sessionId ?? (guest ? getGuestSessionId() : sessionIdRef.current);
    const conversationKey = retryContext?.conversationKey ?? conversationKeyRef.current;
    const idempotencyKey = retryContext?.idempotencyKey ?? `chat-${Date.now()}-${requestSequenceRef.current + 1}`;
    if (conversationKey !== conversationKeyRef.current) { sendingRef.current = false; return; }
    const requestId = ++requestSequenceRef.current;
    const userMessage = { id: `user-${Date.now()}`, sender: 'user', text: displayMessage, attachment: selectedAttachment ? { type: selectedAttachment.type, filename: selectedAttachment.filename, mimeType: selectedAttachment.mimeType, preview: selectedAttachment.preview, size: selectedAttachment.size } : (selectedYoutube ? { type: 'VIDEO', url: selectedYoutube } : null) };
    const pendingId = `pending-${Date.now()}`;
    setConversationState('active');
    setConversationError('');
    const isRetry = Boolean(retryContext?.errorId);
    setMessages((current) => [...current.filter((item) => item.id !== retryContext?.errorId), ...(isRetry ? [] : [userMessage]), { id: pendingId, sender: 'assistant', text: '', pending: true, mediaKind: selectedAttachment?.kind ?? (selectedYoutube ? 'video' : undefined) }]);
    setDraft(''); setAttachment(null); setYoutubeUrl(''); setMediaError(''); setIsLoading(true); setActiveRequestType(requestType); setAttachmentMenuOpen(false); onSend?.(displayMessage);
    const controller = new AbortController(); requestControllerRef.current = controller; activeRequestRef.current = { id: requestId, conversationKey };
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => { timeoutId = window.setTimeout(() => { const timeoutError = new Error('NutriBot request timed out.'); timeoutError.code = 'CHATBOT_TIMEOUT'; controller.abort(); reject(timeoutError); }, CHATBOT_TIMEOUTS[requestType]); });
    try {
      const response = await Promise.race([requestNutritionAdvice({ message: requestMessage, sessionId, conversationHistory: guest ? conversationHistory : [], attachment: selectedAttachment ? { type: selectedAttachment.type, dataBase64: selectedAttachment.dataBase64, mimeType: selectedAttachment.mimeType, filename: selectedAttachment.filename } : (selectedYoutube ? { type: 'VIDEO', url: selectedYoutube } : undefined), idempotencyKey, signal: controller.signal }), timeoutPromise]);
      if (activeRequestRef.current?.id !== requestId || conversationKey !== conversationKeyRef.current) return;
      const assistantText = typeof (response.content || response.reply) === 'string' ? (response.content || response.reply).trim() : '';
      if (!assistantText) { const invalid = new Error('NutriBot returned an incomplete response.'); invalid.code = 'CHATBOT_INVALID_RESPONSE'; throw invalid; }
      if (!guest && response.sessionId != null) sessionIdRef.current = response.sessionId;
      if (guest) syncGuestTrialCount(response.remainingTrialCount);
      setMessages((current) => [...current.filter((item) => item.id !== pendingId), { id: `assistant-${Date.now()}`, sender: 'assistant', text: assistantText, animate: !prefersReducedMotion(), analysis: response.attachment, videoAnalysis: response.videoAnalysis || response.video_analysis, videoSource: response.videoSource || response.video_source, videoSummary: response.videoSummary || response.video_summary, suggestedActions: response.suggestedActions || response.suggested_actions }]);
    } catch (error) {
      if (activeRequestRef.current?.id !== requestId || conversationKey !== conversationKeyRef.current) return;
      if (error.name === 'AbortError') { setMessages((current) => current.filter((item) => item.id !== pendingId)); setDraft(displayMessage); setAttachment(selectedAttachment); setYoutubeUrl(selectedYoutube); return; }
      if (error.status === 429 && isGuest) syncGuestTrialCount(0);
      setDraft(displayMessage); setAttachment(selectedAttachment); setYoutubeUrl(selectedYoutube);
      const messageText = error.status === 429 ? "AI is temporarily unavailable\n\nWe've reached the current AI usage limit. You can still view your previous conversations and analysis results. Please try again later." : error.code === 'CHATBOT_TIMEOUT' ? 'NutriBot phản hồi quá lâu. Vui lòng thử lại.' : error.code === 'CHATBOT_INVALID_RESPONSE' ? 'NutriBot returned an incomplete response. Please try again.' : error.status === 503 || error.status === 504 ? 'AI is temporarily unavailable. Please try again later.' : error.status === 413 ? 'The attachment exceeds the allowed size.' : 'NutriBot could not respond right now. Please try again.';
      setMessages((current) => [...current.filter((item) => item.id !== pendingId), { id: `error-${Date.now()}`, sender: 'assistant', text: error.code === 'CHATBOT_TIMEOUT' ? 'NutriBot took too long to respond. Please try again.' : messageText, error: true, retry: { message: requestMessage, displayMessage, sessionId, guest, conversationHistory, conversationKey, idempotencyKey, attachment: selectedAttachment, youtubeUrl: selectedYoutube } }]);
    } finally { window.clearTimeout(timeoutId); if (activeRequestRef.current?.id === requestId) { requestControllerRef.current = null; activeRequestRef.current = null; sendingRef.current = false; setIsLoading(false); setActiveRequestType('text'); } }
  };
  const selectCookingFollowUp = (item, choice) => {
    if (item.actionState || isLoading || sendingRef.current) return;
    setMessages((current) => current.map((message) => message.id === item.id ? { ...message, actionState: choice } : message));
    localStorage.setItem(getActionStorageKey(sessionIdRef.current, item.id), choice);
    if (choice !== 'yes') return;
    submitMessage('Yes, show me the cooking steps.', {
      // Use the action type as the machine-facing intent. The visible label
      // remains user-friendly and works for image or video context.
      requestMessage: 'COOKING_INSTRUCTIONS: Provide complete cooking instructions for the dish selected or explicitly referenced in the previous conversation, using the preserved ingredients and dietary/allergy constraints.',
      displayMessage: 'Yes, show me the cooking steps.',
    });
  };
  const retryMessage = (item) => item.retry && submitMessage(item.retry.message, { ...item.retry, errorId: item.id });
  const openAuth = (mode) => { setShowLimitModal(false); setIsOpen(false); setIsMounted(false); onAuth ? onAuth(mode) : navigate('/', { state: { authMode: mode } }); };
  const filteredSessions = sessions.filter((item) => `${item.title || ''} ${item.preview || ''}`.toLowerCase().includes(historyQuery.toLowerCase().trim().toLowerCase()));
  const groupedSessions = HISTORY_GROUPS.map((label) => ({ label, items: [...filteredSessions].filter((session) => getHistoryGroup(session.updatedAt) === label).sort((a, b) => (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0)) })).filter((group) => group.items.length > 0);
  const toggleFullscreen = () => { setDisplayMode((mode) => mode === 'fullscreen' ? 'compact' : 'fullscreen'); setHistoryOpen(false); setAttachmentMenuOpen(false); };

  const trimText = (value, length) => {
    const clean = String(value || '').replace(/\s+/g, ' ').trim();
    return clean.length > length ? `${clean.slice(0, length - 1).trimEnd()}…` : clean;
  };
  const sessionTitle = (session) => trimText(session.title || session.preview || 'New conversation', 58);
  const sessionPreview = (session) => trimText(markdownToPlainText(session.preview || ''), 130);
  const sessionDate = (session) => {
    const date = new Date(session.updatedAt);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
  };
  const showWelcome = conversationState === 'new';
  const selectWelcomePrompt = (prompt) => {
    if (isLoading || sendingRef.current) return;
    submitMessage(prompt);
  };

  const renderHistoryState = (cardMode = false) => <div className={`chatbot-widget__history-list${cardMode ? ' chatbot-widget__history-list--cards' : ''}`}>
    {historyState === 'loading' && <p className="chatbot-widget__history-status"><Loader2 className="is-spinning" size={17} /> Loading conversations...</p>}
    {historyState === 'error' && <p className="chatbot-widget__history-status is-error">{historyError}</p>}
    {historyState === 'ready' && !filteredSessions.length && <p className="chatbot-widget__history-status">{historyQuery ? 'No conversations match your search.' : 'No conversations yet.'}</p>}
    {historyState === 'ready' && groupedSessions.map((group) => <section className="chatbot-widget__history-group" key={group.label}><h3>{group.label}</h3>{group.items.map((session) => {
      const active = String(session.sessionId) === String(sessionIdRef.current);
      const preview = sessionPreview(session);
      const date = sessionDate(session);
      return <div className={`chatbot-widget__history-item${active ? ' is-active' : ''}${cardMode ? ' chatbot-widget__history-item--card' : ''}`} key={session.sessionId}>
        <button type="button" className="chatbot-widget__history-select" onClick={() => selectSession(session.sessionId)}>
          <span>{sessionTitle(session)}</span>
          {cardMode && preview && <small>{preview}</small>}
          {cardMode && date && <time dateTime={session.updatedAt}>{date}</time>}
        </button>
        <button type="button" className="chatbot-widget__history-menu-toggle" onClick={() => setOpenHistoryMenu((current) => current === session.sessionId ? null : session.sessionId)} aria-label={`Options for ${sessionTitle(session)}`} aria-expanded={openHistoryMenu === session.sessionId}><MoreHorizontal size={17} /></button>
        {openHistoryMenu === session.sessionId && <div className="chatbot-widget__history-menu"><button type="button" onClick={() => handleDeleteSession(session.sessionId)}>Delete conversation</button></div>}
      </div>;
    })}</section>)}
  </div>;

  const closeHistory = () => displayMode === 'fullscreen' ? setHistorySidebarOpen(false) : setHistoryOpen(false);
  const historyPanel = displayMode === 'compact' ? <aside className="chatbot-widget__history chatbot-widget__history--compact" aria-label="Chat history">
    <div className="chatbot-widget__history-head chatbot-widget__history-head--editorial">
      <div><span>Your conversations</span><h2>Continue the<br />conversation.</h2><p>Pick up right where you left off.</p></div>
      <div className="chatbot-widget__history-editorial-actions">
        <button type="button" className="chatbot-widget__history-close" onClick={closeHistory} aria-label="Close conversation history"><X size={20} aria-hidden="true" /></button>
        <button type="button" className="chatbot-widget__history-new chatbot-widget__history-new--editorial" onClick={startNewConversation} aria-label="New conversation (New chat)"><Plus size={23} aria-hidden="true" /></button>
      </div>
    </div>
    <label className="chatbot-widget__history-search"><Search size={16} /><input value={historyQuery} onChange={(event) => setHistoryQuery(event.target.value)} placeholder="Search conversations" aria-label="Search conversations" /></label>
    {renderHistoryState(true)}
  </aside> : <aside className={`chatbot-widget__history chatbot-widget__history--sidebar${historySidebarOpen ? '' : ' is-collapsed'}`} aria-label="Chat history">
    {historySidebarOpen ? <>
      <div className="chatbot-widget__history-head chatbot-widget__history-head--sidebar">
        <h2>Your conversations</h2>
        <button type="button" className="chatbot-widget__history-sidebar-toggle" onClick={() => setHistorySidebarOpen(false)} aria-label="Collapse conversations"><PanelLeftClose size={18} /></button>
      </div>
      <button type="button" className="chatbot-widget__history-new" onClick={startNewConversation} aria-label="New conversation"><SquarePen size={18} /> <span>New conversation</span></button>
      <label className="chatbot-widget__history-search"><Search size={17} /><input ref={historySearchInputRef} value={historyQuery} onChange={(event) => setHistoryQuery(event.target.value)} placeholder="Search conversations" aria-label="Search conversations" /></label>
      {renderHistoryState(false)}
    </> : <div className="chatbot-widget__history-rail" aria-label="Collapsed chat history">
      <button type="button" className="chatbot-widget__history-rail-toggle" onClick={() => setHistorySidebarOpen(true)} aria-label="Expand conversations" title="Expand conversations"><NutriBotIcon size={21} /></button>
      <button type="button" className="chatbot-widget__history-new" onClick={startNewConversation} aria-label="New conversation" title="New conversation"><SquarePen size={18} /></button>
      <button type="button" className="chatbot-widget__history-search-collapsed" onClick={openFullscreenHistorySearch} aria-label="Search conversations" title="Search conversations"><Search size={18} /></button>
    </div>}
  </aside>;

  return <div className={`chatbot-widget${displayMode === 'fullscreen' && isOpen ? ' is-fullscreen' : ''}${isOpen ? ' is-open' : ''}`}>
    {isMounted && !showLimitModal && <section ref={panelRef} id="nutribot-chat-panel" className={`chatbot-widget__panel${displayMode === 'fullscreen' ? ' chatbot-widget__panel--fullscreen' : ''}`} role="dialog" aria-label="NutriBot nutrition assistant" aria-modal={displayMode === 'fullscreen' ? 'true' : 'false'}>
      {!(historyOpen && displayMode === 'compact') && <header className="chatbot-widget__header">
        <div className="chatbot-widget__brand"><span className="chatbot-widget__brand-mark"><NutriBotIcon size={20} /></span><span><strong>NutriBot AI</strong><small><i aria-hidden="true" /> {isLoading ? (activeRequestType === 'video' ? 'Analyzing video...' : activeRequestType === 'image' ? 'Analyzing image...' : 'Thinking...') : 'Ready to help'}</small></span></div>
        <div className="chatbot-widget__header-actions">
          {!isGuest && displayMode !== 'fullscreen' && <button type="button" className="chatbot-widget__history-toggle" onClick={openHistory} aria-label="Open chat history"><History size={18} /></button>}
          <button type="button" className="chatbot-widget__expand-toggle" onClick={toggleFullscreen} aria-label={displayMode === 'fullscreen' ? 'Minimize NutriBot chat' : 'Expand NutriBot chat'}>{displayMode === 'fullscreen' ? <Minimize2 size={18} /> : <Maximize2 size={18} />}</button>
          <button type="button" className="chatbot-widget__minimize" onClick={closeWidget} aria-label="Close NutriBot chat"><X size={19} /></button>
        </div>
      </header>}
      <div className="chatbot-widget__body">
        {displayMode === 'fullscreen' && historyPanel}
        {displayMode === 'compact' && historyOpen ? historyPanel : <div className="chatbot-widget__conversation">
          <div ref={threadRef} className="chatbot-widget__thread" aria-live="polite">
            <div className="chatbot-widget__conversation-inner">
              {showWelcome ? <section className={`chatbot-widget__welcome-screen${displayMode === 'compact' ? ' chatbot-widget__welcome-screen--compact' : ''}`} aria-labelledby="nutribot-welcome-title">
                <div className="chatbot-widget__welcome-intro">
                  <span className="chatbot-widget__welcome-avatar" aria-hidden="true"><NutriBotIcon size={displayMode === 'compact' ? 24 : 34} /></span>
                  <h1 id="nutribot-welcome-title">What shall we eat today?</h1>
                  <p>{displayMode === 'compact' ? 'Your everyday companion for healthier meals and smarter food choices.' : 'Your everyday nutrition companion. Explore vegetarian meals, discover ingredients, and make healthier food choices.'}</p>
                </div>
                <div className="chatbot-widget__welcome-prompts" aria-label="Suggested questions">
                  {(displayMode === 'compact' ? COMPACT_WELCOME_PROMPTS : QUICK_PROMPTS.en).map((prompt) => { const label = typeof prompt === 'string' ? prompt : prompt.label; const Icon = typeof prompt === 'string' ? null : prompt.Icon; return <button key={label} type="button" className="chatbot-widget__prompt" onClick={() => selectWelcomePrompt(label)} disabled={isLoading}>{Icon && <Icon size={16} aria-hidden="true" />}{label}</button>; })}
                </div>
              </section> : <>
              {conversationState === 'loading' && <p className="chatbot-widget__conversation-status"><Loader2 className="is-spinning" size={17} /> Loading conversation...</p>}
              {conversationError && conversationState !== 'loading' && <p className="chatbot-widget__conversation-status is-error" role="alert">{conversationError}</p>}
              <div className="chatbot-widget__messages">{messages.map((item, index) => {
                const hasText = typeof item.text === 'string' ? item.text.trim().length > 0 : Boolean(item.text);
                const hasMedia = Boolean(item.attachment?.type);
                const hasMessageContent = item.pending || hasText || item.analysis || item.videoAnalysis || item.error;
                if (!hasMedia && !hasMessageContent) return null;
                return <Fragment key={item.id}><div className={`chatbot-widget__message-row chatbot-widget__message-row--${item.sender}`} data-latest-message={index === messages.length - 1 ? 'true' : undefined}>
                  {hasMedia && <SentMedia attachment={item.attachment} />}
                  {hasMessageContent && <>{item.sender === 'assistant' && <span className="chatbot-widget__assistant-avatar"><NutriBotIcon size={20} /></span>}<div className={`chatbot-widget__message chatbot-widget__message--${item.sender}`}>{item.pending ? <span className="chatbot-widget__typing" aria-label={item.mediaKind === 'video' ? 'Analyzing video' : item.mediaKind === 'image' ? 'Analyzing image' : 'NutriBot is thinking'}><i /><i /><i /></span> : <><MessageMarkdown text={item.text} animate={item.sender === 'assistant' && item.animate} onComplete={() => item.animate && setMessages((current) => current.map((message) => message.id === item.id ? { ...message, animate: false } : message))} />{item.animate && <button type="button" className="chatbot-widget__reveal" onClick={() => setMessages((current) => current.map((message) => message.id === item.id ? { ...message, animate: false } : message))}>Show full response</button>}{item.analysis && <AnalysisCard attachment={item.analysis} language={conversationLanguage} />}{item.error && item.retry && <button type="button" className="chatbot-widget__retry" onClick={() => retryMessage(item)}>Retry</button>}</>}</div></>}
                  {!item.pending && item.sender === 'assistant' && <CookingFollowUp item={item} language={conversationLanguage} onSelect={(choice) => selectCookingFollowUp(item, choice)} disabled={isLoading || Boolean(item.actionState)} />}
                </div></Fragment>;
              })}</div></>}
            </div>
          </div>
          <div className="chatbot-widget__composer-wrap">
            <div className="chatbot-widget__composer-ambient" aria-hidden="true" />
            {mediaError && <p className="chatbot-widget__media-error" role="alert"><AlertCircle size={14} />{mediaError}</p>}
            <form className={`chatbot-widget__composer${attachment || youtubeUrl || textareaExpanded ? ' is-expanded' : ''}`} onSubmit={(event) => { event.preventDefault(); submitMessage(); }}>
              <ComposerAttachmentPreview attachment={attachment} youtubeUrl={youtubeUrl} onRemoveAttachment={clearAttachment} onRemoveYoutube={() => setYoutubeUrl('')} />
              <div className="chatbot-widget__composer-content">
                {youtubeEditorOpen ? <div className="chatbot-widget__youtube-row">
                  <button type="button" className="chatbot-widget__composer-back" onClick={closeYoutubeEditor} aria-label="Back to message composer"><ArrowLeft size={17} /></button>
                  <label htmlFor="nutribot-youtube-url" className="chatbot-widget__sr-only">YouTube URL</label>
                  <div className={`chatbot-widget__youtube-input${youtubeEditorError ? ' is-error' : ''}`}>
                    <input ref={youtubeInputRef} id="nutribot-youtube-url" value={youtubeDraft} onChange={(event) => { setYoutubeDraft(event.target.value); if (youtubeEditorError) setYoutubeEditorError(''); }} onBlur={() => { if (youtubeValue && !isValidYoutubeUrl(youtubeValue)) setYoutubeEditorError('Enter a valid YouTube URL.'); }} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); if (canConfirmYoutube) confirmYoutube(event); else if (youtubeValue) setYoutubeEditorError('Enter a valid YouTube URL.'); } }} placeholder="Paste YouTube URL..." autoComplete="off" />
                  </div>
                  <button type="button" className="chatbot-widget__youtube-confirm" onClick={confirmYoutube} disabled={!canConfirmYoutube} aria-label="Confirm YouTube URL"><Check size={15} /></button>
                </div> : <>
                  <div className="chatbot-widget__composer-input-row">
                    <label htmlFor="nutribot-message" className="chatbot-widget__sr-only">Message NutriBot</label>
                    <textarea ref={inputRef} id="nutribot-message" value={draft} onChange={handleMessageChange} onKeyDown={handleComposerKeyDown} onCompositionStart={() => { composingRef.current = true; }} onCompositionEnd={(event) => { composingRef.current = false; resizeComposer(event.currentTarget); }} placeholder="Ask NutriBot..." autoComplete="off" rows="1" disabled={isLoading} />
                  </div>
                  <div className="chatbot-widget__composer-actions">
                    <div ref={attachmentMenuRef} className="chatbot-widget__attach-wrap"><button type="button" className="chatbot-widget__attach-button" onClick={() => setAttachmentMenuOpen((current) => !current)} aria-label="Add attachment" aria-expanded={attachmentMenuOpen}><Plus size={18} /></button>{attachmentMenuOpen && <div className="chatbot-widget__attach-menu"><button type="button" className="chatbot-widget__attach-menu-item" aria-label="Photo or video" onClick={() => mediaInputRef.current?.click()}><span className="chatbot-widget__attach-menu-item-icon chatbot-widget__attach-menu-item-icon--photo"><ImageIcon size={20} aria-hidden="true" /></span><span className="chatbot-widget__attach-menu-item-label">Photo or video</span></button><button type="button" className="chatbot-widget__attach-menu-item" aria-label="YouTube link" onClick={chooseYoutube}><span className="chatbot-widget__attach-menu-item-icon chatbot-widget__attach-menu-item-icon--youtube"><YoutubeIcon /></span><span className="chatbot-widget__attach-menu-item-label">YouTube link</span></button></div>}</div>
                    <button type="submit" disabled={(!draft.trim() && !attachment && !youtubeUrl) || messageOverLimit || isLoading} aria-label="Send message"><Send size={18} /></button>
                  </div>
                </>}
              </div>
              {youtubeEditorError && <p className="chatbot-widget__youtube-error" role="alert">{youtubeEditorError}</p>}
            </form>
            <input ref={mediaInputRef} className="chatbot-widget__file-input" type="file" accept={[...IMAGE_TYPES, ...VIDEO_TYPES].join(',')} onChange={choosePhotoOrVideo} />
            <div className={`chatbot-widget__message-counter${messageOverLimit ? ' is-over-limit' : ''}`} aria-live="polite">
              {messageOverLimit && <span className="chatbot-widget__message-limit-warning" role="alert">Maximum 2,000 characters allowed.</span>}
              <span>{draft.length.toLocaleString('en-US')}/{MAX_MESSAGE_LENGTH.toLocaleString('en-US')}</span>
            </div>
            {showTrialBadge && <div className={`chatbot-widget__trial-badge${guestTrialsLeft === 1 ? ' is-warning' : ''}`} aria-live="polite"><AlertCircle size={13} aria-hidden="true" /><span><strong>{guestTrialsLeft} of {GUEST_TRIAL_LIMIT}</strong> questions left</span></div>}
            <p className="chatbot-widget__notice">NutriBot offers general guidance, not medical advice.</p>
          </div>
        </div>}
      </div>
    </section>}
    {showLimitModal && <div className="chatbot-widget__modal-overlay" onClick={() => setShowLimitModal(false)}><div className="chatbot-widget__modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="limit-modal-title"><button type="button" className="chatbot-widget__modal-close" onClick={() => setShowLimitModal(false)} aria-label="Close"><X size={18} /></button><div className="chatbot-widget__modal-icon"><AlertCircle size={48} /></div><h2 id="limit-modal-title">Your free trial has ended</h2><p>You have used all {GUEST_TRIAL_LIMIT} free questions with NutriBot.</p><p className="chatbot-widget__modal-cta">Create an account or log in to keep chatting with NutriBot.</p><div className="chatbot-widget__modal-actions"><button type="button" className="chatbot-widget__modal-btn chatbot-widget__modal-btn--primary" onClick={() => openAuth('signup')}>Sign Up</button><button type="button" className="chatbot-widget__modal-btn chatbot-widget__modal-btn--secondary" onClick={() => openAuth('login')}>Log In</button></div></div></div>}
    {authMode && <AuthModal mode={authMode} backdropClassName="chatbot-auth-backdrop" onClose={() => setAuthMode(null)} onSubmit={(_, mode) => setAuthMode(mode)} onAuthenticated={(data) => navigate(isAdminRole(data?.role) ? '/admin' : '/home', { replace: true })} onGoogle={() => window.location.assign(googleAuthUrl())} />}
    <button ref={launcherRef} type="button" className={`chatbot-widget__launcher${isOpen ? ' is-open' : ''}`} onClick={isOpen ? closeWidget : openWidget} aria-label={isOpen ? 'Minimize NutriBot chat' : 'Open NutriBot chat'} aria-expanded={isOpen} aria-controls="nutribot-chat-panel"><span className="chatbot-widget__launcher-icon" aria-hidden="true">{isOpen ? <ChevronDown size={23} /> : <NutriBotIcon size={24} />}</span><span className="chatbot-widget__launcher-label" aria-hidden="true">Ask NutriBot</span></button>
  </div>;
}
