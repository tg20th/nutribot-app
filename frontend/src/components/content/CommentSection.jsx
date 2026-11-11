import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LoaderCircle, MessageCircle, Send, Trash2, X } from 'lucide-react';
import { createContentComment, deleteContentComment, getContentComments } from '../../services/contentInteractionApi';
import '../../styles/content-interactions.css';
import UserProfileLink from '../UserProfileLink';
import { getProfileAvatarUrl } from '../../utils/avatar';
import useDialogAccessibility from '../../hooks/useDialogAccessibility';

const memberName = (comment) => comment.userName || 'NutriBot member';
const replyList = (comment) => Array.isArray(comment.replies) ? comment.replies : [];
const replyCount = (comment) => replyList(comment).reduce((count, reply) => count + 1 + replyCount(reply), 0);

function flattenReplies(comment) {
  return replyList(comment).flatMap((reply) => [
    { ...reply, parentComment: comment },
    ...flattenReplies(reply),
  ]);
}

function formatDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' });
}

function CurrentUserAvatar({ user }) {
  const [failed, setFailed] = useState(false);
  const avatarUrl = getProfileAvatarUrl(user);
  const fallback = (user.fullName || user.name || user.username || 'N').charAt(0).toUpperCase();

  useEffect(() => setFailed(false), [avatarUrl]);

  if (avatarUrl && !failed) {
    return <img className="content-comment-composer-avatar" src={avatarUrl} alt="" onError={() => setFailed(true)} />;
  }
  return <span className="content-comment-composer-avatar" aria-hidden="true">{fallback}</span>;
}

function appendReply(comments, parentId, reply) {
  return comments.map((comment) => {
    if (comment.commentId === parentId) return { ...comment, replies: [...replyList(comment), reply] };
    const replies = replyList(comment);
    return replies.length ? { ...comment, replies: appendReply(replies, parentId, reply) } : comment;
  });
}

function removeComment(comments, commentId) {
  return comments
    .filter((comment) => comment.commentId !== commentId)
    .map((comment) => ({ ...comment, replies: removeComment(replyList(comment), commentId) }));
}

function countCommentTree(comment) {
  return 1 + replyList(comment).reduce((count, reply) => count + countCommentTree(reply), 0);
}

function submitOnEnter(event) {
  if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
  event.preventDefault();
  event.currentTarget.form?.requestSubmit();
}

function ReplyComposer({ comment, inputRef, value, submitting, error, onChange, onCancel, onSubmit }) {
  const username = memberName(comment);
  return <form className="content-comment-form content-comment-reply-form" onSubmit={(event) => onSubmit(event, comment)}>
    <p className="content-comment-reply-target">Replying to <strong>@{username}</strong></p>
    <label className="sr-only" htmlFor={`reply-to-comment-${comment.commentId}`}>Reply to {username}</label>
    <textarea ref={inputRef} id={`reply-to-comment-${comment.commentId}`} value={value} onChange={(event) => onChange(event.target.value)}
      maxLength={2000} rows={2} placeholder={`Reply to @${username}...`} disabled={submitting} onKeyDown={submitOnEnter}/>
    <div className="content-comment-reply-actions">
      <button type="submit" disabled={submitting || !value.trim()}><Send size={15}/>{submitting ? 'Posting...' : 'Post'}</button>
      <button className="content-comment-reply-cancel" type="button" onClick={onCancel} disabled={submitting}>Cancel</button>
    </div>
    {error && <p className="content-comment-error" role="alert">{error}</p>}
  </form>;
}

function DeleteCommentModal({ comment, deleting, error, onCancel, onConfirm }) {
  const dialogRef = useRef(null);
  const close = useCallback(() => { if (!deleting) onCancel(); }, [deleting, onCancel]);
  useDialogAccessibility(dialogRef, close, { enabled: true, closeOnEscape: !deleting });
  if (!comment) return null;
  const hasReplies = replyList(comment).length > 0;
  return createPortal(<div className="content-comment-delete-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
    <section ref={dialogRef} className="content-comment-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-comment-title" aria-describedby="delete-comment-description" tabIndex={-1}>
      <button className="content-comment-delete-close" type="button" onClick={close} disabled={deleting} aria-label="Close delete confirmation"><X size={18}/></button>
      <div className="content-comment-delete-icon" aria-hidden="true"><Trash2 size={24}/></div>
      <h2 id="delete-comment-title">Delete comment?</h2>
      <p id="delete-comment-description">Are you sure you want to delete this comment? This action cannot be undone.</p>
      {hasReplies && <p className="content-comment-delete-warning">Its replies will also be removed from this discussion.</p>}
      {error && <p className="content-comment-delete-error" role="alert">{error}</p>}
      <div className="content-comment-delete-actions"><button type="button" className="content-comment-delete-cancel" onClick={close} disabled={deleting}>Cancel</button><button type="button" className="content-comment-delete-confirm" onClick={onConfirm} disabled={deleting}>{deleting ? <LoaderCircle size={15} className="content-comment-delete-spinner"/> : <Trash2 size={15}/>} {deleting ? 'Deleting...' : 'Delete'}</button></div>
    </section>
  </div>, document.body);
}

