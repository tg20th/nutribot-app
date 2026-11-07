import React, { useMemo } from 'react';
import { X, AlertTriangle, Check, ArrowRight, ShieldAlert, FileText } from 'lucide-react';

/**
 * Thuật toán tách câu văn bản thô để so khớp và highlight trực quan hai bên.
 */
function splitIntoSentences(htmlOrText) {
  if (!htmlOrText) return [];
  const plain = htmlOrText.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!plain) return [];
  // Tách theo dấu chấm, chấm than, chấm hỏi hoặc ngắt dòng
  const rawSentences = plain.split(/(?<=[.!?])\s+|\n+/);
  return rawSentences.map((s) => s.trim()).filter((s) => s.length > 0);
}

function normalizeForComparison(sentence) {
  return sentence.toLowerCase().replace(/[^\p{L}\p{Nd}\s]/gu, '').replace(/\s+/g, ' ').trim();
}

export default function ContentDiffModal({
  isOpen,
  onClose,
  currentPost,
  onApprove,
  onReject,
  submitting = false,
}) {
  if (!isOpen || !currentPost) return null;

  const currentSentences = useMemo(
    () => splitIntoSentences(currentPost.body),
    [currentPost?.body]
  );

  const matchedSentences = useMemo(
    () => splitIntoSentences(currentPost.matchedBody),
    [currentPost?.matchedBody]
  );

  // Tập hợp các câu đã chuẩn hóa của bài gốc để so khớp O(1)
  const matchedSet = useMemo(() => {
    const set = new Set();
    matchedSentences.forEach((s) => {
      const norm = normalizeForComparison(s);
      if (norm.length > 5) set.add(norm);
    });
    return set;
  }, [matchedSentences]);

  const currentSet = useMemo(() => {
    const set = new Set();
    currentSentences.forEach((s) => {
      const norm = normalizeForComparison(s);
      if (norm.length > 5) set.add(norm);
    });
    return set;
  }, [currentSentences]);

  const similarityPct = currentPost.similarityScore
    ? Math.round(currentPost.similarityScore * 100)
    : 80;

  return (
    <div
      className="admin-modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="diff-modal-title"
    >
      <div
        className="admin-modal-container"
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          width: '100%',
          maxWidth: '1200px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid #e2e8f0',
        }}
      >
        {/* Header */}
        <header
          style={{
            padding: '1.25rem 1.75rem',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#f8fafc',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                backgroundColor: '#fef3c7',
                color: '#d97706',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ShieldAlert size={24} />
            </div>
            <div>
              <h2
                id="diff-modal-title"
                style={{
                  margin: 0,
                  fontSize: '1.25rem',
                  fontWeight: '700',
                  color: '#0f172a',
                }}
              >
                So sánh trực diện bài viết nghi ngờ sao chép
              </h2>
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b' }}>
                Đối chiếu trực tiếp nội dung bài gốc đã xuất bản với bài viết mới nộp duyệt
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.375rem',
                backgroundColor: '#fee2e2',
                color: '#b91c1c',
                padding: '0.375rem 0.875rem',
                borderRadius: '9999px',
                fontWeight: '600',
                fontSize: '0.875rem',
                border: '1px solid #fca5a5',
              }}
            >
              <AlertTriangle size={15} />
              Trùng lặp: {similarityPct}%
            </span>

            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#64748b',
                padding: '0.5rem',
                borderRadius: '8px',
              }}
              title="Đóng modal"
              aria-label="Đóng cửa sổ"
            >
              <X size={20} />
            </button>
          </div>
        </header>

        {/* Legend */}
        <div
          style={{
            padding: '0.625rem 1.75rem',
            backgroundColor: '#fffbeb',
            borderBottom: '1px solid #fef3c7',
            display: 'flex',
            alignItems: 'center',
            gap: '1.5rem',
            fontSize: '0.8125rem',
            color: '#92400e',
          }}
        >
          <span>
            <strong style={{ backgroundColor: '#fef08a', padding: '2px 6px', borderRadius: '4px', border: '1px solid #fde047' }}>
              Tô màu vàng
            </strong>
            : Đoạn văn hoặc câu từ bị trùng lặp giữa 2 bài viết.
          </span>
          <span>
            <strong>Văn bản thường</strong>: Phần nội dung riêng biệt hoặc đã được viết lại.
          </span>
        </div>

        {/* Diff Columns Container */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1.5rem',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '1.5rem',
            backgroundColor: '#f1f5f9',
          }}
        >
          {/* Column 1: Original Post */}
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              padding: '1.25rem',
              border: '1px solid #cbd5e1',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <div
              style={{
                borderBottom: '2px solid #0284c7',
                paddingBottom: '0.75rem',
                marginBottom: '1rem',
              }}
            >
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  color: '#0284c7',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                BÀI GỐC ĐÃ XUẤT BẢN (#{currentPost.matchedContentId || 'N/A'})
              </span>
              <h3 style={{ margin: '0.375rem 0 0.25rem', fontSize: '1.125rem', color: '#0f172a' }}>
                {currentPost.matchedTitle || 'Chưa xác định tiêu đề'}
              </h3>
              <p style={{ margin: 0, fontSize: '0.8125rem', color: '#64748b' }}>
                Tác giả: <strong>{currentPost.matchedAuthor || 'Tác giả gốc'}</strong>
                {currentPost.matchedPublishedAt && (
                  <span> · Ngày đăng: {new Date(currentPost.matchedPublishedAt).toLocaleDateString('vi-VN')}</span>
                )}
              </p>
            </div>

            <div
              style={{
                flex: 1,
                fontSize: '0.9375rem',
                lineHeight: 1.7,
                color: '#334155',
                overflowY: 'auto',
                paddingRight: '0.5rem',
              }}
            >
              {matchedSentences.length === 0 ? (
                <p style={{ color: '#94a3b8', fontStyle: 'italic' }}>Không có nội dung đối chiếu bài gốc.</p>
              ) : (
                matchedSentences.map((sentence, idx) => {
                  const isDup = currentSet.has(normalizeForComparison(sentence));
                  return (
                    <span
                      key={idx}
                      style={{
                        backgroundColor: isDup ? '#fef08a' : 'transparent',
                        padding: isDup ? '2px 4px' : '0',
                        borderRadius: isDup ? '3px' : '0',
                        marginRight: '0.35rem',
                        display: 'inline',
                      }}
                    >
                      {sentence}{' '}
                    </span>
                  );
                })
              )}
            </div>
          </div>

          {/* Column 2: New Submission Post */}
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              padding: '1.25rem',
              border: '2px solid #f59e0b',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
            }}
          >
            <div
              style={{
                borderBottom: '2px solid #f59e0b',
                paddingBottom: '0.75rem',
                marginBottom: '1rem',
              }}
            >
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  color: '#d97706',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                BÀI MỚI NỘP DUYỆT (#{currentPost.contentId || currentPost.id})
              </span>
              <h3 style={{ margin: '0.375rem 0 0.25rem', fontSize: '1.125rem', color: '#0f172a' }}>
                {currentPost.title}
              </h3>
              <p style={{ margin: 0, fontSize: '0.8125rem', color: '#64748b' }}>
                Tác giả: <strong>{currentPost.authorUsername || currentPost.author || 'Tác giả mới'}</strong>
                {currentPost.submittedAt && (
                  <span> · Nộp lúc: {new Date(currentPost.submittedAt).toLocaleDateString('vi-VN')}</span>
                )}
              </p>
            </div>

            <div
              style={{
                flex: 1,
                fontSize: '0.9375rem',
                lineHeight: 1.7,
                color: '#334155',
                overflowY: 'auto',
                paddingRight: '0.5rem',
              }}
            >
              {currentSentences.length === 0 ? (
                <p style={{ color: '#94a3b8', fontStyle: 'italic' }}>Không có nội dung bài viết.</p>
              ) : (
                currentSentences.map((sentence, idx) => {
                  const isDup = matchedSet.has(normalizeForComparison(sentence));
                  return (
                    <span
                      key={idx}
                      style={{
                        backgroundColor: isDup ? '#fef08a' : 'transparent',
                        padding: isDup ? '2px 4px' : '0',
                        borderRadius: isDup ? '3px' : '0',
                        marginRight: '0.35rem',
                        display: 'inline',
                      }}
                    >
                      {sentence}{' '}
                    </span>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <footer
          style={{
            padding: '1rem 1.75rem',
            borderTop: '1px solid #e2e8f0',
            backgroundColor: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="admin-btn secondary"
            style={{
              padding: '0.5rem 1.25rem',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#f8fafc',
              cursor: 'pointer',
              fontWeight: '500',
            }}
          >
            Đóng
          </button>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              type="button"
              className="admin-btn danger"
              disabled={submitting}
              onClick={() => onReject(currentPost, `Trùng lặp nội dung (${similarityPct}%) với bài viết #${currentPost.matchedContentId}`)}
              style={{
                padding: '0.5rem 1.25rem',
                borderRadius: '8px',
                backgroundColor: '#dc2626',
                color: '#ffffff',
                border: 'none',
                cursor: 'pointer',
                fontWeight: '600',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <X size={16} /> Từ chối vì sao chép
            </button>

            <button
              type="button"
              className="admin-btn primary"
              disabled={submitting}
              onClick={() => onApprove(currentPost)}
              style={{
                padding: '0.5rem 1.25rem',
                borderRadius: '8px',
                backgroundColor: '#16a34a',
                color: '#ffffff',
                border: 'none',
                cursor: 'pointer',
                fontWeight: '600',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <Check size={16} /> Bỏ qua & Duyệt bài
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
