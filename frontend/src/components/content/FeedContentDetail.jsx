import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, RotateCcw, UsersRound } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import CommunityTopBar from '../community/CommunityTopBar';
import CommunitySideNav from '../community/CommunitySideNav';
import RestaurantRecommendations from '../community/RestaurantRecommendations';
import { getPost } from '../../services/communityApi';
import CommentSection from './CommentSection';
import VoteButton from './VoteButton';
import '../../styles/feed-content-detail.css';

export default function FeedContentDetail({ post, onClose, focusComments = false, loadPost = getPost, interactionApi = {} }) {
  const dialog = useRef(null);
  const comments = useRef(null);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const location = useLocation();
  const openedAt = useRef(location.key);
  const nutrition = detail?.nutrition ?? {};
  useEffect(() => {
    if (location.key !== openedAt.current) onClose();
  }, [location.key, onClose]);

  useEffect(() => {
    const element = dialog.current;
    const opener = document.activeElement;
    const overflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = 'hidden';
    element.scrollTop = 0;
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setDetail(null);
    setError('');
    loadPost(post.id, controller.signal).then((data) => {
      if (!controller.signal.aborted) setDetail(data);
    }).catch(() => {
      if (!controller.signal.aborted) setError('Could not load this post. Please try again.');
    });
    return () => controller.abort();
  }, [post.id, loadPost, retry]);

  useEffect(() => {
    if (!detail) return;
    if (focusComments) {
      comments.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
      comments.current?.focus({ preventScroll: true });
    } else dialog.current.scrollTop = 0;
  }, [detail, focusComments]);

  return createPortal(<dialog ref={dialog} className="community-page nb-content-detail" aria-labelledby="nb-content-title"
    onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <CommunityTopBar/>
    <div className="community-shell">
    <CommunitySideNav activePath="/home"/>
    <span className="community-sidenav-spacer" aria-hidden="true"/>
    <main className="content-detail-main">
      <button className="detail-back" type="button" onClick={onClose}><ArrowLeft size={16}/> Back to {post.type === 'video' ? 'video' : 'blog'}</button>
      {!detail ? <section className="nb-content-state"><h1 id="nb-content-title">{post.title}</h1>{error
        ? <div role="alert"><p>{error}</p><button type="button" onClick={() => setRetry((value) => value + 1)}><RotateCcw size={16}/> Try again</button></div>
        : <p role="status">Loading full post...</p>}</section>
        : <>
          <section className="detail-hero">
            <div className="detail-hero-copy"><span>{detail.type === 'video' ? 'WATCH & COOK' : 'RECIPE JOURNAL'}</span><h1 id="nb-content-title">{detail.title}</h1>
              {detail.description !== detail.body && <p>{detail.description}</p>}
              <div className="detail-author">{detail.avatar && <img src={detail.avatar} alt=""/>}<div><b>{detail.author || 'NutriBot community'}</b><small>{detail.createdAt && new Date(detail.createdAt).toLocaleDateString('en-GB')}</small></div></div>
            </div>
            {(detail.image || detail.videoUrl) && <div className="detail-media">{detail.type === 'video' && detail.videoUrl
              ? <video controls preload="metadata" src={detail.videoUrl} poster={detail.image || undefined}/>
              : <img src={detail.image} alt={detail.title}/>}</div>}
          </section>
          <section className="detail-nutrition" aria-label="Nutrition information">
            <div className="detail-nutrition-title"><span>Per serving</span><h2>Simple, balanced fuel.</h2><p>Every ingredient has a purpose. Use these numbers as a friendly guide, not a rulebook.</p></div>
            <div className="nutrition-grid"><div><b>{detail.calories ?? '-'}</b><span>Calories</span></div><div><b>{detail.protein != null ? `${detail.protein}g` : '-'}</b><span>Protein</span></div><div><b>{nutrition.carbs ?? '-'}</b><span>Carbs</span></div><div><b>{nutrition.fat ?? '-'}</b><span>Healthy fats</span></div></div>
          </section>
          <section className="detail-content-grid">
            <article className="detail-ingredients"><div className="detail-section-head"><span>What you need</span><h2>Ingredients</h2>{detail.servings && <small>Serves {detail.servings}</small>}</div><ul>{(detail.pantryItems?.length ? detail.pantryItems : ['Ingredients will be shared soon.']).map((item, index) => <li key={index}><i>{String(index + 1).padStart(2, '0')}</i>{item}</li>)}</ul><div className="detail-micro-nutrition"><span>Fiber <b>{nutrition.fiber ?? '-'}</b></span><span>Sodium <b>{nutrition.sodium ?? '-'}</b></span></div></article>
            <article className="detail-method"><div className="detail-section-head"><span>Make it yours</span><h2>Method</h2>{detail.prepTime && <small>{detail.prepTime} prep{detail.cookTime ? ` / ${detail.cookTime} cook` : ''}</small>}</div>{detail.steps?.length ? <ol>{detail.steps.map((step, index) => <li key={index}><b>{index + 1}</b><p>{step}</p></li>)}</ol> : <p>Method will be shared soon.</p>}</article>
          </section>
          <article className="nb-content-body">
            <div className="detail-section-head"><h2>{detail.type === 'video' ? 'About this video' : 'The story'}</h2></div>
            {String(detail.cleanBody || detail.body || detail.description || 'No detail content has been added yet.')
              .split(/\n\n+/)
              .filter(Boolean)
              .map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
          </article>
          <RestaurantRecommendations dishName={detail.title}/>
          <section className="detail-actions"><VoteButton contentId={post.id} loadVote={interactionApi.loadVote} submitVote={interactionApi.submitVote}/></section>
          <section ref={comments} tabIndex={-1} className="detail-comments" aria-label="Comments"><CommentSection contentId={post.id} loadComments={interactionApi.loadComments} submitComment={interactionApi.submitComment}/><div className="detail-community-cta"><UsersRound size={22}/><div><b>Have a variation worth sharing?</b><span>Your kitchen notes might make someone else&apos;s dinner easier.</span></div><button type="button" onClick={onClose}>Open the feed</button></div></section>
        </>}
    </main>
    </div>
  </dialog>, document.body);
}
