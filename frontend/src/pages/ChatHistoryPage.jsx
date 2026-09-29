import { BotMessageSquare, ChevronLeft, Clock3, Loader2, MessageCircle, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ChatbotWidget from '../components/chatbot/ChatbotWidget';
import CommunitySideNav from '../components/community/CommunitySideNav';
import CommunityTopBar from '../components/community/CommunityTopBar';
import { getChatMessages, getChatSessions } from '../services/chatbotApi';
import '../styles/chat-history.css';

const parseTimestamp = (value) => {
  const time = value ? new Date(value).getTime() : Number.NaN;
  return Number.isFinite(time) ? time : 0;
};

const sortByTimestamp = (items, key, idKey, direction = 1) => [...items].sort((left, right) => {
  const timestamp = (parseTimestamp(left[key]) - parseTimestamp(right[key])) * direction;
  return timestamp || (Number(left[idKey]) - Number(right[idKey])) * direction;
});

const uniqueById = (items, idKey) => [...new Map(items.filter((item) => item?.[idKey] != null).map((item) => [item[idKey], item])).values()];

const formatWhen = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return 'Unknown date';
  const today = new Date();
  const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const yesterdayStart = dayStart - 86_400_000;
  const timestamp = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  if (timestamp === dayStart) return `Today, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
  if (timestamp === yesterdayStart) return `Yesterday, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
};

const errorText = (error, action) => error?.status === 401 || error?.status === 403
  ? 'Please sign in to view your chat history.'
  : `Unable to ${action}. Please try again.`;

export default function ChatHistoryPage() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [sessionsState, setSessionsState] = useState('loading');
  const [messagesState, setMessagesState] = useState('idle');
  const [error, setError] = useState('');
  const messageRequestRef = useRef(0);

  const loadSessions = useCallback(async () => {
    setSessionsState('loading');
    setError('');
    try {
      const response = await getChatSessions();
      const ordered = sortByTimestamp(uniqueById(Array.isArray(response) ? response : [], 'sessionId'), 'updatedAt', 'sessionId', -1);
      setSessions(ordered);
      setSelectedId((current) => ordered.some((item) => item.sessionId === current) ? current : (ordered[0]?.sessionId ?? null));
      setMessages((current) => ordered.length ? current : []);
      setSessionsState('ready');
    } catch (requestError) {
      setSessions([]);
      setSelectedId(null);
      setMessages([]);
      setError(errorText(requestError, 'load chat history'));
      setSessionsState('error');
    }
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  useEffect(() => {
    if (selectedId == null) {
      setMessages([]);
      setMessagesState('idle');
      return undefined;
    }
    const controller = new AbortController();
    const requestId = ++messageRequestRef.current;
    setMessagesState('loading');
    setError('');
    getChatMessages(selectedId, controller.signal).then((response) => {
      if (requestId !== messageRequestRef.current) return;
      const ordered = sortByTimestamp(uniqueById(Array.isArray(response) ? response : [], 'messageId'), 'createdAt', 'messageId');
      setMessages(ordered);
      setMessagesState('ready');
    }).catch((requestError) => {
      if (requestError?.name === 'AbortError' || requestId !== messageRequestRef.current) return;
      setMessages([]);
      setError(errorText(requestError, 'load this conversation'));
      setMessagesState('error');
    });
    return () => controller.abort();
  }, [selectedId]);

  const selectedSession = useMemo(() => sessions.find((item) => item.sessionId === selectedId) ?? null, [sessions, selectedId]);

  return <div className="community-page chat-history-page">
    <CommunityTopBar hideSearch activePath="/chat-history" />
    <div className="community-shell">
      <CommunitySideNav activePath="/chat-history" />
      <span className="community-sidenav-spacer" aria-hidden="true" />
      <main className="chat-history-main">
        <header className="chat-history-hero">
          <button type="button" className="chat-history-back" onClick={() => navigate('/home')} aria-label="Back to home"><ChevronLeft size={17} /> Back</button>
          <span>NutriBot</span>
          <h1>Chat History</h1>
          <p>Review your previous conversations with NutriBot.</p>
        </header>

        <section className="chat-history-panel" aria-label="Chat history">
          <aside className="chat-history-sessions" aria-label="Conversations">
            <div className="chat-history-section-head"><div><span>Conversations</span><b>{sessions.length}</b></div><button type="button" onClick={loadSessions} disabled={sessionsState === 'loading'} aria-label="Refresh conversations"><RefreshCw size={15} className={sessionsState === 'loading' ? 'is-spinning' : ''} /></button></div>
            {sessionsState === 'loading' && <div className="chat-history-state"><Loader2 className="is-spinning" size={19} /><p>Loading conversations...</p></div>}
            {sessionsState === 'error' && <div className="chat-history-state is-error"><p>{error}</p><button type="button" onClick={loadSessions}>Retry</button></div>}
            {sessionsState === 'ready' && !sessions.length && <div className="chat-history-state"><MessageCircle size={22} /><p><b>No conversations yet</b><br />Start a conversation with NutriBot to see your chat history here.</p><button type="button" onClick={() => navigate('/home')}>Start a conversation</button></div>}
            {sessionsState === 'ready' && sessions.length > 0 && <div className="chat-history-session-list">{sessions.map((session) => <button type="button" key={session.sessionId} className={session.sessionId === selectedId ? 'is-active' : ''} onClick={() => setSelectedId(session.sessionId)} aria-current={session.sessionId === selectedId ? 'true' : undefined}><span><b>{session.title?.trim() || 'New conversation'}</b><small>{session.preview?.trim() || 'No messages yet'}</small></span><time><Clock3 size={11} />{formatWhen(session.updatedAt)}</time></button>)}</div>}
          </aside>

          <section className="chat-history-thread" aria-live="polite">
            {!selectedSession && sessionsState === 'ready' && <div className="chat-history-thread-empty"><BotMessageSquare size={29} /><h2>Select a conversation</h2><p>Choose a conversation from the list to read its messages.</p></div>}
            {selectedSession && <header><div><span>Conversation</span><h2>{selectedSession.title?.trim() || 'New conversation'}</h2><small>{selectedSession.messageCount ?? messages.length} messages · {formatWhen(selectedSession.updatedAt)}</small></div><button type="button" onClick={() => navigate('/home')}><MessageCircle size={15} /> Open NutriBot</button></header>}
            {selectedSession && messagesState === 'loading' && <div className="chat-history-thread-state"><Loader2 className="is-spinning" size={20} /> Loading messages...</div>}
            {selectedSession && messagesState === 'error' && <div className="chat-history-thread-state is-error"><p>{error}</p><button type="button" onClick={() => setSelectedId(null)}>Back to conversations</button></div>}
            {selectedSession && messagesState === 'ready' && !messages.length && <div className="chat-history-thread-state">No messages in this conversation yet.</div>}
            {selectedSession && messagesState === 'ready' && messages.length > 0 && <div className="chat-history-messages">{messages.map((message) => { const isUser = message.senderType === 'USER'; return <article key={message.messageId} className={`chat-history-message${isUser ? ' is-user' : ' is-assistant'}`}><span>{isUser ? 'You' : 'NutriBot'}</span><p>{message.content}</p><time>{formatWhen(message.createdAt)}</time></article>; })}</div>}
          </section>
        </section>
      </main>
    </div>
    <ChatbotWidget />
  </div>;
}
