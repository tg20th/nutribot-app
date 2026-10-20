import { MessageCircle, Play, RefreshCw, ThumbsUp } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getCommunityHighlights } from '../../services/communityApi';
import ImageWithFallback from '../ImageWithFallback';
import UserProfileLink from '../UserProfileLink';

function HighlightsSkeleton() {
  return <ul className="community-highlights community-highlights--skeleton" aria-hidden="true">
    {Array.from({ length: 3 }, (_, index) => <li key={index}>
      <span className="community-highlight-skeleton community-highlight-skeleton--thumb"/>
      <span className="community-highlight-skeleton-copy"><span/><span/><span/></span>
    </li>)}
  </ul>;
}

function CommunityHighlights({ highlights, loading, error, onRetry, onOpenPost }) {
  return <div className="community-widget community-highlights-widget">
    <div className="community-widget-head"><b>Community Highlights</b><Link to="/home">Explore Community</Link></div>
    {loading ? <HighlightsSkeleton/> : error ? <div className="community-highlight-state community-highlight-state--error"><p>Highlights are unavailable right now.</p><button type="button" onClick={onRetry}><RefreshCw size={13}/>Try again</button></div> : highlights.length ? <ul className="community-highlights">
      {highlights.map((post) => <li key={`${post.type}-${post.id}`}>
        <button type="button" className="community-highlight-media" onClick={() => onOpenPost?.(post.id)} aria-label={`Open ${post.title}`}>
          <ImageWithFallback src={post.image} alt="" />
          {post.type === 'video' && <span className="community-highlight-video" aria-label="Video"><Play size={11} fill="currentColor"/></span>}
        </button>
        <div className="community-highlight-copy">
          <button type="button" className="community-highlight-title" onClick={() => onOpenPost?.(post.id)}>{post.title}</button>
          <div className="community-highlight-author"><span>by </span><UserProfileLink userId={post.authorId}>{post.author || post.username || 'NutriBot member'}</UserProfileLink></div>
          <div className="community-highlight-meta"><span><ThumbsUp size={12}/>{post.likes ?? 0}</span>{post.comments != null && <span><MessageCircle size={12}/>{post.comments}</span>}</div>
        </div>
      </li>)}
    </ul> : <p className="community-highlight-state">No public stories to highlight yet.</p>}
  </div>;
}

export default function CommunityRightRail({ onOpenPost }) {
  const [highlights, setHighlights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const requestRef = useRef(null);
  const loadHighlights = useCallback(() => {
    const controller = new AbortController();
    requestRef.current?.abort();
    requestRef.current = controller;
    setLoading(true);
    setError(false);
    getCommunityHighlights({ signal: controller.signal })
      .then(setHighlights)
      .catch((failure) => { if (failure.name !== 'AbortError') setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
  }, []);

  useEffect(() => {
    loadHighlights();
    return () => requestRef.current?.abort();
  }, [loadHighlights]);

  return <aside className="community-right-rail">
    <CommunityHighlights highlights={highlights} loading={loading} error={error} onRetry={loadHighlights} onOpenPost={onOpenPost}/>
    <p className="community-rail-footer">About &middot; Community Guidelines &middot; Privacy</p>
  </aside>;
}
