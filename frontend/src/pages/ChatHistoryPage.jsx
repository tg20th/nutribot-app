import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  BotMessageSquare,
  ChevronLeft,
  History,
  LoaderCircle,
  MessageCircle,
  RefreshCw,
} from 'lucide-react';
import '../styles/chat-history.css';

// ============================================================
// MOCK DATA - Replace with API call when backend is ready
// ============================================================
const MOCK_SESSIONS = [
  {
    id: 'session-001',
    title: 'Protein cho người ăn chay',
    preview: 'Tôi cần bao nhiêu protein mỗi ngày nếu tôi không ăn thịt?',
    createdAt: new Date(Date.now() - 1000 * 60 * 32), // 32 mins ago
    messages: [
      {
        id: 'msg-001-1',
        sender: 'user',
        text: 'Tôi cần bao nhiêu protein mỗi ngày nếu tôi không ăn thịt?',
        timestamp: new Date(Date.now() - 1000 * 60 * 35),
      },
      {
        id: 'msg-001-2',
        sender: 'assistant',
        text: 'Cảm ơn bạn đã hỏi! Người trưởng thành cần khoảng 0.8-1g protein/kg thể trọng mỗi ngày.\n\nVới người ăn chay, bạn có thể bổ sung protein từ:\n• Đậu phụ, đậu nành: 10-15g protein/100g\n• Các loại đậu: 15-20g protein/cốc\n• Hạt và ngũ cốc: 5-10g protein/100g\n• Trứng (nếu ăn chay trứng)\n• Sữa và các sản phẩm từ sữa\n\nBạn có muốn tôi gợi ý thực đơn một ngày giàu protein cho người ăn chay không?',
        timestamp: new Date(Date.now() - 1000 * 60 * 34),
      },
      {
        id: 'msg-001-3',
        sender: 'user',
        text: 'Vâng, hãy gợi ý cho tôi một thực đơn mẫu',
        timestamp: new Date(Date.now() - 1000 * 60 * 32),
      },
      {
        id: 'msg-001-4',
        sender: 'assistant',
        text: 'Đây là gợi ý thực đơn một ngày giàu protein cho người ăn chay:\n\n🌅 Sáng: Bún đậu hũ + sữa đậu nành\n☀️ Trưa: Cơm + đậu phụ xào + rau luộc\n🌙 Tối: Salad đậu hũ + mì xào rau\n\nTổng protein ước tính: 55-65g/ngày',
        timestamp: new Date(Date.now() - 1000 * 60 * 31),
      },
    ],
  },
  {
    id: 'session-002',
    title: 'Thực phẩm thay thế sữa',
    preview: 'Có loại sữa thực vật nào phù hợp cho người ăn chay...',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
    messages: [
      {
        id: 'msg-002-1',
        sender: 'user',
        text: 'Có loại sữa thực vật nào phù hợp cho người ăn chay?',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24),
      },
      {
        id: 'msg-002-2',
        sender: 'assistant',
        text: 'Có nhiều loại sữa thực vật tốt cho sức khỏe:\n\n🥛 Sữa hạnh nhân: ít calo, giàu vitamin E\n🥛 Sữa đậu nành: giàu protein, isoflavone\n🥛 Sữa yến mạch: giàu chất xơ, tốt cho tiêu hóa\n🥛 Sữa dừa: giàu chất béo tốt, creamier\n\nBạn có tiêu chí nào đặc biệt không (ít đường, không gluten, etc.)?',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 + 1000 * 60 * 2),
      },
    ],
  },
  {
    id: 'session-003',
    title: 'Calo trong bữa ăn vặt',
    preview: 'Một ngày nên ăn bao nhiêu calo để giảm cân an toàn?',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3), // 3 days ago
    messages: [
      {
        id: 'msg-003-1',
        sender: 'user',
        text: 'Một ngày nên ăn bao nhiêu calo để giảm cân an toàn?',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
      },
      {
        id: 'msg-003-2',
        sender: 'assistant',
        text: 'Để giảm cân an toàn, bạn nên tạo thâm hụt khoảng 300-500 calo/ngày so với lượng calo duy trì.\n\nTrung bình:\n• Nữ giới: 1.200-1.500 calo/ngày\n• Nam giới: 1.500-1.800 calo/ngày\n\nBạn nên giảm từ từ 0.5-1kg/tuần là an toàn và bền vững nhất.',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3 + 1000 * 60 * 3),
      },
    ],
  },
  {
    id: 'session-004',
    title: 'Bữa sáng healthy cho người bận rộn',
    preview: 'Gợi ý bữa sáng nhanh mà vẫn đủ dinh dưỡng',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7), // 1 week ago
    messages: [
      {
        id: 'msg-004-1',
        sender: 'user',
        text: 'Gợi ý bữa sáng nhanh mà vẫn đủ dinh dưỡng cho người bận rộn',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7),
      },
      {
        id: 'msg-004-2',
        sender: 'assistant',
        text: '5 bữa sáng nhanh trong 10 phút:\n\n1. Oatmeal qua đêm + trái cây\n2. Smoothie rau xanh + chuối\n3. Bánh mì nguyên cám + bơ đậu\n4. Sữa chua Hy Lạp + granola\n5. Trứng luộc + bánh quy nguyên cám\n\nChuẩn bị từ tối hôm trước sẽ tiết kiệm thời gian hơn!',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7 + 1000 * 60 * 2),
      },
    ],
  },
];