function CommentItem({ comment, depth, activeReplyId, replyText, replyInputRef, submittingReply, replyError, expandedReplyIds, onReplyChange, onReplyCancel, onReplySubmit, onStartReply, onToggleReplies, onDelete, deletingId, currentUserId, readOnly = false }) {
  const replies = depth === 0 ? replyList(comment) : depth === 1 ? flattenReplies(comment) : [];
  const hasReplies = replies.length > 0;
  const isExpanded = expandedReplyIds.has(comment.commentId);
  const isReplying = activeReplyId === comment.commentId;
  const nested = depth > 0;
  const replyTotal = replyCount(comment);
  const timestamp = formatDate(comment.createdAt);
  const canDelete = !readOnly && currentUserId != null && String(comment.userId) === String(currentUserId);

  return <article className={`content-comment content-comment--depth-${Math.min(depth, 2)}`}>
    {comment.userId != null && <UserProfileLink userId={comment.userId} className="content-comment-avatar-link" aria-label={`Open ${memberName(comment)} profile`} />}
    <span className="content-comment-avatar" aria-hidden="true">{comment.userAvatar || comment.avatarUrl
      ? <img src={comment.userAvatar || comment.avatarUrl} alt=""/> : memberName(comment).charAt(0).toUpperCase()}</span>
    <div className="content-comment-body">
      <div className="content-comment-meta"><UserProfileLink userId={comment.userId}><strong>{memberName(comment)}</strong></UserProfileLink>
        {timestamp && <time dateTime={comment.createdAt}>{timestamp}</time>}</div>
      <p>{nested && <span className="content-comment-mention">@{memberName(comment.parentComment || {})}</span>}{comment.body}</p>
      <div className="content-comment-actions">
        {!readOnly && <button type="button" onClick={() => onStartReply(depth > 0 ? (comment.parentComment || comment) : comment)}>Reply</button>}
        {canDelete && <button type="button" className="content-comment-delete" disabled={deletingId === comment.commentId} onClick={() => onDelete(comment)}>{deletingId === comment.commentId ? 'Deleting...' : 'Delete'}</button>}
        {hasReplies && <button type="button" onClick={() => onToggleReplies(comment.commentId)} aria-expanded={isExpanded}>
          {isExpanded ? 'Hide replies' : `View replies (${replyTotal})`}
        </button>}
      </div>
      {isReplying && (
        <ReplyComposer comment={comment} inputRef={replyInputRef} value={replyText} submitting={submittingReply} error={replyError}
          onChange={onReplyChange} onCancel={onReplyCancel} onSubmit={onReplySubmit}/>
      )}
      {hasReplies && isExpanded && <div className="content-comment-replies" aria-label={`Replies to ${memberName(comment)}`}>
        {replies.map((reply) => <CommentItem key={reply.commentId} comment={depth === 0 ? { ...reply, parentComment: comment } : reply} depth={depth === 0 ? 1 : 2}
          activeReplyId={activeReplyId} replyText={replyText} replyInputRef={replyInputRef} submittingReply={submittingReply} replyError={replyError}
          expandedReplyIds={expandedReplyIds} onReplyChange={onReplyChange} onReplyCancel={onReplyCancel} onReplySubmit={onReplySubmit}
          onStartReply={onStartReply} onToggleReplies={onToggleReplies} onDelete={onDelete} deletingId={deletingId} currentUserId={currentUserId} readOnly={readOnly}/>)}</div>}
    </div>
  </article>;
}

