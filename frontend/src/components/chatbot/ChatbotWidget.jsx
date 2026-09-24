import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import {
  BotMessageSquare,
  ChevronDown,
  Send,
  Sparkles,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import '../../styles/chatbot-widget.css';

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
  const panelRef = useRef(null);
  const threadRef = useRef(null);
  const inputRef = useRef(null);

  const openWidget = useCallback(() => {
    setIsMounted(true);
    setIsOpen(true);
  }, []);

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

  const submitMessage = (value = draft) => {
    const message = value.trim();
    if (!message) return;

    setMessages((current) => [
      ...current,
      {
        id: `user-${Date.now()}`,
        sender: 'user',
        text: message,
      },
    ]);
    setDraft('');
    onSend?.(message);
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
                <small><i aria-hidden="true" /> Ready to help</small>
              </span>
            </div>
            <button
              type="button"
              className="chatbot-widget__minimize"
              onClick={closeWidget}
              aria-label="Minimize NutriBot chat"
            >
              <ChevronDown size={21} />
            </button>
          </header>

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
                  {message.text}
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
            />
            <button type="submit" disabled={!draft.trim()} aria-label="Send message">
              <Send size={18} />
            </button>
          </form>
          <p className="chatbot-widget__notice">
            NutriBot offers general guidance, not medical advice.
          </p>
        </section>
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
