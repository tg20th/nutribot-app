import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { MessageCircle, Send } from 'lucide-react';
import { createContentComment, getContentComments } from '../../services/contentInteractionApi';
import '../../styles/content-interactions.css';

function CommentItem({ comment, onReply }) {
  const replies = Array.isArray(comment.replies) ? comment.replies : [];
  return <article className="content-comment">
    <span className="content-comment-avatar" aria-hidden="true">{comment.userAvatar
      ? <img src={comment.userAvatar} alt=""/> : (comment.userName || 'U').charAt(0).toUpperCase()}</span>
    <div className="content-comment-body">
      <div className="content-comment-meta"><strong>{comment.userName || 'NutriBot member'}</strong>
        {comment.createdAt && <time dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })}</time>}</div>
      <p>{comment.body}</p>
      <button type="button" onClick={() => onReply(comment)}>Reply</button>
      {replies.length > 0 && <div className="content-comment-replies" aria-label="Replies">
        {replies.map((reply) => <article className="content-comment content-comment--reply" key={reply.commentId}>
          <span className="content-comment-avatar" aria-hidden="true">{reply.userAvatar
            ? <img src={reply.userAvatar} alt=""/> : (reply.userName || 'U').charAt(0).toUpperCase()}</span>
          <div className="content-comment-body"><div className="content-comment-meta"><strong>{reply.userName || 'NutriBot member'}</strong>
            {reply.createdAt && <time dateTime={reply.createdAt}>{new Date(reply.createdAt).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })}</time>}</div>
            <p>{reply.body}</p></div>
        </article>)}
      </div>}
    </div>
  </article>;
}

export default function CommentSection({ contentId, loadComments = getContentComments, submitComment = createContentComment, composerTarget }) {
  const [comments, setComments] = useState([]);
  const [totalThreads, setTotalThreads] = useState(0);
  const [nextPage, setNextPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [retry, setRetry] = useState(0);

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
    loadComments(contentId, 0, controller.signal).then((data) => {
      if (controller.signal.aborted) return;
      setComments(data.content);
      setTotalThreads(data.totalElements);
      setTotalPages(data.totalPages);
      setNextPage(1);
    }).catch((failure) => {
      if (!controller.signal.aborted) setLoadError(failure.message || 'Could not load comments.');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [contentId, retry, loadComments]);

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
      setLoadError(failure.message || 'Could not load more comments.');
    } finally {
      setLoadingMore(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    const body = text.trim();
    if (!body || submitting) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const created = await submitComment(contentId, body, replyTo?.commentId ?? null);
      if (replyTo) {
        setComments((current) => current.map((item) => item.commentId === replyTo.commentId
          ? { ...item, replies: [...(item.replies ?? []), created] } : item));
      } else {
        setComments((current) => [created, ...current]);
        setTotalThreads((current) => current + 1);
      }
      setText('');
      setReplyTo(null);
    } catch (failure) {
      setSubmitError(failure.message || 'Could not post comment.');
    } finally {
      setSubmitting(false);
    }
  }

  const composer = <>
    {replyTo && <div className="content-comment-reply-target">Replying to {replyTo.userName || 'a member'}
      <button type="button" onClick={() => setReplyTo(null)}>Cancel</button></div>}
    <form className="content-comment-form" onSubmit={submit}>
      <label className="sr-only" htmlFor="new-content-comment">{replyTo ? 'Write a reply' : 'Write a comment'}</label>
      <textarea id="new-content-comment" value={text} onChange={(event) => setText(event.target.value)}
        maxLength={2000} rows={3} placeholder={replyTo ? 'Write a reply...' : 'Add a thoughtful comment...'} disabled={submitting}/>
      <button type="submit" disabled={submitting || !text.trim()}><Send size={15}/>{submitting ? 'Posting...' : replyTo ? 'Post reply' : 'Post comment'}</button>
    </form>
    {submitError && <p className="content-comment-error" role="alert">{submitError}</p>}
  </>;

  return <section className="content-comments" aria-labelledby="content-comments-heading">
    <div className="content-comments-heading"><span>Join the table</span><h2 id="content-comments-heading">Community discussion</h2>
      {!loading && !loadError && <small>{totalThreads} {totalThreads === 1 ? 'thread' : 'threads'}</small>}</div>
    {composerTarget ? createPortal(composer, composerTarget) : composer}
    {loading && <p className="content-comment-status" role="status">Loading comments...</p>}
    {!loading && loadError && !comments.length && <div className="content-comment-status" role="alert">{loadError} <button type="button" onClick={() => setRetry((value) => value + 1)}>Try again</button></div>}
    {!loading && !loadError && !comments.length && <p className="content-comment-status">No comments yet. Start the conversation.</p>}
    {!!comments.length && <div className="content-comment-list">{comments.map((comment) => <CommentItem key={comment.commentId} comment={comment} onReply={setReplyTo}/>)}</div>}
    {loadError && !!comments.length && <p className="content-comment-error" role="alert">{loadError}</p>}
    {nextPage < totalPages && <button className="content-comments-more" type="button" disabled={loadingMore} onClick={loadMore}>
      <MessageCircle size={16}/>{loadingMore ? 'Loading...' : 'Load more comments'}</button>}
  </section>;
}
