import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import {
  BotMessageSquare,
  ChevronDown,
  Clock3,
  History,
  Plus,
  Search,
  Send,
  Sparkles,
  AlertCircle,
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

const getGuestSessionId = () => {
  let sessionId = localStorage.getItem(GUEST_SESSION_KEY);
  if (!sessionId) {
    sessionId = globalThis.crypto?.randomUUID?.()
      || `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(GUEST_SESSION_KEY, sessionId);
  }
  return sessionId;
};

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

const QUICK_PROMPTS = [
  'Build a balanced plate',
  'High-protein meal ideas',
  'Healthy afternoon snacks',
  'Plan an easy breakfast',
];

const INITIAL_MESSAGES = [
  {
    id: 'welcome',
    sender: 'assistant',
    text: 'Hi, I am NutriBot. Ask me about everyday nutrition, balanced meals, or healthier food choices.',
  },
];

export default function ChatbotWidget({ onSend, onAuth }) {
  const navigate = useNavigate();
  const [isMounted, setIsMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [historyQuery, setHistoryQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [authMode, setAuthMode] = useState(null);
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('nutribot-auth-token'));
  const [guestTrialsLeft, setGuestTrialsLeft] = useState(null);
  const panelRef = useRef(null);
  const threadRef = useRef(null);
  const inputRef = useRef(null);
  const launcherRef = useRef(null);
  const requestControllerRef = useRef(null);
  const activeRequestRef = useRef(null);
  const requestSequenceRef = useRef(0);
  const conversationKeyRef = useRef(0);
  const sendingRef = useRef(false);
  const sessionIdRef = useRef(null);

  const isGuest = !authToken;

  const refreshAuthState = useCallback(() => {
    setAuthToken(localStorage.getItem('nutribot-auth-token'));
  }, []);

  const syncGuestTrialCount = useCallback((remaining) => {
    if (!isGuest || !Number.isInteger(remaining)) return;
    const count = Math.max(0, Math.min(GUEST_TRIAL_LIMIT, remaining));
    setGuestTrialsLeft(count);
    if (count === 0) setShowLimitModal(true);
  }, [isGuest]);

  const showTrialBadge = isGuest && Number.isInteger(guestTrialsLeft) && guestTrialsLeft > 0;

  const openAuth = (mode) => {
    setShowLimitModal(false);
    if (onAuth) {
      onAuth(mode);
      return;
    }
    navigate('/', { state: { authMode: mode } });
  };

  const loadSessions = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError('');
    try { setSessions(await getChatSessions()); }
    catch { setHistoryError('Unable to load chat history. Please try again.'); }
    finally { setHistoryLoading(false); }
  }, []);

  const openWidget = useCallback(() => {
    refreshAuthState();
    setIsMounted(true);
    setIsOpen(true);
  }, [refreshAuthState]);

  const openHistory = async () => {
    if (isGuest) return;
    setHistoryOpen(true);
    await loadSessions();
  };
  const abortActiveRequest = useCallback(() => {
    conversationKeyRef.current += 1;
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
    activeRequestRef.current = null;
    sendingRef.current = false;
    setIsLoading(false);
  }, []);

  const startNewConversation = () => {
    abortActiveRequest();
    sessionIdRef.current = null;
    setMessages(INITIAL_MESSAGES);
    setHistoryOpen(false);
  };
  const selectSession = async (sessionId) => {
    abortActiveRequest();
    const conversationKey = conversationKeyRef.current;
    setHistoryLoading(true);
    setHistoryError('');
    setMessages(INITIAL_MESSAGES);
    try {
      const persistedMessages = await getChatMessages(sessionId);
      if (conversationKey !== conversationKeyRef.current) return;
      sessionIdRef.current = sessionId;
      setMessages(persistedMessages.length ? persistedMessages.map((item) => ({ id: item.messageId, sender: item.senderType === 'USER' ? 'user' : 'assistant', text: item.content, createdAt: item.createdAt })) : INITIAL_MESSAGES);
      setHistoryOpen(false);
    } catch { setHistoryError('Unable to load this conversation. Please try again.'); }
    finally { setHistoryLoading(false); }
  };

  const closeWidget = useCallback(() => {
    const panel = panelRef.current;
    const reduceMotion = prefersReducedMotion();
    const restoreFocus = () => requestAnimationFrame(() => launcherRef.current?.focus());

    if (!panel || reduceMotion) {
      setIsOpen(false);
      setIsMounted(false);
      restoreFocus();
      return;
    }

    gsap.to(panel, {
      autoAlpha: 0,
      x: 22,
      y: 14,
      scale: 0.97,
      duration: 0.24,
      ease: 'power2.in',
      onComplete: () => {
        setIsOpen(false);
        setIsMounted(false);
        restoreFocus();
      },
    });
  }, []);

  useEffect(() => {
    const handleExternalOpen = () => openWidget();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && isOpen) closeWidget();
    };

    window.addEventListener('open-nutribot-chat', handleExternalOpen);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('open-nutribot-chat', handleExternalOpen);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeWidget, isOpen, openWidget]);

  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key === 'nutribot-auth-token') refreshAuthState();
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('focus', refreshAuthState);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', refreshAuthState);
    };
  }, [refreshAuthState]);

  useEffect(() => () => requestControllerRef.current?.abort(), []);

  useEffect(() => {
    if (isOpen && isGuest && guestTrialsLeft === 0) setShowLimitModal(true);
    if (!isGuest) {
      setShowLimitModal(false);
      setHistoryOpen(false);
    }
  }, [guestTrialsLeft, isGuest, isOpen]);

  useEffect(() => {
    threadRef.current?.scrollTo?.({
      top: threadRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages]);

  useGSAP(() => {
    if (!isMounted || !isOpen || !panelRef.current) return;

    const reduceMotion = prefersReducedMotion();
    if (reduceMotion) {
      gsap.set(panelRef.current, { autoAlpha: 1, x: 0, y: 0, scale: 1 });
      inputRef.current?.focus();
      return;
    }

    const timeline = gsap.timeline({
      defaults: { ease: 'power3.out' },
      onComplete: () => inputRef.current?.focus(),
    });

    timeline
      .fromTo(
        panelRef.current,
        { autoAlpha: 0, x: 30, y: 18, scale: 0.94 },
        { autoAlpha: 1, x: 0, y: 0, scale: 1, duration: 0.42 },
      )
      .fromTo(
        '.chatbot-widget__identity-mark',
        { autoAlpha: 0, scale: 0.72, rotate: -8 },
        { autoAlpha: 1, scale: 1, rotate: 0, duration: 0.38 },
        '-=0.25',
      )
      .fromTo(
        '.chatbot-widget__prompt',
        { autoAlpha: 0, y: 12 },
        { autoAlpha: 1, y: 0, duration: 0.3, stagger: 0.055 },
        '-=0.22',
      );
  }, { dependencies: [isMounted, isOpen], scope: panelRef });

  useGSAP(() => {
    if (!isOpen || messages.length === INITIAL_MESSAGES.length) return;

    const latestMessage = panelRef.current?.querySelector('[data-latest-message="true"]');
    if (!latestMessage) return;

    gsap.fromTo(
      latestMessage,
      { autoAlpha: 0, y: 14, scale: 0.96 },
      { autoAlpha: 1, y: 0, scale: 1, duration: 0.32, ease: 'power2.out' },
    );
  }, { dependencies: [messages.length, isOpen], scope: panelRef });

  const submitMessage = async (value = draft, retryContext = null) => {
    const message = value.trim();
    if (!message || message.length > MAX_MESSAGE_LENGTH || isLoading || sendingRef.current) return;
    sendingRef.current = true;

    const conversationHistory = retryContext?.conversationHistory ?? messages
      .filter((item) => item.id !== 'welcome' && !item.pending && !item.error)
      .slice(-40)
      .map((item) => ({ sender: item.sender === 'user' ? 'USER' : 'ASSISTANT', content: item.text }));
    const guest = retryContext?.guest ?? isGuest;
    const sessionId = retryContext?.sessionId ?? (guest ? getGuestSessionId() : sessionIdRef.current);
    const conversationKey = retryContext?.conversationKey ?? conversationKeyRef.current;
    if (conversationKey !== conversationKeyRef.current) {
      sendingRef.current = false;
      return;
    }

    const requestId = ++requestSequenceRef.current;
    const userMessage = { id: `user-${Date.now()}`, sender: 'user', text: message };
    const pendingId = `pending-${Date.now()}`;
    setMessages((current) => [
      ...current.filter((item) => item.id !== retryContext?.errorId),
      ...(retryContext ? [] : [userMessage]),
      { id: pendingId, sender: 'assistant', text: '', pending: true },
    ]);
    setDraft('');
    setIsLoading(true);
    onSend?.(message);

    const controller = new AbortController();
    requestControllerRef.current = controller;
    activeRequestRef.current = { id: requestId, conversationKey };
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = window.setTimeout(() => {
        const timeoutError = new Error('NutriBot request timed out.');
        timeoutError.code = 'CHATBOT_TIMEOUT';
        controller.abort();
        reject(timeoutError);
      }, REQUEST_TIMEOUT_MS);
    });

    try {
      const response = await Promise.race([
        requestNutritionAdvice({
          message,
          sessionId,
          conversationHistory: guest ? conversationHistory : [],
          signal: controller.signal,
        }),
        timeoutPromise,
      ]);
      if (activeRequestRef.current?.id !== requestId || conversationKey !== conversationKeyRef.current) return;
      const assistantText = typeof (response.content || response.reply) === 'string'
        ? (response.content || response.reply).trim()
        : '';
      if (!assistantText) {
        const invalidResponseError = new Error('NutriBot returned an incomplete response.');
        invalidResponseError.code = 'CHATBOT_INVALID_RESPONSE';
        throw invalidResponseError;
      }
      if (!guest && response.sessionId != null) sessionIdRef.current = response.sessionId;
      if (guest) syncGuestTrialCount(response.remainingTrialCount);
      setMessages((current) => [
        ...current.filter((item) => item.id !== pendingId),
        { id: `assistant-${Date.now()}`, sender: 'assistant', text: assistantText },
      ]);
    } catch (error) {
      if (activeRequestRef.current?.id !== requestId || conversationKey !== conversationKeyRef.current) return;
      if (error.name === 'AbortError') {
        setMessages((current) => current.filter((item) => item.id !== pendingId));
        return;
      }
      if (error.status === 429 && isGuest) syncGuestTrialCount(0);
      const messageText = error.status === 429
        ? 'You have used all 3 free questions with NutriBot.'
        : error.code === 'CHATBOT_TIMEOUT'
        ? 'NutriBot is taking too long to respond. Please try again.'
        : error.code === 'CHATBOT_INVALID_RESPONSE'
        ? 'NutriBot returned an incomplete response. Please try again.'
        : error.status === 503
        ? 'NutriBot is temporarily unavailable. Please try again shortly.'
        : 'NutriBot could not respond right now. Please try again.';
      setMessages((current) => [
        ...current.filter((item) => item.id !== pendingId),
        {
          id: `error-${Date.now()}`,
          sender: 'assistant',
          text: messageText,
          error: true,
          retry: { message, sessionId, guest, conversationHistory, conversationKey },
        },
      ]);
    } finally {
      window.clearTimeout(timeoutId);
      if (activeRequestRef.current?.id === requestId) {
        requestControllerRef.current = null;
        activeRequestRef.current = null;
        sendingRef.current = false;
        setIsLoading(false);
      }
    }
  };

  const retryMessage = (errorMessage) => {
    if (!errorMessage.retry) return;
    submitMessage(errorMessage.retry.message, { ...errorMessage.retry, errorId: errorMessage.id });
  };

  return (
    <div className="chatbot-widget">
      {isMounted && !showLimitModal && (
        <section
          ref={panelRef}
          id="nutribot-chat-panel"
          className="chatbot-widget__panel"
          role="dialog"
          aria-label="NutriBot nutrition assistant"
          aria-modal="false"
        >
          <header className="chatbot-widget__header">
            <div className="chatbot-widget__brand">
              <span className="chatbot-widget__brand-mark" aria-hidden="true">
                <BotMessageSquare size={20} strokeWidth={1.9} />
              </span>
              <span>
                <strong>NutriBot AI</strong>
                <small><i aria-hidden="true" /> {isLoading ? 'Thinking...' : 'Ready to help'}</small>
              </span>
            </div>
            <div className="chatbot-widget__header-actions">
              {!isGuest && <button type="button" className="chatbot-widget__history-toggle" onClick={openHistory} aria-label="Open chat history"><History size={18} /></button>}
            <button
              type="button"
              className="chatbot-widget__minimize"
              onClick={closeWidget}
              aria-label="Minimize NutriBot chat"
            >
              <ChevronDown size={21} />
            </button>
            </div>
          </header>

          {historyOpen && (
            <aside className="chatbot-widget__history" aria-label="Chat history">
              <div className="chatbot-widget__history-head">
                <div><span>Your conversations</span><h2>Pick up where you left off.</h2></div>
                <button type="button" onClick={startNewConversation}><Plus size={16} /> New conversation</button>
              </div>
              <label className="chatbot-widget__history-search"><Search size={15} /><input value={historyQuery} onChange={(event) => setHistoryQuery(event.target.value)} placeholder="Search conversations" aria-label="Search conversations" /></label>
              <div className="chatbot-widget__history-list">
                {historyLoading && <p className="chatbot-widget__history-status">Loading conversations...</p>}
                {!historyLoading && historyError && <p className="chatbot-widget__history-status is-error">{historyError}</p>}
                {!historyLoading && !historyError && !sessions.filter((item) => `${item.title} ${item.preview}`.toLowerCase().includes(historyQuery.toLowerCase())).length && <p className="chatbot-widget__history-status">No conversations yet.</p>}
                {!historyLoading && sessions.filter((item) => `${item.title} ${item.preview}`.toLowerCase().includes(historyQuery.toLowerCase())).map((session) => <button type="button" key={session.sessionId} className="chatbot-widget__history-item" onClick={() => selectSession(session.sessionId)}><span>{session.title || 'New conversation'}</span><small>{session.preview || 'No messages yet'}<i><Clock3 size={12} /> {new Date(session.updatedAt).toLocaleDateString('en-US')}</i></small></button>)}
              </div>
            </aside>
          )}

          <div ref={threadRef} className="chatbot-widget__thread" aria-live="polite">
            <div className="chatbot-widget__welcome">
              <span className="chatbot-widget__identity-mark" aria-hidden="true">
                <Sparkles size={23} />
              </span>
              <div>
                <p>Your everyday nutrition companion</p>
                <h2>Small choices, made clearer.</h2>
              </div>
            </div>

            <div className="chatbot-widget__messages">
              {messages.map((message, index) => (
                <div
                  key={message.id}
                  className={`chatbot-widget__message chatbot-widget__message--${message.sender}`}
                  data-latest-message={index === messages.length - 1 ? 'true' : undefined}
                >
                  {message.pending ? (
                    <span className="chatbot-widget__typing" aria-label="NutriBot is thinking">
                      <i /><i /><i />
                    </span>
                  ) : <>
                    {message.text}
                    {message.error && message.retry && (
                      <button type="button" className="chatbot-widget__retry" onClick={() => retryMessage(message)}>
                        Retry
                      </button>
                    )}
                  </>}
                </div>
              ))}
            </div>

            {messages.length === INITIAL_MESSAGES.length && (
              <div className="chatbot-widget__prompts" aria-label="Suggested questions">
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    className="chatbot-widget__prompt"
                    onClick={() => submitMessage(prompt)}
                    disabled={isLoading}
                  >
                    <span>{prompt}</span>
                    <span aria-hidden="true">+</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <form
            className="chatbot-widget__composer"
            onSubmit={(event) => {
              event.preventDefault();
              submitMessage();
            }}
          >
            <label htmlFor="nutribot-message" className="chatbot-widget__sr-only">
              Message NutriBot
            </label>
            <input
              ref={inputRef}
              id="nutribot-message"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask about food or nutrition..."
              autoComplete="off"
              maxLength={MAX_MESSAGE_LENGTH}
              disabled={isLoading}
            />
            <button type="submit" disabled={!draft.trim() || isLoading} aria-label="Send message">
              <Send size={18} />
            </button>
          </form>
          {showTrialBadge && (
            <div className="chatbot-widget__trial-badge" aria-live="polite">
              <AlertCircle size={14} />
              <span>{guestTrialsLeft}/{GUEST_TRIAL_LIMIT} questions left</span>
            </div>
          )}
          <p className="chatbot-widget__notice">
            NutriBot offers general guidance, not medical advice.
          </p>
        </section>
      )}

      {showLimitModal && (
        <div className="chatbot-widget__modal-overlay" onClick={() => setShowLimitModal(false)}>
          <div className="chatbot-widget__modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="limit-modal-title">
            <button type="button" className="chatbot-widget__modal-close" onClick={() => setShowLimitModal(false)} aria-label="Close">
              <X size={18} />
            </button>
            <div className="chatbot-widget__modal-icon">
              <AlertCircle size={48} />
            </div>
            <h2 id="limit-modal-title">Your free trial has ended</h2>
            <p>You have used all {GUEST_TRIAL_LIMIT} free questions with NutriBot.</p>
            <p className="chatbot-widget__modal-cta">Create an account or log in to keep chatting with NutriBot.</p>
            <div className="chatbot-widget__modal-actions">
              <button type="button" className="chatbot-widget__modal-btn chatbot-widget__modal-btn--primary" onClick={() => openAuth('signup')}>Sign Up</button>
              <button type="button" className="chatbot-widget__modal-btn chatbot-widget__modal-btn--secondary" onClick={() => openAuth('login')}>Log In</button>
            </div>
          </div>
        </div>
      )}

      {authMode && <AuthModal mode={authMode} backdropClassName="chatbot-auth-backdrop" onClose={() => setAuthMode(null)} onSubmit={(_, mode) => setAuthMode(mode)} onAuthenticated={(data) => navigate(isAdminRole(data?.role) ? '/admin' : '/home', { replace: true })} onGoogle={() => window.location.assign(googleAuthUrl())} />}

      <button
        ref={launcherRef}
        type="button"
        className={`chatbot-widget__launcher${isOpen ? ' is-open' : ''}`}
        onClick={isOpen ? closeWidget : openWidget}
        aria-label={isOpen ? 'Minimize NutriBot chat' : 'Open NutriBot chat'}
        aria-expanded={isOpen}
        aria-controls="nutribot-chat-panel"
      >
        <span className="chatbot-widget__launcher-icon" aria-hidden="true">
          {isOpen ? <ChevronDown size={23} /> : <BotMessageSquare size={24} />}
        </span>
        <span className="chatbot-widget__launcher-label" aria-hidden="true">
          Ask NutriBot
        </span>
      </button>
    </div>
  );
}