// ============================================================
// HELPER FUNCTIONS
// ============================================================
const formatTime = (date) => {
  const now = new Date();
  const diff = now - date;
  const mins = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (mins < 1) return 'Vừa xong';
  if (mins < 60) return `${mins} phút trước`;
  if (hours < 24) return `${hours} giờ trước`;
  if (days === 1) return 'Hôm qua';
  if (days < 7) return `${days} ngày trước`;

  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const formatMessageTime = (date) => {
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
};

// ============================================================
// COMPONENTS
// ============================================================
function ConversationList({ sessions, selectedId, onSelect, isLoading }) {
  if (isLoading) {
    return (
      <div className="chat-history-list">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="chat-history-skeleton-item">
            <div className="chat-history-skeleton-icon" />
            <div className="chat-history-skeleton-text">
              <div className="chat-history-skeleton-line chat-history-skeleton-line--title" />
              <div className="chat-history-skeleton-line chat-history-skeleton-line--preview" />
              <div className="chat-history-skeleton-line chat-history-skeleton-line--time" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="chat-history-list">
      {sessions.map((session) => (
        <button
          key={session.id}
          className={`chat-history-item${selectedId === session.id ? ' is-selected' : ''}`}
          onClick={() => onSelect(session.id)}
        >
          <div className="chat-history-item-icon">
            <MessageCircle size={20} />
          </div>
          <span className="chat-history-item-title">{session.title}</span>
          <span className="chat-history-item-preview">{session.preview}</span>
          <span className="chat-history-item-time">{formatTime(session.createdAt)}</span>
        </button>
      ))}
    </div>
  );
}

function ConversationDetail({ session, onBack }) {
  if (!session) return null;

  return (
    <div className="chat-history-detail-panel">
      <header className="chat-history-detail-header">
        <button
          className="chat-history-back-btn"
          onClick={onBack}
          aria-label="Quay lại danh sách"
        >
          <ChevronLeft size={20} />
        </button>
        <div>
          <h2>{session.title}</h2>
          <span>{formatTime(session.createdAt)} • {session.messages.length} tin nhắn</span>
        </div>
      </header>

      <div className="chat-history-messages">
        {session.messages.map((message) => (
          <div
            key={message.id}
            className={`chat-history-message chat-history-message--${message.sender}`}
          >
            <div className="chat-history-message-bubble">
              {message.text}
            </div>
            <span className="chat-history-message-time">
              {formatMessageTime(message.timestamp)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyState() {
  const navigate = useNavigate();

  return (
    <div className="chat-history-empty">
      <div className="chat-history-empty-icon">
        <History size={36} />
      </div>
      <h3>Bạn chưa có cuộc trò chuyện nào</h3>
      <p>
        Các cuộc trò chuyện với NutriBot sẽ xuất hiện tại đây sau khi bạn bắt đầu hỏi về dinh dưỡng.
      </p>
      <button
        className="chat-history-empty-cta"
        onClick={() => navigate('/home')}
      >
        <BotMessageSquare size={18} />
        Trò chuyện với NutriBot
      </button>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="chat-history-loading">
      <div className="chat-history-loading-spinner">
        <LoaderCircle size={32} />
      </div>
      <p>Đang tải lịch sử trò chuyện...</p>
    </div>
  );
}

function ErrorState({ onRetry }) {
  return (
    <div className="chat-history-error">
      <div className="chat-history-error-icon">
        <AlertCircle size={32} />
      </div>
      <h3>Không thể tải lịch sử trò chuyện</h3>
      <p>Vui lòng kiểm tra kết nối và thử lại.</p>
      <button className="chat-history-error-btn" onClick={onRetry}>
        <RefreshCw size={16} />
        Thử lại
      </button>
    </div>
  );
}

function MobileDrawer({ isOpen, onClose, sessions, selectedId, onSelect }) {
  return (
    <>
      <div
        className={`chat-history-drawer-overlay${isOpen ? ' is-open' : ''}`}
        onClick={onClose}
      />
      <aside className={`chat-history-drawer${isOpen ? ' is-open' : ''}`}>
        <header className="chat-history-drawer-header">
          <h2>Lịch sử trò chuyện</h2>
          <button className="chat-history-drawer-close" onClick={onClose}>
            <ArrowLeft size={20} />
          </button>
        </header>
        <ConversationList
          sessions={sessions}
          selectedId={selectedId}
          onSelect={(id) => {
            onSelect(id);
            onClose();
          }}
        />
      </aside>
    </>
  );
}

// ============================================================
// MAIN PAGE COMPONENT
// ============================================================
export default function ChatHistoryPage() {
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isMobileListOpen, setIsMobileListOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  const selectedSession = sessions.find((s) => s.id === selectedSessionId);

  // Check for mobile on resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch sessions
  const fetchSessions = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // TODO: Replace with actual API call when backend is ready
      // const response = await chatHistoryApi.getSessions();
      // setSessions(response.data);

      // Using mock data for now
      await new Promise((resolve) => setTimeout(resolve, 800)); // Simulate API delay
      setSessions(MOCK_SESSIONS);
    } catch (err) {
      console.error('Failed to fetch chat history:', err);
      setError(err.message || 'Failed to load chat history');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleSelectSession = (sessionId) => {
    setSelectedSessionId(sessionId);
    if (isMobile) {
      setIsMobileListOpen(false);
    }
  };

  const handleBackToList = () => {
    setSelectedSessionId(null);
    if (isMobile) {
      setIsMobileListOpen(true);
    }
  };

  // Determine what to show in main content area
  const renderContent = () => {
    if (isLoading) {
      return <LoadingState />;
    }

    if (error) {
      return <ErrorState onRetry={fetchSessions} />;
    }

    if (sessions.length === 0) {
      return <EmptyState />;
    }

    // On desktop without selection
    if (!isMobile && !selectedSession) {
      return (
        <div className="chat-history-empty">
          <div className="chat-history-empty-icon">
            <MessageCircle size={36} />
          </div>
          <h3>Chọn một cuộc trò chuyện</h3>
          <p>Chọn một cuộc trò chuyện từ danh sách bên trái để xem chi tiết.</p>
        </div>
      );
    }

    return (
      <ConversationDetail
        session={selectedSession}
        onBack={handleBackToList}
      />
    );
  };

  return (
    <div className="chat-history-page">
      {/* Topbar */}
      <header className="chat-history-topbar">
        <div className="chat-history-topbar-left">
          <Link to="/home" className="chat-history-back-btn" aria-label="Quay lại trang chủ">
            <ArrowLeft size={20} />
          </Link>
          <h1>Lịch sử trò chuyện</h1>
        </div>

        {/* Mobile: Open list button */}
        {isMobile && selectedSession && (
          <button
            className="chat-history-back-btn"
            onClick={() => setIsMobileListOpen(true)}
            aria-label="Mở danh sách"
          >
            <History size={20} />
          </button>
        )}
      </header>

      {/* Main Content */}
      <div className="chat-history-shell">
        {/* Desktop Sidebar / Mobile Drawer */}
        {isMobile ? (
          <MobileDrawer
            isOpen={isMobileListOpen}
            onClose={() => setIsMobileListOpen(false)}
            sessions={sessions}
            selectedId={selectedSessionId}
            onSelect={handleSelectSession}
          />
        ) : (
          <>
            {/* Conversation List Panel */}
            <aside className="chat-history-list-panel">
              <div className="chat-history-list-panel-header">
                <h2>Lịch sử trò chuyện</h2>
              </div>
              <ConversationList
                sessions={sessions}
                selectedId={selectedSessionId}
                onSelect={handleSelectSession}
                isLoading={isLoading}
              />
            </aside>

            {/* Spacer for desktop layout */}
            <div className="chat-history-sidenav-spacer" />
          </>
        )}

        {/* Detail Content */}
        {renderContent()}
      </div>
    </div>
  );
}
