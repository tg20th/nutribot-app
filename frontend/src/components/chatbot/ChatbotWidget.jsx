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
import { createChatSession, getChatMessages, getChatSessions, requestNutritionAdvice, saveChatMessage } from '../../services/chatbotApi';
import '../../styles/chatbot-widget.css';

const GUEST_TRIAL_LIMIT = 3;
const GUEST_TRIAL_KEY = 'nutribot_guest_trial_count';

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

export default function ChatbotWidget({ onSend }) {
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
  const [guestTrialsLeft, setGuestTrialsLeft] = useState(() => {
    const stored = localStorage.getItem(GUEST_TRIAL_KEY);
    return stored ? parseInt(stored, 10) : GUEST_TRIAL_LIMIT;
  });
  const panelRef = useRef(null);
  const threadRef = useRef(null);
  const inputRef = useRef(null);
  const requestControllerRef = useRef(null);
  const sessionIdRef = useRef(null);
  const aiSessionIdRef = useRef(globalThis.crypto?.randomUUID?.() || `guest-${Date.now()}`);

  const isGuest = !localStorage.getItem('nutribot-auth-token');

  const checkGuestLimit = useCallback(() => {
    if (!isGuest) return true;
    return guestTrialsLeft > 0;
  }, [isGuest, guestTrialsLeft]);

  const decrementGuestTrial = useCallback(() => {
    if (!isGuest) return;
    const newCount = Math.max(0, guestTrialsLeft - 1);
    setGuestTrialsLeft(newCount);
    localStorage.setItem(GUEST_TRIAL_KEY, String(newCount));
    if (newCount === 0) {
      setShowLimitModal(true);
    }
  }, [isGuest, guestTrialsLeft]);

  const showTrialBadge = isGuest && guestTrialsLeft > 0 && guestTrialsLeft < GUEST_TRIAL_LIMIT;

  const loadSessions = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError('');
    try { setSessions(await getChatSessions()); }
    catch (error) { setHistoryError(error.message || 'Không thể tải lịch sử trò chuyện.'); }
    finally { setHistoryLoading(false); }
  }, []);

  const openWidget = useCallback(() => {
    setIsMounted(true);
    setIsOpen(true);
  }, []);

  const openHistory = async () => { setHistoryOpen(true); await loadSessions(); };
  const startNewConversation = () => { sessionIdRef.current = null; setMessages(INITIAL_MESSAGES); setHistoryOpen(false); };
  const selectSession = async (sessionId) => {
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const persistedMessages = await getChatMessages(sessionId);
      sessionIdRef.current = sessionId;
      setMessages(persistedMessages.length ? persistedMessages.map((item) => ({ id: item.messageId, sender: item.senderType === 'USER' ? 'user' : 'assistant', text: item.content, createdAt: item.createdAt })) : INITIAL_MESSAGES);
      setHistoryOpen(false);
    } catch (error) { setHistoryError(error.message || 'Không thể tải nội dung cuộc trò chuyện.'); }
    finally { setHistoryLoading(false); }
  };

  const closeWidget = useCallback(() => {
    const panel = panelRef.current;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!panel || reduceMotion) {
      setIsOpen(false);
      setIsMounted(false);
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

  useEffect(() => () => requestControllerRef.current?.abort(), []);

  useEffect(() => {
    threadRef.current?.scrollTo({
      top: threadRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages]);

  useGSAP(() => {
    if (!isMounted || !isOpen || !panelRef.current) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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

  const submitMessage = async (value = draft) => {
    const message = value.trim();
    if (!message || isLoading) return;

    // Check guest trial limit
    if (!checkGuestLimit()) {
      setShowLimitModal(true);
      return;
    }

    decrementGuestTrial();

    const conversationHistory = messages
      .filter((item) => item.id !== 'welcome' && !item.pending && !item.error)
      .slice(-40)
      .map((item) => ({
        sender: item.sender === 'user' ? 'USER' : 'ASSISTANT',
        content: item.text,
      }));
    const userMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: message,
    };
    const pendingId = `pending-${Date.now()}`;

    setMessages((current) => [
      ...current,
      userMessage,
      { id: pendingId, sender: 'assistant', text: '', pending: true },
    ]);
    setDraft('');
    setIsLoading(true);
    onSend?.(message);

    const controller = new AbortController();
    requestControllerRef.current = controller;

    try {
      const isMember = Boolean(localStorage.getItem('nutribot-auth-token'));
      if (isMember && !sessionIdRef.current) {
        const session = await createChatSession();
        sessionIdRef.current = session.sessionId;
      }
      if (isMember) await saveChatMessage(sessionIdRef.current, 'USER', message);
      const response = await requestNutritionAdvice({
        message,
        sessionId: sessionIdRef.current ?? aiSessionIdRef.current,
        conversationHistory,
        signal: controller.signal,
      });
      const recommendations = response.recommendations ?? [];
      const recommendationText = recommendations.length
        ? `\n\nGợi ý nhanh:\n${recommendations.map((item) => `• ${item}`).join('\n')}`
        : '';
      const assistantText = `${response.reply}${recommendationText}`;
      if (isMember) await saveChatMessage(sessionIdRef.current, 'ASSISTANT', assistantText);
      setMessages((current) => [
        ...current.filter((item) => item.id !== pendingId),
        {
          id: `assistant-${Date.now()}`,
          sender: 'assistant',
          text: assistantText,
        },
      ]);
    } catch (error) {
      if (error.name === 'AbortError') return;
      const messageText = error.status === 503
        ? 'NutriBot đang quá tải tạm thời. Bạn hãy thử lại sau ít phút.'
        : 'NutriBot chưa thể trả lời lúc này. Vui lòng kiểm tra AI service và thử lại.';
      setMessages((current) => [
        ...current.filter((item) => item.id !== pendingId),
        {
          id: `error-${Date.now()}`,
          sender: 'assistant',
          text: messageText,
          error: true,
        },
      ]);
    } finally {
      requestControllerRef.current = null;
      setIsLoading(false);
    }
  };

  return (
    <div className="chatbot-widget">
      {isMounted && (
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
              <button type="button" className="chatbot-widget__history-toggle" onClick={openHistory} aria-label="Mở lịch sử trò chuyện"><History size={18} /></button>
            <button
              type="button"
              className="chatbot-widget__minimize"
              onClick={closeWidget}
              aria-label="Minimize NutriBot chat"
            >
              <ChevronDown size={21} />
            </button>
            </div>
            {showTrialBadge && (
              <div className="chatbot-widget__trial-badge" aria-live="polite">
                <AlertCircle size={14} />
                <span>{guestTrialsLeft}/{GUEST_TRIAL_LIMIT} questions left</span>
              </div>
            )}
          </header>

          {historyOpen && (
            <aside className="chatbot-widget__history" aria-label="Lịch sử trò chuyện">
              <div className="chatbot-widget__history-head">
                <div><span>Hội thoại của bạn</span><h2>Quay lại điều đang dang dở.</h2></div>
                <button type="button" onClick={startNewConversation}><Plus size={16} /> Cuộc trò chuyện mới</button>
              </div>
              <label className="chatbot-widget__history-search"><Search size={15} /><input value={historyQuery} onChange={(event) => setHistoryQuery(event.target.value)} placeholder="Tìm trong lịch sử" /></label>
              <div className="chatbot-widget__history-list">
                {historyLoading && <p className="chatbot-widget__history-status">Đang tải lịch sử...</p>}
                {!historyLoading && historyError && <p className="chatbot-widget__history-status is-error">{historyError}</p>}
                {!historyLoading && !historyError && !sessions.filter((item) => `${item.title} ${item.preview}`.toLowerCase().includes(historyQuery.toLowerCase())).length && <p className="chatbot-widget__history-status">Chưa có cuộc trò chuyện nào được lưu.</p>}
                {!historyLoading && sessions.filter((item) => `${item.title} ${item.preview}`.toLowerCase().includes(historyQuery.toLowerCase())).map((session) => <button type="button" key={session.sessionId} className="chatbot-widget__history-item" onClick={() => selectSession(session.sessionId)}><span>{session.title}</span><small>{session.preview || 'Chưa có tin nhắn'}<i><Clock3 size={12} /> {new Date(session.updatedAt).toLocaleDateString('vi-VN')}</i></small></button>)}
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
                  ) : message.text}
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
              disabled={isLoading}
            />
            <button type="submit" disabled={!draft.trim() || isLoading} aria-label="Send message">
              <Send size={18} />
            </button>
          </form>
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
            <h2 id="limit-modal-title">Trial Ended</h2>
            <p>You have used all 3 free questions with NutriBot.</p>
            <p className="chatbot-widget__modal-cta">Sign up for an account to continue chatting with NutriBot.</p>
            <div className="chatbot-widget__modal-actions">
              <a href="/register" className="chatbot-widget__modal-btn chatbot-widget__modal-btn--primary">Sign Up</a>
              <a href="/login" className="chatbot-widget__modal-btn chatbot-widget__modal-btn--secondary">Log In</a>
            </div>
          </div>
        </div>
      )}

      <button
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
