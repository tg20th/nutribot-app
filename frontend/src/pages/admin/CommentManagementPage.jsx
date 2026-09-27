import { ChevronLeft, ChevronRight, MessageSquareText, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ConfirmDialog, EmptyState, ErrorState, LoadingState, Toast } from '../../components/admin/AdminUi';
import { adminCommentsApi } from '../../services/adminCommentsApi';
import '../../styles/admin-comments.css';

const pageSize = 10;
const statusLabels = { published: 'Published', hidden: 'Hidden', rejected: 'Rejected' };

function formatDate(value) {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(date);
}

function CommentStatus({ value }) {
  const status = statusLabels[value] ? value : 'unknown';
  return <span className={`comment-admin-status is-${status}`}>{statusLabels[value] || 'Unknown'}</span>;
}

export default function CommentManagementPage() {
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ content: [], totalPages: 0, totalElements: 0 });
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [confirm, setConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    adminCommentsApi.list({ page: page - 1, size: pageSize }, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        const next = {
          content: data.content ?? [],
          totalPages: data.totalPages ?? 0,
          totalElements: data.totalElements ?? 0,
        };
        if (page > 1 && next.totalPages > 0 && page > next.totalPages) {
          setPage(next.totalPages);
          return;
        }
        setResult(next);
        setSelectedId((current) => next.content.some((item) => item.commentId === current)
          ? current : next.content[0]?.commentId ?? null);
      })
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [page, refreshKey]);

  const comments = result.content;
  const selected = comments.find((item) => item.commentId === selectedId) ?? comments[0] ?? null;

  const removeComment = async () => {
    if (!confirm || deleting) return;
    setDeleting(true);
    try {
      await adminCommentsApi.remove(confirm.commentId);
      setConfirm(null);
      setSelectedId(null);
      setToast('Comment deleted.');
      if (comments.length === 1 && page > 1) setPage(page - 1);
      else setRefreshKey((key) => key + 1);
    } catch {
      setConfirm(null);
      setToast('Could not delete this comment. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  return <div className="comment-admin-page">
    <header className="comment-admin-hero">
      <div>
        <p>ADMINISTRATION / COMMUNITY</p>
        <h1>Comment management</h1>
        <span>Review comments on blogs and videos, then remove violations.</span>
      </div>
      <div className="comment-admin-total" aria-live="polite"><MessageSquareText size={20} /><strong>{result.totalElements}</strong><span>comments</span></div>
    </header>

    <div className="comment-admin-intro">
      <div><h2>All comments</h2><p>Select a comment to read its full text and context.</p></div>
      <span>Newest first</span>
    </div>

    {loading ? <section className="admin-panel comment-admin-state"><LoadingState /></section>
      : error ? <section className="admin-panel comment-admin-state"><ErrorState onRetry={() => setRefreshKey((key) => key + 1)} /></section>
        : comments.length === 0 ? <section className="admin-panel comment-admin-state"><EmptyState title="No comments to display." text="Comments will appear here when members join the conversation." /></section>
          : <div className="comment-admin-board">
            <section className="admin-panel comment-admin-list" aria-label="Comments">
              <div className="comment-admin-list-head"><h3>Recent comments</h3><span>{comments.length} on this page</span></div>
              <div className="comment-admin-list-items">
                {comments.map((item) => <button
                  key={item.commentId}
                  type="button"
                  className={`comment-admin-item${item.commentId === selected?.commentId ? ' is-selected' : ''}`}
                  aria-pressed={item.commentId === selected?.commentId}
                  onClick={() => setSelectedId(item.commentId)}
                >
                  <span className="comment-admin-avatar" aria-hidden="true">{(item.username || '?').charAt(0).toUpperCase()}</span>
                  <span className="comment-admin-item-copy">
                    <span className="comment-admin-item-top"><strong>{item.username || 'Unknown member'}</strong><time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time></span>
                    <span className="comment-admin-excerpt">{item.body}</span>
                    <span className="comment-admin-item-bottom"><span>{item.contentType === 'VIDEO' ? 'Video' : 'Blog'} · {item.contentTitle || 'Untitled content'}</span><CommentStatus value={item.status} /></span>
                  </span>
                </button>)}
              </div>
              {result.totalPages > 1 && <nav className="comment-admin-pagination" aria-label="Comment pagination">
                <button type="button" disabled={page === 1} onClick={() => setPage(page - 1)} aria-label="Previous page"><ChevronLeft size={16} /></button>
                <span>Page {page} of {result.totalPages}</span>
                <button type="button" disabled={page >= result.totalPages} onClick={() => setPage(page + 1)} aria-label="Next page"><ChevronRight size={16} /></button>
              </nav>}
            </section>

            <article className="admin-panel comment-admin-detail">
              <div className="comment-admin-detail-head"><span>COMMENT DETAILS</span><CommentStatus value={selected.status} /></div>
              <div className="comment-admin-detail-body">
                <div className="comment-admin-author"><span className="comment-admin-avatar" aria-hidden="true">{(selected.username || '?').charAt(0).toUpperCase()}</span><div><strong>{selected.username || 'Unknown member'}</strong><small>{selected.userEmail || 'Email unavailable'}</small></div></div>
                <time dateTime={selected.createdAt}>Posted {formatDate(selected.createdAt)}</time>
                <blockquote>{selected.body}</blockquote>
                <div className="comment-admin-context"><span>RELATED CONTENT</span><strong>{selected.contentTitle || 'Untitled content'}</strong><small>{selected.contentType === 'VIDEO' ? 'Video' : 'Blog'}{selected.parentId ? ' · Reply to a comment' : ''}</small></div>
              </div>
              <footer className="comment-admin-actions"><button type="button" className="admin-btn danger" disabled={deleting} onClick={() => setConfirm(selected)}><Trash2 size={16} /> Delete comment</button></footer>
            </article>
          </div>}

    <ConfirmDialog
      dialog={confirm ? { title: 'Delete this comment?', text: `The comment by ${confirm.username || 'this member'} will be permanently removed.`, confirm: deleting ? 'Deleting...' : 'Delete comment' } : null}
      onClose={() => { if (!deleting) setConfirm(null); }}
      onConfirm={removeComment}
    />
    <Toast message={toast} onDismiss={() => setToast('')} />
  </div>;
}
