import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ArrowLeft, Clock3, Play, UsersRound } from 'lucide-react';
import CommunityTopBar from '../components/community/CommunityTopBar';
import CommunitySideNav from '../components/community/CommunitySideNav';
import RestaurantRecommendations from '../components/community/RestaurantRecommendations';
import ChatbotWidget from '../components/chatbot/ChatbotWidget';
import CommentSection from '../components/content/CommentSection';
import VoteButton from '../components/content/VoteButton';
import { getPost } from '../services/communityApi';
import { extractStoryText } from '../utils/content';

export default function CommunityContentDetailPage() {
  const { postId } = useParams();
  const location = useLocation();
  const requestedReturnTo = location.state?.returnTo;
  const searchReturnState = location.state?.restoreSearch ? { restoreSearch: true } : undefined;
  const isMyContentReturn = requestedReturnTo === '/community/my-blogs';
  const returnTo = isMyContentReturn || (typeof requestedReturnTo === 'string' && requestedReturnTo.startsWith('/community/search')) ? requestedReturnTo : '/home';
  const isSearchReturn = returnTo.startsWith('/community/search');
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const page = useRef(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setPost(null);
    getPost(postId, controller.signal).then((item) => {
      if (!controller.signal.aborted) setPost(item);
    }).catch(() => {
      if (!controller.signal.aborted) setPost(false);
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [postId]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [postId]);

  useGSAP(() => { if (post) gsap.from('.detail-reveal', { y: 26, opacity: 0, duration: .8, stagger: .1, ease: 'power3.out' }); }, { scope: page, dependencies: [post] });

  if (!post) return <div className="community-page community-detail-page">
    <CommunityTopBar query={query} onQueryChange={setQuery}/>
    <div className="community-shell">
      <CommunitySideNav activePath={isSearchReturn ? '/community/search' : '/home'}/>
      <span className="community-sidenav-spacer" aria-hidden="true"/>
      <main className="detail-not-found">{loading ? <p role="status">Loading story...</p> : <><h1>That story is no longer available.</h1><Link to={returnTo} state={searchReturnState}>{isSearchReturn ? 'Return to search results' : 'Return to home'}</Link></>}</main>
    </div>
  </div>;

  const image = post.type === 'gallery' ? post.images[0] : post.image;
  const nutrition = post.nutrition ?? { carbs: '—', fat: '—', fiber: '—', sodium: '—' };

  return <div className="community-page community-detail-page" ref={page}>
    <CommunityTopBar query={query} onQueryChange={setQuery}/>
    <div className="community-shell">
      <CommunitySideNav activePath={isSearchReturn ? '/community/search' : '/home'}/>
      <span className="community-sidenav-spacer" aria-hidden="true"/>
      <main className="content-detail-main">
        <Link className="detail-back detail-reveal" to={returnTo} state={searchReturnState}><ArrowLeft size={16}/>{isMyContentReturn ? 'Back to my content' : isSearchReturn ? 'Back to search results' : 'Back to home'}</Link>
        <section className="detail-hero detail-reveal">
          <div className="detail-hero-copy"><span>{post.type === 'video' ? 'WATCH & COOK' : 'RECIPE JOURNAL'}</span><h1>{post.title}</h1>{post.description && post.description !== (post.cleanBody || post.body) && <p>{extractStoryText(post.description)}</p>}<div className="detail-author">{post.avatar ? <img src={post.avatar} alt=""/> : <span className="avatar-fallback" aria-hidden="true">{(post.author || 'N').charAt(0).toUpperCase()}</span>}<div><b>{post.author}</b><small>{[post.username, post.createdAt].filter(Boolean).join(' · ')}</small></div></div></div>
          <div className="detail-media">
            {post.type === 'video' && post.videoUrl
              ? <video controls playsInline preload="metadata" src={post.videoUrl} poster={image || undefined} aria-label={post.title}/>
              : <>{image && <img src={image} alt={post.title}/>} {post.type === 'video' && <span className="detail-play" aria-hidden="true"><Play fill="currentColor" size={24}/></span>}</>}
            <span className="detail-duration"><Clock3 size={13}/>{post.prepTime} prep</span>
          </div>
        </section>
        <section className="detail-nutrition detail-reveal" aria-label="Nutrition information">
          <div className="detail-nutrition-title"><span>Per serving</span><h2>Simple, balanced fuel.</h2><p>Every ingredient has a purpose. Use these numbers as a friendly guide, not a rulebook.</p></div>
          <div className="nutrition-grid"><div><b>{post.calories}</b><span>Calories</span></div><div><b>{post.protein}g</b><span>Protein</span></div><div><b>{nutrition.carbs}</b><span>Carbs</span></div><div><b>{nutrition.fat}</b><span>Healthy fats</span></div></div>
        </section>
        <section className="detail-content-grid detail-reveal">
          <article className="detail-ingredients"><div className="detail-section-head"><span>What you need</span><h2>Ingredients</h2><small>Serves {post.servings}</small></div><ul>{(post.pantryItems ?? ['Ingredients will be shared soon.']).map((item, index) => <li key={item}><i>{String(index + 1).padStart(2, '0')}</i>{item}</li>)}</ul><div className="detail-micro-nutrition"><span>Fiber <b>{nutrition.fiber}</b></span><span>Sodium <b>{nutrition.sodium}</b></span></div></article>
          <article className="detail-method"><div className="detail-section-head"><span>Make it yours</span><h2>Method</h2><small>{post.prepTime} prep · {post.cookTime} cook</small></div><ol>{(post.steps ?? []).map((step, index) => <li key={step}><b>{index + 1}</b><p>{step}</p></li>)}</ol></article>
        </section>
        <article className="nb-content-body detail-reveal">
          <div className="detail-section-head"><h2>{post.type === 'video' ? 'About this video' : 'The story'}</h2></div>
          {String(extractStoryText(post.cleanBody || post.body || post.description) || 'No detail content has been added yet.')
            .split(/\n\n+/)
            .filter(Boolean)
            .map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
        </article>
        <RestaurantRecommendations dishName={post.title}/>
        <section className="detail-actions detail-reveal"><VoteButton contentId={post.id}/></section>
        <section className="detail-comments detail-reveal"><CommentSection contentId={post.id}/><div className="detail-community-cta"><UsersRound size={22}/><div><b>Have a variation worth sharing?</b><span>Your kitchen notes might make someone else&apos;s dinner easier.</span></div><Link to="/home">Open the feed</Link></div></section>
      </main>
    </div>
    <ChatbotWidget/>
  </div>;
}
