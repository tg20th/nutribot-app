import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ArrowLeft, Bookmark, Clock3, Heart, MessageCircle, Play, Send, Share2, UsersRound } from 'lucide-react';
import CommunityTopBar from '../components/community/CommunityTopBar';
import ChatbotWidget from '../components/chatbot/ChatbotWidget';
import { createPostComment, getPost, getPostComments } from '../services/communityApi';
import { getMyProfile } from '../services/profileApi';

export default function CommunityContentDetailPage() {
  const { postId } = useParams();
  const [post, setPost] = useState(null); const [communityUser, setCommunityUser] = useState({});
  const page = useRef(null);
  const [query, setQuery] = useState('');
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState([]);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => { const controller = new AbortController(); Promise.all([getPost(postId, controller.signal), getPostComments(postId, controller.signal), getMyProfile(controller.signal)]).then(([item, list, user]) => { setPost(item); setComments(list); setCommunityUser(user); }).catch(() => setPost(false)); return () => controller.abort(); }, [postId]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [postId]);

  useGSAP(() => { if (post) gsap.from('.detail-reveal', { y: 26, opacity: 0, duration: .8, stagger: .1, ease: 'power3.out' }); }, { scope: page, dependencies: [post] });

  if (!post) return <><CommunityTopBar query={query} onQueryChange={setQuery}/><main className="detail-not-found"><h1>That story is no longer available.</h1><Link to="/home">Return to home</Link></main></>;
  const image = post.type === 'gallery' ? post.images[0] : post.image;
  const nutrition = post.nutrition ?? { carbs: '—', fat: '—', fiber: '—', sodium: '—' };
  const submitComment = (event) => { event.preventDefault(); if (!comment.trim()) return; createPostComment(post.id, { content: comment.trim() }).then((item) => { setComments((current) => [...current, item]); setComment(''); }); };

  return <div className="community-page community-detail-page" ref={page}>
    <CommunityTopBar query={query} onQueryChange={setQuery}/>
    <main className="content-detail-main">
      <Link className="detail-back detail-reveal" to="/home"><ArrowLeft size={16}/> Back to home</Link>
      <section className="detail-hero detail-reveal">
        <div className="detail-hero-copy"><span>{post.type === 'video' ? 'WATCH & COOK' : 'RECIPE JOURNAL'}</span><h1>{post.title}</h1><p>{post.description}</p><div className="detail-author"><img src={post.avatar} alt=""/><div><b>{post.author}</b><small>{post.username} · {post.createdAt}</small></div></div></div>
        <div className="detail-media"><img src={image} alt={post.title}/>{post.type === 'video' && <button className="detail-play" type="button" aria-label="Play video"><Play fill="currentColor" size={24}/></button>}<span className="detail-duration"><Clock3 size={13}/>{post.prepTime} prep</span></div>
      </section>
      <section className="detail-nutrition detail-reveal" aria-label="Nutrition information">
        <div className="detail-nutrition-title"><span>Per serving</span><h2>Simple, balanced fuel.</h2><p>Every ingredient has a purpose. Use these numbers as a friendly guide, not a rulebook.</p></div>
        <div className="nutrition-grid"><div><b>{post.calories}</b><span>Calories</span></div><div><b>{post.protein}g</b><span>Protein</span></div><div><b>{nutrition.carbs}</b><span>Carbs</span></div><div><b>{nutrition.fat}</b><span>Healthy fats</span></div></div>
      </section>
      <section className="detail-content-grid detail-reveal">
        <article className="detail-ingredients"><div className="detail-section-head"><span>What you need</span><h2>Ingredients</h2><small>Serves {post.servings}</small></div><ul>{(post.pantryItems ?? ['Ingredients will be shared soon.']).map((item, index) => <li key={item}><i>{String(index + 1).padStart(2, '0')}</i>{item}</li>)}</ul><div className="detail-micro-nutrition"><span>Fiber <b>{nutrition.fiber}</b></span><span>Sodium <b>{nutrition.sodium}</b></span></div></article>
        <article className="detail-method"><div className="detail-section-head"><span>Make it yours</span><h2>Method</h2><small>{post.prepTime} prep · {post.cookTime} cook</small></div><ol>{(post.steps ?? []).map((step, index) => <li key={step}><b>{index + 1}</b><p>{step}</p></li>)}</ol></article>
      </section>
      <section className="detail-actions detail-reveal"><button type="button" onClick={() => setLiked(!liked)} className={liked ? 'is-liked' : ''}><Heart fill={liked ? 'currentColor' : 'none'} size={17}/>{liked ? 'Loved' : 'Love this'} · {post.likes}</button><button type="button" onClick={() => setSaved(!saved)} className={saved ? 'is-saved' : ''}><Bookmark fill={saved ? 'currentColor' : 'none'} size={17}/>{saved ? 'Saved to your table' : 'Save recipe'}</button><button type="button"><Share2 size={17}/> Share</button></section>
      <section className="detail-comments detail-reveal"><div className="detail-section-head"><span>Join the table</span><h2>Community discussion <small>({comments.length + post.comments})</small></h2></div><form className="detail-comment-form" onSubmit={submitComment}><img src={communityUser.avatar} alt=""/><input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Add a thoughtful comment or kitchen modification..."/><button type="submit"><Send size={16}/> Post comment</button></form><div className="detail-comment-list">{comments.map((item) => <article key={item.id}><img src={item.avatar} alt=""/><div><b>{item.author}</b><small>{item.time}</small><p>{item.text}</p><button type="button"><Heart size={14}/> {item.likes}</button><button type="button"><MessageCircle size={14}/> Reply</button></div></article>)}</div><div className="detail-community-cta"><UsersRound size={22}/><div><b>Have a variation worth sharing?</b><span>Your kitchen notes might make someone else&apos;s dinner easier.</span></div><Link to="/home">Open the feed</Link></div></section>
    </main>
    <ChatbotWidget/>
  </div>;
}
