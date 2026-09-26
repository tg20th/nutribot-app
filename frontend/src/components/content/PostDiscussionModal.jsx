import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { getPost } from '../../services/communityApi';
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
      <div className="post-discussion-scroll">
        <article className="post-discussion-story">
          <div className="post-discussion-author">{displayedPost.avatar ? <img src={displayedPost.avatar} alt=""/> : <span>{(displayedPost.author || 'N').charAt(0)}</span>}
            <div><strong>{displayedPost.author}</strong><small>{displayedPost.username} · {displayedPost.createdAt}</small></div></div>
          <h3>{displayedPost.title}</h3>
          <p className="post-discussion-body">{displayedPost.body || displayedPost.description}</p>
          {!fullPost && !error && <p role="status">Loading full post...</p>}
          {error && <p role="alert">{error} <button type="button" onClick={() => setRetry((value) => value + 1)}>Retry</button></p>}
          {displayedPost.type === 'video' && displayedPost.videoUrl
            ? <video controls src={displayedPost.videoUrl} poster={displayedPost.image || undefined}/>
            : (displayedPost.images?.length ? displayedPost.images : [displayedPost.image]).filter(Boolean).map((src, index) => <img className="post-discussion-image" key={`${src}-${index}`} src={src} alt={displayedPost.title}/>)}
        </article>
        <div className="post-discussion-vote"><VoteButton contentId={post.id} loadVote={interactionApi.loadVote} submitVote={interactionApi.submitVote}/></div>
        {composerTarget && <CommentSection contentId={post.id} composerTarget={composerTarget} loadComments={interactionApi.loadComments} submitComment={interactionApi.submitComment}/>}
      </div>
      <footer className="post-discussion-composer" ref={setComposerTarget}/>
    </div>
  </dialog>, document.body);
}