export default function CommentSection({ contentId, loadComments = getContentComments, submitComment = createContentComment, deleteComment = deleteContentComment, composerTarget, showFilter = false, onCommentCountChange, currentUser = {}, readOnly = false, heading = 'Comments', showEmptyState = true }) {
  const [comments, setComments] = useState([]);
  const [totalThreads, setTotalThreads] = useState(0);
  const [nextPage, setNextPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [submittingReply, setSubmittingReply] = useState(false);
  const [commentError, setCommentError] = useState('');
  const [replyError, setReplyError] = useState('');
  const [submissionMessage, setSubmissionMessage] = useState('');
  const [expandedReplyIds, setExpandedReplyIds] = useState(() => new Set());
  const [retry, setRetry] = useState(0);
  const [commentFilter, setCommentFilter] = useState('all');
  const [deletingId, setDeletingId] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const replyInput = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    setComments([]);
    setTotalThreads(0);
    setNextPage(0);
    setTotalPages(0);
    setLoading(true);
    setLoadError('');
    setReplyTo(null);
    setText('');
    setReplyText('');
    setCommentError('');
    setReplyError('');
    setSubmissionMessage('');
    setExpandedReplyIds(new Set());
    loadComments(contentId, 0, controller.signal).then((data) => {
      if (controller.signal.aborted) return;
      setComments(data.content);
      setTotalThreads(data.totalElements);
      onCommentCountChange?.(data.totalElements);
      setTotalPages(data.totalPages);
      setNextPage(1);
    }).catch((failure) => {
      if (!controller.signal.aborted) setLoadError(failure.message || 'Unable to load comments.');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [contentId, retry, loadComments]);

  useEffect(() => {
    if (replyTo) replyInput.current?.focus({ preventScroll: true });
  }, [replyTo]);

  async function loadMore() {
    if (loadingMore || nextPage >= totalPages) return;
    setLoadingMore(true);
    setLoadError('');
    try {
      const data = await loadComments(contentId, nextPage);
      setComments((current) => [...current, ...data.content]);
      setNextPage((current) => current + 1);
      setTotalPages(data.totalPages);
    } catch (failure) {
      setLoadError(failure.message || 'Unable to load more comments.');
    } finally {
      setLoadingMore(false);
    }
  }

  async function submitCommentForm(event) {
    event.preventDefault();
    const body = text.trim();
    if (!body || submittingComment) return;
    setSubmittingComment(true);
    setCommentError('');
    setSubmissionMessage('');
    try {
      const created = await submitComment(contentId, body, null);
      setComments((current) => [created, ...current]);
      setTotalThreads((current) => {
        const next = current + 1;
        onCommentCountChange?.(next);
        return next;
      });
      setText('');
    } catch (failure) {
      setCommentError(failure.message || 'Unable to post your comment.');
    } finally {
      setSubmittingComment(false);
    }
  }

  function startReply(comment) {
    setReplyTo(comment);
    setReplyText('');
    setReplyError('');
    setSubmissionMessage('');
    if (comment.parentComment?.commentId) setExpandedReplyIds((current) => new Set(current).add(comment.parentComment.commentId));
  }

  function cancelReply() {
    setReplyTo(null);
    setReplyText('');
    setReplyError('');
  }

  function toggleReplies(commentId) {
    setExpandedReplyIds((current) => {
      const next = new Set(current);
      if (next.has(commentId)) next.delete(commentId);
      else next.add(commentId);
      return next;
    });
  }

  async function submitReply(event, parentComment) {
    event.preventDefault();
    const body = replyText.trim();
    if (!body || submittingReply) return;
    setSubmittingReply(true);
    setReplyError('');
    setSubmissionMessage('');
    try {
      const created = await submitComment(contentId, body, parentComment.commentId);
      setComments((current) => appendReply(current, parentComment.commentId, created));
      setTotalThreads((current) => {
        const next = current + 1;
        onCommentCountChange?.(next);
        return next;
      });
      setExpandedReplyIds((current) => new Set(current).add(parentComment.commentId));
      cancelReply();
    } catch (failure) {
      setReplyError(failure.message || 'Unable to post your reply.');
    } finally {
      setSubmittingReply(false);
    }
  }

  function requestDelete(comment) {
    if (!deletingId) { setDeleteError(''); setDeleteCandidate(comment); }
  }

  async function confirmDelete() {
    if (!deleteCandidate || deletingId) return;
    const comment = deleteCandidate;
    setDeletingId(comment.commentId);
    setDeleteError('');
    try {
      await deleteComment(comment.commentId);
      const removedCount = countCommentTree(comment);
      setComments((current) => removeComment(current, comment.commentId));
      setTotalThreads((current) => { const next = Math.max(0, current - removedCount); onCommentCountChange?.(next); return next; });
      if (replyTo?.commentId === comment.commentId) cancelReply();
      setDeleteCandidate(null);
    } catch (failure) { setDeleteError(failure.message || 'Unable to delete this comment.'); }
    finally { setDeletingId(null); }
  }

  const composer = <>
    <form className="content-comment-form" onSubmit={submitCommentForm}>
      {composerTarget && <CurrentUserAvatar user={currentUser}/>}
      <label className="sr-only" htmlFor="new-content-comment">Write a comment</label>
      <div className="content-comment-composer-field">
        <textarea id="new-content-comment" value={text} onChange={(event) => setText(event.target.value)} maxLength={2000} rows={3}
          placeholder="Write a comment..." disabled={submittingComment} onKeyDown={submitOnEnter}/>
        <button className="content-comment-submit" type="submit" disabled={submittingComment || !text.trim()} aria-label={submittingComment ? 'Posting comment' : 'Post'}><Send size={15}/><span className="sr-only">{submittingComment ? 'Posting...' : 'Post'}</span></button>
      </div>
    </form>
    {commentError && <p className="content-comment-error" role="alert">{commentError}</p>}
    {deleteError && <p className="content-comment-error" role="alert">{deleteError}</p>}
  </>;
  const visibleComments = [...comments].sort((left, right) => {
    const direction = commentFilter === 'newest' ? -1 : 1;
    return direction * (new Date(left.createdAt ?? 0) - new Date(right.createdAt ?? 0));
  });

  return <section className="content-comments" aria-labelledby="content-comments-heading">
    <div className="content-comments-heading"><div className="content-comments-heading-title"><h2 id="content-comments-heading">{heading}</h2>
      {!loading && !loadError && <small className="content-comments-count" aria-label={`${totalThreads} comments`}>{totalThreads}</small>}</div>
      {showFilter && totalThreads > 0 && <label className="content-comments-filter"><span className="sr-only">Comment order</span><select value={commentFilter} onChange={(event) => setCommentFilter(event.target.value)}><option value="all">All comments</option><option value="newest">Newest</option></select></label>}</div>
    {!readOnly && (composerTarget ? createPortal(composer, composerTarget) : composer)}
    {loading && <p className="content-comment-status" role="status">Loading comments...</p>}
    {!loading && loadError && !comments.length && <div className="content-comment-status" role="alert">{loadError} <button type="button" onClick={() => setRetry((value) => value + 1)}>Try again</button></div>}
    {showEmptyState && !loading && !loadError && !comments.length && totalThreads === 0 && <div className="content-comments-empty"><MessageCircle size={22} strokeWidth={1.5}/><strong>No comments yet</strong><span>Be the first to share your thoughts.</span></div>}
    {!loading && !loadError && !comments.length && totalThreads > 0 && <p className="content-comment-status" role="status">Comments are temporarily unavailable.</p>}
    {!!visibleComments.length && <div className="content-comment-list">{visibleComments.map((comment) => <CommentItem key={comment.commentId} comment={comment} depth={0}
      activeReplyId={replyTo?.commentId} replyText={replyText} replyInputRef={replyInput} submittingReply={submittingReply} replyError={replyError}
      expandedReplyIds={expandedReplyIds} onReplyChange={setReplyText} onReplyCancel={cancelReply} onReplySubmit={submitReply}
      onStartReply={startReply} onToggleReplies={toggleReplies} onDelete={requestDelete} deletingId={deletingId} currentUserId={currentUser.userId} readOnly={readOnly}/>)}</div>}
    {loadError && !!comments.length && <p className="content-comment-error" role="alert">{loadError}</p>}
    {nextPage < totalPages && <button className="content-comments-more" type="button" disabled={loadingMore} onClick={loadMore}>
      <MessageCircle size={16}/>{loadingMore ? 'Loading...' : 'Load more comments'}</button>}
    {deleteCandidate && <DeleteCommentModal comment={deleteCandidate} deleting={Boolean(deletingId)} error={deleteError} onCancel={() => setDeleteCandidate(null)} onConfirm={confirmDelete}/>}
  </section>;
}
