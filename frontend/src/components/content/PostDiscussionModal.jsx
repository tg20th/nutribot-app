import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, Eye, Play, Timer, X } from 'lucide-react';
import { getPost } from '../../services/communityApi';
import { extractStoryText } from '../../utils/content';
import CommentSection from './CommentSection';
import VoteButton from './VoteButton';
import '../../styles/post-discussion-modal.css';

export default function PostDiscussionModal({ post, onClose, focusComments = false, loadPost = getPost, interactionApi = {} }) {
  const dialog = useRef(null);
  const [composerTarget, setComposerTarget] = useState(null);
  const [fullPost, setFullPost] = useState(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const displayedPost = fullPost ?? post;
  const media = (displayedPost.images?.length ? displayedPost.images : [displayedPost.image]).filter(Boolean);
  const isVideo = displayedPost.type === 'video';
  const createdDate = displayedPost.createdAt ? new Date(displayedPost.createdAt) : null;
  const createdLabel = createdDate && !Number.isNaN(createdDate.getTime())
    ? createdDate.toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })
    : displayedPost.createdAtLabel ?? displayedPost.createdAt ?? '';
  const durationLabel = displayedPost.durationSec
    ? `${Math.floor(displayedPost.durationSec / 60)}:${String(displayedPost.durationSec % 60).padStart(2, '0')}`
    : '';

  useEffect(() => {
    const opener = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const element = dialog.current;
    element.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  useEffect(() => {
    if (focusComments && composerTarget) composerTarget.querySelector('textarea')?.focus({ preventScroll: true });
  }, [focusComments, composerTarget]);

  useEffect(() => {
    const controller = new AbortController();
    setError('');
    setFullPost(null);
    loadPost(post.id, controller.signal).then((data) => {
      if (!controller.signal.aborted) setFullPost(data);
    }).catch(() => {
      if (!controller.signal.aborted) setError('Could not load the full post.');
    });
    return () => controller.abort();
  }, [post.id, loadPost, retry]);

  return createPortal(<dialog ref={dialog} className="post-discussion-modal" aria-labelledby="post-discussion-title"
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="post-discussion-panel">
      <header className="post-discussion-header"><h2 id="post-discussion-title">{post.author || 'Member'}&apos;s post</h2>
        <button type="button" onClick={onClose} aria-label="Close post"><X size={24}/></button></header>
      <div className="post-discussion-body-grid">
        <aside className="post-discussion-detail" aria-label="Post detail">
          <div className="post-discussion-detail-media">
            {isVideo && displayedPost.videoUrl
              ? <video controls src={displayedPost.videoUrl} poster={displayedPost.image || undefined}/>
              : media.length ? media.map((src, index) => <img className="post-discussion-image" key={`${src}-${index}`} src={src} alt={displayedPost.title}/>)
                : <span className="post-discussion-empty-media">{isVideo ? <Play size={28}/> : <Eye size={28}/>} NutriBot content</span>}
          </div>
          <div className="post-discussion-detail-copy">
            <span className="post-discussion-kind">{isVideo ? 'Cooking video' : 'Blog story'}</span>
            <h3>{displayedPost.title}</h3>
            <div className="post-discussion-author">{displayedPost.avatar ? <img src={displayedPost.avatar} alt=""/> : <span>{(displayedPost.author || 'N').charAt(0)}</span>}
              <div><strong>{displayedPost.author || 'NutriBot community'}</strong><small>{displayedPost.username || 'Published content'}</small></div></div>
            <dl className="post-discussion-facts">
              {createdLabel && <div><dt><CalendarDays size={15}/> Date</dt><dd>{createdLabel}</dd></div>}
              {durationLabel && <div><dt><Timer size={15}/> Duration</dt><dd>{durationLabel}</dd></div>}
              <div><dt><Eye size={15}/> Views</dt><dd>{Number(displayedPost.viewCount ?? 0).toLocaleString('en-US')}</dd></div>
            </dl>
          <article className="post-discussion-story">
            <p className="post-discussion-body">{extractStoryText(displayedPost.body || displayedPost.description) || 'No detail content has been added yet.'}</p>
            {!fullPost && !error && <p role="status">Loading full post...</p>}
            {error && <p role="alert">{error} <button type="button" onClick={() => setRetry((value) => value + 1)}>Retry</button></p>}
          </article>
          </div>
        </aside>
        <div className="post-discussion-scroll">
          <div className="post-discussion-vote"><VoteButton contentId={post.id} loadVote={interactionApi.loadVote} submitVote={interactionApi.submitVote}/></div>
          {composerTarget && <CommentSection contentId={post.id} composerTarget={composerTarget} loadComments={interactionApi.loadComments} submitComment={interactionApi.submitComment}/>}
        </div>
      </div>
      <footer className="post-discussion-composer" ref={setComposerTarget}/>
    </div>
  </dialog>, document.body);
}
