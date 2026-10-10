import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, RotateCcw, UsersRound } from 'lucide-react';
import CommunityTopBar from '../community/CommunityTopBar';
import CommunitySideNav from '../community/CommunitySideNav';
import RestaurantRecommendations from '../community/RestaurantRecommendations';
import { getPost } from '../../services/communityApi';
import CommentSection from './CommentSection';
import { formatPostDate, extractStoryText } from '../../utils/content';
import VoteButton from './VoteButton';
import '../../styles/feed-content-detail.css';

export default function FeedContentDetail({ post, onClose, focusComments = false, focusCaption = false, loadPost = getPost, interactionApi = {} }) {
  const dialog = useRef(null);
  const comments = useRef(null);
  const story = useRef(null);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const nutrition = detail?.nutrition ?? {};
  const nutritionItems = detail ? [
    detail.calories != null && { label: 'Calories', value: detail.calories },
    detail.protein != null && { label: 'Protein', value: `${detail.protein}g` },
    nutrition.carbs && { label: 'Carbs', value: nutrition.carbs },
    nutrition.fat && { label: 'Healthy fats', value: nutrition.fat },
  ].filter(Boolean) : [];
  const closedByPopstateRef = useRef(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.history?.pushState && post?.id) {
      try {
        window.history.pushState({ feedDetailModal: true, postId: post.id }, '', `/community/posts/${post.id}`);
      } catch {
        // Safe fallback in test or sandboxed environments
      }
    }

    const handlePopState = () => {
      closedByPopstateRef.current = true;
      onCloseRef.current();
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (!closedByPopstateRef.current && window.history?.state?.feedDetailModal) {
        try {
          window.history.back();
        } catch {
          // ignore
        }
      }
    };
  }, [post?.id]);

  const handleBack = () => {
    if (!closedByPopstateRef.current && window.history?.state?.feedDetailModal) {
      closedByPopstateRef.current = true;
      try {
        window.history.back();
      } catch {
        // ignore
      }
    }
    onCloseRef.current();
  };

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
    } else if (focusCaption) {
      story.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
    } else dialog.current.scrollTop = 0;
  }, [detail, focusCaption, focusComments]);

  return createPortal(<dialog ref={dialog} className="community-page nb-content-detail" aria-labelledby="nb-content-title"
    onCancel={(event) => { event.preventDefault(); handleBack(); }}>
    <CommunityTopBar/>
    <div className="community-shell">
    <CommunitySideNav activePath="/home"/>
    <span className="community-sidenav-spacer" aria-hidden="true"/>
    <main className="content-detail-main">
      <button className="detail-back" type="button" onClick={handleBack}><ArrowLeft size={16}/> Back to {post.type === 'video' ? 'video' : 'blog'}</button>
      {!detail ? <section className="nb-content-state"><h1 id="nb-content-title">{post.title}</h1>{error
        ? <div role="alert"><p>{error}</p><button type="button" onClick={() => setRetry((value) => value + 1)}><RotateCcw size={16}/> Try again</button></div>
        : <p role="status">Loading full post...</p>}</section>
        : <>
          <section className="detail-hero">
            <div className="detail-hero-copy"><span>{detail.type === 'video' ? 'WATCH & COOK' : 'RECIPE JOURNAL'}</span>{detail.title && <h1 id="nb-content-title">{detail.title}</h1>}
              {detail.description !== detail.body && <p>{extractStoryText(detail.description)}</p>}
              <div className="detail-author">{detail.avatar && <img src={detail.avatar} alt=""/>}<div><b>{detail.author || 'NutriBot community'}</b><small>{detail.createdAt && <time dateTime={detail.createdAt}>{formatPostDate(detail.createdAt)}</time>}</small></div></div>
            </div>
            {(detail.image || detail.videoUrl) && <div className="detail-media">{detail.type === 'video' && detail.videoUrl
              ? <video controls preload="metadata" src={detail.videoUrl} poster={detail.image || undefined}/>
              : <img src={detail.image} alt={detail.title}/>}</div>}
          </section>
          {nutritionItems.length > 0 && <section className="detail-nutrition" aria-label="Nutrition information">
            <div className="detail-nutrition-title"><span>Per serving</span><h2>Simple, balanced fuel.</h2><p>Every ingredient has a purpose. Use these numbers as a friendly guide, not a rulebook.</p></div>
            <div className="nutrition-grid">{nutritionItems.map((item) => <div key={item.label}><b>{item.value}</b><span>{item.label}</span></div>)}</div>
          </section>}
          {(detail.pantryItems?.length || detail.steps?.length) && <section className="detail-content-grid">
            {detail.pantryItems?.length > 0 && <article className="detail-ingredients"><div className="detail-section-head"><span>What you need</span><h2>Ingredients</h2>{detail.servings && <small>Serves {detail.servings}</small>}</div><ul>{detail.pantryItems.map((item, index) => <li key={index}><i>{String(index + 1).padStart(2, '0')}</i>{item}</li>)}</ul>{(nutrition.fiber || nutrition.sodium) && <div className="detail-micro-nutrition">{nutrition.fiber && <span>Fiber <b>{nutrition.fiber}</b></span>}{nutrition.sodium && <span>Sodium <b>{nutrition.sodium}</b></span>}</div>}</article>}
            {detail.steps?.length > 0 && <article className="detail-method"><div className="detail-section-head"><span>Make it yours</span><h2>Method</h2>{detail.prepTime && <small>{detail.prepTime} prep{detail.cookTime ? ` / ${detail.cookTime} cook` : ''}</small>}</div><ol>{detail.steps.map((step, index) => <li key={index}><b>{index + 1}</b><p>{step}</p></li>)}</ol></article>}
          </section>}
          {(detail.cleanBody || detail.body || detail.description) && <article ref={story} className="nb-content-body" tabIndex="-1">
            <div className="detail-section-head"><h2>{detail.type === 'video' ? 'About this video' : 'The story'}</h2></div>
            {String(extractStoryText(detail.cleanBody || detail.body || detail.description))
              .split(/\n\n+/)
              .filter(Boolean)
              .map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
          </article>}
          <RestaurantRecommendations dishName={detail.title}/>
          <section className="detail-actions"><VoteButton contentId={post.id} loadVote={interactionApi.loadVote} submitVote={interactionApi.submitVote}/></section>
          <section ref={comments} tabIndex={-1} className="detail-comments" aria-label="Comments"><CommentSection contentId={post.id} loadComments={interactionApi.loadComments} submitComment={interactionApi.submitComment}/><div className="detail-community-cta"><UsersRound size={22}/><div><b>Have a variation worth sharing?</b><span>Your kitchen notes might make someone else&apos;s dinner easier.</span></div><button type="button" onClick={handleBack}>Open the feed</button></div></section>
        </>}
    </main>
    </div>
  </dialog>, document.body);
}
