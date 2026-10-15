import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import {
  AlertCircle,
  BotMessageSquare,
  ChevronDown,
  ChevronRight,
  Clock3,
  FileVideo,
  History,
  Image as ImageIcon,
  Link2,
  Loader2,
  Maximize2,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
  Paperclip,
  Plus,
  Search,
  Send,
  Sparkles,
  Trash2,
  Video,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getChatMessages, getChatSessions, requestNutritionAdvice } from '../../services/chatbotApi';
import { googleAuthUrl } from '../../services/contentApi';
import { isAdminRole } from '../../utils/auth';
import AuthModal from '../AuthModal';
import '../../styles/chatbot-widget.css';

const GUEST_TRIAL_LIMIT = 3;
const GUEST_SESSION_KEY = 'nutribot_guest_chat_session_id';
const MAX_MESSAGE_LENGTH = 2_000;
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 25 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

const QUICK_PROMPTS = [
  'Build a balanced plate',
  'High-protein meal ideas',
  'Healthy afternoon snacks',
  'Plan an easy breakfast',
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

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
const formatBytes = (value) => `${(value / (1024 * 1024)).toFixed(value >= 1024 * 1024 ? 1 : 2)} MB`;
const normalizeList = (value) => Array.isArray(value) ? value.filter(Boolean) : [];

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

function AnalysisCard({ attachment, videoAnalysis }) {
  const [expanded, setExpanded] = useState(false);
  if (attachment?.type === 'IMAGE') {
    const recognized = normalizeList(attachment.recognizedIngredients);
    const uncertain = normalizeList(attachment.uncertainIngredients);
    const warnings = normalizeList(attachment.warnings);
    if (!recognized.length && !uncertain.length && !warnings.length) return null;
    return <section className="chatbot-analysis-card chatbot-analysis-card--image" aria-label="Ingredient analysis">
      <header><span className="chatbot-analysis-card__icon"><ImageIcon size={15} /></span><strong>Ingredient analysis</strong></header>
      {recognized.length > 0 && <div className="chatbot-analysis-card__group"><span className="chatbot-analysis-card__label">Clearly visible</span><ul>{recognized.map((item) => <li key={item}>{item}</li>)}</ul></div>}
      {uncertain.length > 0 && <div className="chatbot-analysis-card__group is-muted"><span className="chatbot-analysis-card__label">Uncertain</span><ul>{uncertain.map((item) => <li key={item}>{item}</li>)}</ul></div>}
      {warnings.length > 0 && <p className="chatbot-analysis-card__warning"><AlertCircle size={14} />{warnings.join(' ')}</p>}
    </section>;
  }

  if (!videoAnalysis) return null;
  const ingredients = normalizeList(videoAnalysis.ingredients);
  const steps = normalizeList(videoAnalysis.steps);
  const uncertainties = normalizeList(videoAnalysis.uncertainties);
  const visibleSteps = expanded ? steps : steps.slice(0, 3);
  return <section className="chatbot-analysis-card chatbot-analysis-card--video" aria-label="Video analyzed">
    <header><span className="chatbot-analysis-card__icon"><Video size={15} /></span><strong>Video analyzed</strong></header>
    <h4>{videoAnalysis.dish_name || videoAnalysis.dishName || 'Dish name unavailable'}</h4>
    <p className="chatbot-analysis-card__summary">{ingredients.length} ingredients · {steps.length} instructions</p>
    {ingredients.length > 0 && <div className="chatbot-analysis-card__group"><span className="chatbot-analysis-card__label">Ingredients</span><p>{ingredients.map((item) => typeof item === 'string' ? item : item.name).join(', ')}</p></div>}
    {steps.length > 0 && <div className="chatbot-analysis-card__group"><span className="chatbot-analysis-card__label">Instructions</span><ol>{visibleSteps.map((item, index) => <li key={`${item.instruction || item}-${index}`}>{typeof item === 'string' ? item : item.instruction}</li>)}</ol>{steps.length > 3 && <button type="button" className="chatbot-analysis-card__expand" onClick={() => setExpanded((current) => !current)}>{expanded ? 'Show less' : 'Show all'} <ChevronRight size={14} className={expanded ? 'is-rotated' : ''} /></button>}</div>}
    {uncertainties.length > 0 && <p className="chatbot-analysis-card__warning"><AlertCircle size={14} />{uncertainties.join(' ')}</p>}
  </section>;
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
  const [isLoading, setIsLoading] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [authMode, setAuthMode] = useState(null);
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('nutribot-auth-token'));
  const [guestTrialsLeft, setGuestTrialsLeft] = useState(null);
  const [attachment, setAttachment] = useState(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [mediaError, setMediaError] = useState('');
  const panelRef = useRef(null);
  const threadRef = useRef(null);
  const inputRef = useRef(null);
  const launcherRef = useRef(null);
  const imageInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const attachmentMenuRef = useRef(null);
  const requestControllerRef = useRef(null);
  const activeRequestRef = useRef(null);
  const requestSequenceRef = useRef(0);
  const conversationKeyRef = useRef(0);
  const sendingRef = useRef(false);
  const sessionIdRef = useRef(null);
  const isGuest = !authToken;

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

  const loadSessions = useCallback(async () => {
    setHistoryState('loading'); setHistoryError('');
    try { setSessions(await getChatSessions()); setHistoryState('ready'); }
    catch { setHistoryError('Chat history is unavailable. Please try again.'); setHistoryState('error'); }
  }, []);
  const openWidget = useCallback(() => { refreshAuthState(); setIsMounted(true); setIsOpen(true); }, [refreshAuthState]);
  const openHistory = async () => { if (isGuest) return; setHistoryOpen(true); if (historyState !== 'loading') await loadSessions(); };
  const abortActiveRequest = useCallback(() => {
    conversationKeyRef.current += 1;
    requestControllerRef.current?.abort();
    requestControllerRef.current = null; activeRequestRef.current = null; sendingRef.current = false; setIsLoading(false);
  }, []);
  const startNewConversation = () => {
    abortActiveRequest();
    sessionIdRef.current = null;
    setConversationState('new');
    setConversationError('');
    setMessages(INITIAL_MESSAGES);
    setHistoryOpen(false);
    setAttachmentMenuOpen(false);
  };
  const selectSession = async (sessionId) => {
    abortActiveRequest();
    const key = conversationKeyRef.current;
    setConversationState('loading');
    setConversationError('');
    setHistoryState('loading');
    setHistoryError('');
    setMessages([]);
    setAttachmentMenuOpen(false);
    let loaded = false;
    try {
      const persisted = await getChatMessages(sessionId);
      if (key !== conversationKeyRef.current) return;
      sessionIdRef.current = sessionId;
      setMessages(persisted.map((item) => ({ id: item.messageId, sender: item.senderType === 'USER' ? 'user' : 'assistant', text: item.content, createdAt: item.createdAt, attachment: item.attachments?.[0] })));
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
      if (attachmentMenuOpen) { setAttachmentMenuOpen(false); return; }
      closeWidget();
    };
    window.addEventListener('open-nutribot-chat', externalOpen); window.addEventListener('keydown', keydown);
    return () => { window.removeEventListener('open-nutribot-chat', externalOpen); window.removeEventListener('keydown', keydown); };
  }, [attachmentMenuOpen, closeWidget, isOpen, openWidget]);
  useEffect(() => {
    const storage = (event) => { if (event.key === 'nutribot-auth-token') refreshAuthState(); };
    window.addEventListener('storage', storage); window.addEventListener('focus', refreshAuthState); window.addEventListener('nutribot-auth-changed', refreshAuthState);
    return () => { window.removeEventListener('storage', storage); window.removeEventListener('focus', refreshAuthState); window.removeEventListener('nutribot-auth-changed', refreshAuthState); };
  }, [refreshAuthState]);
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
    const entered = window.prompt('Paste a YouTube video link (https://youtu.be/...):');
    if (entered == null) return;
    const value = entered.trim();
    if (!value) { setYoutubeUrl(''); return; }
    if (!isValidYoutubeUrl(value)) { setMediaError('Enter a valid YouTube video URL.'); return; }
    setMediaError('');
    if (attachment?.preview) URL.revokeObjectURL(attachment.preview);
    setAttachment(null);
    setYoutubeUrl(value);
  };

  const submitMessage = async (value = draft, retryContext = null) => {
    const message = value.trim(); const selectedAttachment = retryContext?.attachment ?? attachment;
    const selectedYoutube = retryContext?.youtubeUrl ?? youtubeUrl;
    if ((!message && !selectedAttachment && !selectedYoutube) || message.length > MAX_MESSAGE_LENGTH || isLoading || sendingRef.current) return;
    if ((selectedAttachment || selectedYoutube) && isGuest) { setMediaError('Sign in to send an image or video for analysis.'); return; }
    sendingRef.current = true;
    const conversationHistory = retryContext?.conversationHistory ?? messages.filter((item) => item.id !== 'welcome' && !item.pending && !item.error).slice(-40).map((item) => ({ sender: item.sender === 'user' ? 'USER' : 'ASSISTANT', content: item.text }));
    const guest = retryContext?.guest ?? isGuest;
    const sessionId = retryContext?.sessionId ?? (guest ? getGuestSessionId() : sessionIdRef.current);
    const conversationKey = retryContext?.conversationKey ?? conversationKeyRef.current;
    if (conversationKey !== conversationKeyRef.current) { sendingRef.current = false; return; }
    const requestId = ++requestSequenceRef.current;
    const userMessage = { id: `user-${Date.now()}`, sender: 'user', text: message, attachment: selectedAttachment ? { type: selectedAttachment.type, filename: selectedAttachment.filename, mimeType: selectedAttachment.mimeType, preview: selectedAttachment.preview, size: selectedAttachment.size } : (selectedYoutube ? { type: 'VIDEO', url: selectedYoutube } : null) };
    const pendingId = `pending-${Date.now()}`;
    setConversationState('active');
    setConversationError('');
    setMessages((current) => [...current.filter((item) => item.id !== retryContext?.errorId), ...(retryContext ? [] : [userMessage]), { id: pendingId, sender: 'assistant', text: '', pending: true, mediaKind: selectedAttachment?.kind ?? (selectedYoutube ? 'video' : undefined) }]);
    setDraft(''); setAttachment(null); setYoutubeUrl(''); setMediaError(''); setIsLoading(true); setAttachmentMenuOpen(false); onSend?.(message);
    const controller = new AbortController(); requestControllerRef.current = controller; activeRequestRef.current = { id: requestId, conversationKey };
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => { timeoutId = window.setTimeout(() => { const timeoutError = new Error('NutriBot request timed out.'); timeoutError.code = 'CHATBOT_TIMEOUT'; controller.abort(); reject(timeoutError); }, REQUEST_TIMEOUT_MS); });
    try {
      const response = await Promise.race([requestNutritionAdvice({ message, sessionId, conversationHistory: guest ? conversationHistory : [], attachment: selectedAttachment ? { type: selectedAttachment.type, dataBase64: selectedAttachment.dataBase64, mimeType: selectedAttachment.mimeType, filename: selectedAttachment.filename } : (selectedYoutube ? { type: 'VIDEO', url: selectedYoutube } : undefined), signal: controller.signal }), timeoutPromise]);
      if (activeRequestRef.current?.id !== requestId || conversationKey !== conversationKeyRef.current) return;
      const assistantText = typeof (response.content || response.reply) === 'string' ? (response.content || response.reply).trim() : '';
      if (!assistantText) { const invalid = new Error('NutriBot returned an incomplete response.'); invalid.code = 'CHATBOT_INVALID_RESPONSE'; throw invalid; }
      if (!guest && response.sessionId != null) sessionIdRef.current = response.sessionId;
      if (guest) syncGuestTrialCount(response.remainingTrialCount);
      setMessages((current) => [...current.filter((item) => item.id !== pendingId), { id: `assistant-${Date.now()}`, sender: 'assistant', text: assistantText, analysis: response.attachment, videoAnalysis: response.videoAnalysis || response.video_analysis }]);
    } catch (error) {
      if (activeRequestRef.current?.id !== requestId || conversationKey !== conversationKeyRef.current) return;
      if (error.name === 'AbortError') { setMessages((current) => current.filter((item) => item.id !== pendingId)); return; }
      if (error.status === 429 && isGuest) syncGuestTrialCount(0);
      const messageText = error.status === 429 ? 'The AI service has reached its usage limit. Please try again later.' : error.code === 'CHATBOT_TIMEOUT' ? 'NutriBot is taking too long to respond. Please try again.' : error.code === 'CHATBOT_INVALID_RESPONSE' ? 'NutriBot returned an incomplete response. Please try again.' : error.status === 503 || error.status === 504 ? 'NutriBot is temporarily unavailable. Please try again shortly.' : error.status === 413 ? 'The attachment exceeds the allowed size.' : 'NutriBot could not respond right now. Please try again.';
      setMessages((current) => [...current.filter((item) => item.id !== pendingId), { id: `error-${Date.now()}`, sender: 'assistant', text: messageText, error: true, retry: { message, sessionId, guest, conversationHistory, conversationKey, attachment: selectedAttachment, youtubeUrl: selectedYoutube } }]);
    } finally { window.clearTimeout(timeoutId); if (activeRequestRef.current?.id === requestId) { requestControllerRef.current = null; activeRequestRef.current = null; sendingRef.current = false; setIsLoading(false); } }
  };
  const retryMessage = (item) => item.retry && submitMessage(item.retry.message, { ...item.retry, errorId: item.id });
  const openAuth = (mode) => { setShowLimitModal(false); setIsOpen(false); setIsMounted(false); onAuth ? onAuth(mode) : navigate('/', { state: { authMode: mode } }); };
  const filteredSessions = sessions.filter((item) => `${item.title} ${item.preview}`.toLowerCase().includes(historyQuery.toLowerCase()));
  const toggleFullscreen = () => { setDisplayMode((mode) => mode === 'fullscreen' ? 'compact' : 'fullscreen'); setHistoryOpen(false); setAttachmentMenuOpen(false); };

  const trimText = (value, length) => {
    const clean = String(value || '').replace(/\s+/g, ' ').trim();
    return clean.length > length ? `${clean.slice(0, length - 1).trimEnd()}…` : clean;
  };
  const sessionTitle = (session) => trimText(session.title || session.preview || 'New conversation', 58);
  const sessionPreview = (session) => trimText(session.title ? (session.preview || 'No messages yet') : '', 92);
  const showWelcome = conversationState === 'new';

  const historyPanel = <aside className={`chatbot-widget__history${displayMode === 'fullscreen' ? ' chatbot-widget__history--sidebar' : ''}`} aria-label="Chat history">
    <div className="chatbot-widget__history-head"><div><span>YOUR CONVERSATIONS</span><h2>Pick up where you left off.</h2></div><button type="button" onClick={startNewConversation}><Plus size={16} /> <span>NEW CONVERSATION</span></button></div>
    <label className="chatbot-widget__history-search"><Search size={15} /><input value={historyQuery} onChange={(event) => setHistoryQuery(event.target.value)} placeholder="Search conversations" aria-label="Search conversations" /></label>
    <div className="chatbot-widget__history-list">
      {historyState === 'loading' && <p className="chatbot-widget__history-status"><Loader2 className="is-spinning" size={17} /> Loading conversations...</p>}
      {historyState === 'error' && <p className="chatbot-widget__history-status is-error">{historyError}</p>}
      {historyState === 'ready' && !filteredSessions.length && <p className="chatbot-widget__history-status">No conversations yet.</p>}
      {historyState === 'ready' && filteredSessions.map((session) => <button type="button" key={session.sessionId} className={`chatbot-widget__history-item${String(session.sessionId) === String(sessionIdRef.current) ? ' is-active' : ''}`} onClick={() => selectSession(session.sessionId)}><span>{sessionTitle(session)}</span><small>{sessionPreview(session)}<i><Clock3 size={12} /> {session.updatedAt ? new Date(session.updatedAt).toLocaleDateString('vi-VN') : ''}</i></small></button>)}
    </div>
  </aside>;

  return <div className={`chatbot-widget${displayMode === 'fullscreen' && isOpen ? ' is-fullscreen' : ''}${isOpen ? ' is-open' : ''}`}>
    {isMounted && !showLimitModal && <section ref={panelRef} id="nutribot-chat-panel" className={`chatbot-widget__panel${displayMode === 'fullscreen' ? ' chatbot-widget__panel--fullscreen' : ''}`} role="dialog" aria-label="NutriBot nutrition assistant" aria-modal={displayMode === 'fullscreen' ? 'true' : 'false'}>
      <header className="chatbot-widget__header">
        <div className="chatbot-widget__brand"><span className="chatbot-widget__brand-mark" aria-hidden="true"><BotMessageSquare size={20} /></span><span><strong>NutriBot AI</strong><small><i aria-hidden="true" /> {isLoading ? (attachment?.kind === 'video' ? 'Analyzing video...' : attachment?.kind === 'image' ? 'Analyzing image...' : 'Thinking...') : 'Ready to help'}</small></span></div>
        <div className="chatbot-widget__header-actions">
          {!isGuest && <button type="button" className="chatbot-widget__history-toggle" onClick={displayMode === 'fullscreen' ? () => setHistorySidebarOpen((current) => !current) : openHistory} aria-label={displayMode === 'fullscreen' ? (historySidebarOpen ? 'Hide chat history' : 'Show chat history') : 'Open chat history'}>{displayMode === 'fullscreen' ? (historySidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />) : <History size={18} />}</button>}
          <button type="button" className="chatbot-widget__expand-toggle" onClick={toggleFullscreen} aria-label={displayMode === 'fullscreen' ? 'Minimize NutriBot chat' : 'Expand NutriBot chat'}>{displayMode === 'fullscreen' ? <Minimize2 size={18} /> : <Maximize2 size={18} />}</button>
          <button type="button" className="chatbot-widget__minimize" onClick={closeWidget} aria-label="Close NutriBot chat"><X size={19} /></button>
        </div>
      </header>
      {historyOpen && displayMode === 'compact' && historyPanel}
      <div className="chatbot-widget__body">
        {displayMode === 'fullscreen' && historySidebarOpen && historyPanel}
        <div className="chatbot-widget__conversation">
          <div ref={threadRef} className="chatbot-widget__thread" aria-live="polite">
            <div className="chatbot-widget__conversation-inner">
              {showWelcome && <div className="chatbot-widget__welcome"><span className="chatbot-widget__identity-mark" aria-hidden="true"><Sparkles size={23} /></span><div><p>Your everyday nutrition companion</p><h2>Small choices, made clearer.</h2></div></div>}
              {conversationState === 'loading' && <p className="chatbot-widget__conversation-status"><Loader2 className="is-spinning" size={17} /> Loading conversation...</p>}
              {conversationError && conversationState !== 'loading' && <p className="chatbot-widget__conversation-status is-error" role="alert">{conversationError}</p>}
              <div className="chatbot-widget__messages">{messages.map((item, index) => <div key={item.id} className={`chatbot-widget__message-row chatbot-widget__message-row--${item.sender}`} data-latest-message={index === messages.length - 1 ? 'true' : undefined}>
                {item.attachment && <div className="chatbot-widget__sent-media">{item.attachment.type === 'IMAGE' && item.attachment.preview ? <img src={item.attachment.preview} alt={item.attachment.filename || 'Ingredient image'} /> : item.attachment.url ? <><Link2 size={17} /><span>{item.attachment.url}</span></> : <><FileVideo size={17} /><span>{item.attachment.filename}</span><small>{formatBytes(item.attachment.size || 0)}</small></>}</div>}
                <div className={`chatbot-widget__message chatbot-widget__message--${item.sender}`}>{item.pending ? <span className="chatbot-widget__typing" aria-label={item.mediaKind === 'video' ? 'Analyzing video' : item.mediaKind === 'image' ? 'Analyzing image' : 'NutriBot is thinking'}><i /><i /><i /></span> : <>{item.text}{item.analysis && <AnalysisCard attachment={item.analysis} videoAnalysis={item.videoAnalysis} />}{item.videoAnalysis && !item.analysis && <AnalysisCard videoAnalysis={item.videoAnalysis} />}{item.error && item.retry && <button type="button" className="chatbot-widget__retry" onClick={() => retryMessage(item)}>Retry</button>}</>}</div>
              </div>)}</div>
              {showWelcome && <div className="chatbot-widget__prompts" aria-label="Suggested questions">{QUICK_PROMPTS.map((prompt) => <button key={prompt} type="button" className="chatbot-widget__prompt" onClick={() => submitMessage(prompt)} disabled={isLoading}><span>{prompt}</span><span aria-hidden="true">+</span></button>)}</div>}
            </div>
          </div>
          <div className="chatbot-widget__composer-wrap">
            {mediaError && <p className="chatbot-widget__media-error" role="alert"><AlertCircle size={14} />{mediaError}</p>}
            {youtubeUrl && <div className="chatbot-widget__attachment-preview"><Link2 size={17} /><span>{youtubeUrl}</span><button type="button" onClick={() => setYoutubeUrl('')} aria-label="Remove YouTube URL"><X size={15} /></button></div>}
            {attachment && <div className="chatbot-widget__attachment-preview">{attachment.kind === 'image' && attachment.preview ? <img src={attachment.preview} alt="Selected image" /> : <FileVideo size={17} />}<span>{attachment.filename}<small>{formatBytes(attachment.size)}</small></span><button type="button" onClick={clearAttachment} aria-label="Remove attachment"><Trash2 size={15} /></button></div>}
            <form className="chatbot-widget__composer" onSubmit={(event) => { event.preventDefault(); submitMessage(); }}>
              <div ref={attachmentMenuRef} className="chatbot-widget__attach-wrap"><button type="button" className="chatbot-widget__attach-button" onClick={() => setAttachmentMenuOpen((current) => !current)} aria-label="Add attachment" aria-expanded={attachmentMenuOpen}><Paperclip size={18} /></button>{attachmentMenuOpen && <div className="chatbot-widget__attach-menu"><button type="button" onClick={() => imageInputRef.current?.click()}><ImageIcon size={16} /> Upload ingredient image</button><button type="button" onClick={() => videoInputRef.current?.click()}><Video size={16} /> Upload cooking video</button><button type="button" onClick={chooseYoutube}><Link2 size={16} /> Paste YouTube link</button></div>}</div>
              <label htmlFor="nutribot-message" className="chatbot-widget__sr-only">Message NutriBot</label><input ref={inputRef} id="nutribot-message" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Ask about food or nutrition..." autoComplete="off" maxLength={MAX_MESSAGE_LENGTH} disabled={isLoading} /><button type="submit" disabled={(!draft.trim() && !attachment && !youtubeUrl) || isLoading} aria-label="Send message"><Send size={18} /></button>
            </form>
            <input ref={imageInputRef} className="chatbot-widget__file-input" type="file" accept={IMAGE_TYPES.join(',')} onChange={(event) => chooseMedia(event, 'image')} /><input ref={videoInputRef} className="chatbot-widget__file-input" type="file" accept={VIDEO_TYPES.join(',')} onChange={(event) => chooseMedia(event, 'video')} />
            {showTrialBadge && <div className={`chatbot-widget__trial-badge${guestTrialsLeft === 1 ? ' is-warning' : ''}`} aria-live="polite"><AlertCircle size={13} aria-hidden="true" /><span><strong>{guestTrialsLeft} of {GUEST_TRIAL_LIMIT}</strong> questions left</span></div>}
            <p className="chatbot-widget__notice">NutriBot offers general guidance, not medical advice.</p>
          </div>
        </div>
      </div>
    </section>}
    {showLimitModal && <div className="chatbot-widget__modal-overlay" onClick={() => setShowLimitModal(false)}><div className="chatbot-widget__modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="limit-modal-title"><button type="button" className="chatbot-widget__modal-close" onClick={() => setShowLimitModal(false)} aria-label="Close"><X size={18} /></button><div className="chatbot-widget__modal-icon"><AlertCircle size={48} /></div><h2 id="limit-modal-title">Your free trial has ended</h2><p>You have used all {GUEST_TRIAL_LIMIT} free questions with NutriBot.</p><p className="chatbot-widget__modal-cta">Create an account or log in to keep chatting with NutriBot.</p><div className="chatbot-widget__modal-actions"><button type="button" className="chatbot-widget__modal-btn chatbot-widget__modal-btn--primary" onClick={() => openAuth('signup')}>Sign Up</button><button type="button" className="chatbot-widget__modal-btn chatbot-widget__modal-btn--secondary" onClick={() => openAuth('login')}>Log In</button></div></div></div>}
    {authMode && <AuthModal mode={authMode} backdropClassName="chatbot-auth-backdrop" onClose={() => setAuthMode(null)} onSubmit={(_, mode) => setAuthMode(mode)} onAuthenticated={(data) => navigate(isAdminRole(data?.role) ? '/admin' : '/home', { replace: true })} onGoogle={() => window.location.assign(googleAuthUrl())} />}
    <button ref={launcherRef} type="button" className={`chatbot-widget__launcher${isOpen ? ' is-open' : ''}`} onClick={isOpen ? closeWidget : openWidget} aria-label={isOpen ? 'Minimize NutriBot chat' : 'Open NutriBot chat'} aria-expanded={isOpen} aria-controls="nutribot-chat-panel"><span className="chatbot-widget__launcher-icon" aria-hidden="true">{isOpen ? <ChevronDown size={23} /> : <BotMessageSquare size={24} />}</span><span className="chatbot-widget__launcher-label" aria-hidden="true">Ask NutriBot</span></button>
  </div>;
}
