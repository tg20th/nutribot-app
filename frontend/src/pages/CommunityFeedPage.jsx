import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowUpRight, Play, Sparkles } from 'lucide-react';
import MemberPageLayout from '../layouts/MemberPageLayout';
import CommunityComposer from '../components/community/CommunityComposer';
import CommunityFilters from '../components/community/CommunityFilters';
import CommunityPostCard from '../components/community/CommunityPostCard';
import CommunityRightRail from '../components/community/CommunityRightRail';
import ChatbotWidget from '../components/chatbot/ChatbotWidget';
import CreateBlogPage from './CreateBlogPage';
import { appendUniquePersonalizedPosts, getCommunityFilters, getPersonalizedPostsPage } from '../services/communityApi';
import { getMyProfile } from '../services/profileApi';

gsap.registerPlugin(ScrollTrigger);

function postKey(post) {
  return `${post.type ?? 'POST'}:${post.id ?? post.slug ?? post.title}`;
}

export default function CommunityFeedPage() {
  const page = useRef(null);
  const composerTrigger = useRef(null);
  const loadMoreTrigger = useRef(null);
  const pagination = useRef({ cursor: null, hasMore: true });
  const loadingNextPage = useRef(false);
  const [filter, setFilter] = useState('All');
  const [composerOpen, setComposerOpen] = useState(false);
  const [posts, setPosts] = useState([]); const [profile, setProfile] = useState({}); const [filters, setFilters] = useState([]); const [loading, setLoading] = useState(true); const [loadingMore, setLoadingMore] = useState(false); const [error, setError] = useState('');

  const loadNextPage = useCallback(async (signal, { initial = false } = {}) => {
    if (loadingNextPage.current || (!initial && !pagination.current.hasMore)) return;

    loadingNextPage.current = true;
    if (!initial) setLoadingMore(true);
    const current = pagination.current;
    try {
      const result = await getPersonalizedPostsPage({ cursor: initial ? null : current.cursor, signal });
      if (signal?.aborted) return;
      pagination.current = {
        cursor: result.nextCursor,
        hasMore: result.hasMore
      };
      setPosts((existing) => initial ? appendUniquePersonalizedPosts([], result.posts) : appendUniquePersonalizedPosts(existing, result.posts));
      setError('');
    } catch (failure) {
      if (!signal?.aborted) setError(initial ? 'Unable to load the community feed.' : failure.message || 'Unable to load more community posts.');
    } finally {
      loadingNextPage.current = false;
      if (!initial && !signal?.aborted) setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    Promise.allSettled([loadNextPage(controller.signal, { initial: true }), getMyProfile(controller.signal), getCommunityFilters(controller.signal)]).then(([, profileResult, filtersResult]) => {
      if (controller.signal.aborted) return;
      if (profileResult.status === 'fulfilled') setProfile(profileResult.value);
      if (filtersResult.status === 'fulfilled') setFilters(filtersResult.value);
      setLoading(false);
    });
    return () => {
      controller.abort();
      loadingNextPage.current = false;
    };
  }, [loadNextPage]);

  useEffect(() => {
    const trigger = loadMoreTrigger.current;
    if (!trigger || loading || !pagination.current.hasMore) return;
    const controller = new AbortController();
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) loadNextPage(controller.signal);
    }, { rootMargin: '400px 0px' });
    observer.observe(trigger);
    return () => { observer.disconnect(); controller.abort(); };
  }, [loadNextPage, loading, posts]);

  const visiblePosts = useMemo(() => posts.filter((post) => {
    const matchesFilter = filter === 'All' || post.title.toLowerCase().includes(filter.replace('#', '').toLowerCase());
    return matchesFilter;
  }), [posts, filter]);
  const discoverPosts = useMemo(() => posts.filter((post) => post.image).slice(0, 2), [posts]);
  const openComposer = () => { composerTrigger.current = document.activeElement; setComposerOpen(true); };
  const closeComposer = () => { setComposerOpen(false); requestAnimationFrame(() => composerTrigger.current?.focus()); };

  useGSAP(() => {
    gsap.from('.feed-intro > *', { y: 28, opacity: 0, duration: .85, stagger: .11, ease: 'power3.out' });
    gsap.utils.toArray('.community-post').forEach((card) => {
      gsap.fromTo(card, { scale: .94, opacity: .25 }, { scale: 1, opacity: 1, ease: 'none', scrollTrigger: { trigger: card, start: 'top 92%', end: 'top 43%', scrub: .45 } });
    });
    gsap.utils.toArray('.community-post-media img').forEach((image) => {
      gsap.fromTo(image, { scale: .88 }, { scale: 1.05, ease: 'none', scrollTrigger: { trigger: image, start: 'top bottom', end: 'bottom top', scrub: .8 } });
    });
  }, { scope: page });

  return <>
    <MemberPageLayout>
      <div className="community-layout" ref={page}>
        <main className="community-feed">
          <section className="feed-intro" aria-labelledby="feed-title">
            <div className="feed-intro-copy"><p>YOUR DAILY TABLE</p><h1 id="feed-title">Good food, <span className="feed-inline-image"/> shared well.</h1><span>Recipes, practical videos, and small ideas worth bringing to your next meal.</span></div>
            <div className="feed-intro-actions"><button type="button" onClick={openComposer}>Share a bite <ArrowUpRight size={17}/></button>{discoverPosts.length === 2 && <a href="#discover">Explore picks <Sparkles size={16}/></a>}</div>
          </section>
          {discoverPosts.length === 2 && <section className="feed-discover" id="discover" aria-label="Featured food stories">
            <article className="discover-feature group"><img src={discoverPosts[0].image} alt={discoverPosts[0].title}/><div><span><Play size={13} fill="currentColor"/> Watch now</span><h2>{discoverPosts[0].title}</h2><p>{discoverPosts[0].description}</p></div></article>
            <article className="discover-note"><span>Today&apos;s mood</span><b>Bright,<br/>fresh,<br/>uncomplicated.</b><small>Curated for your table</small></article>
            <article className="discover-feature discover-feature--small group"><img src={discoverPosts[1].image} alt={discoverPosts[1].title}/><div><span>READ &amp; SAVE</span><h2>{discoverPosts[1].title}</h2></div></article>
          </section>}
          <div className="feed-stream-heading"><div><span>The community stream</span><h2>What&apos;s nourishing people now</h2></div><p>Stories and videos, all in one thoughtful place.</p></div>
          <CommunityComposer onOpen={openComposer} profile={profile}/>
          <CommunityFilters filters={filters} active={filter} onChange={setFilter}/>
          {loading ? <p className="content-status">Loading community posts...</p> : error && !posts.length ? <p className="content-status content-status--error">{error}</p> : visiblePosts.length ? visiblePosts.map((post) => <CommunityPostCard key={postKey(post)} post={post} profile={profile} fullPageDetail/>) : <div className="empty-results">No posts match that filter yet.</div>}
          {!loading && <div ref={loadMoreTrigger} className="feed-load-more" aria-live="polite">
            {loadingMore && <span>Loading more posts...</span>}
            {error && posts.length > 0 && <span className="content-status--error">{error}</span>}
          </div>}
        </main>
        <CommunityRightRail/>
      </div>
    </MemberPageLayout>
    <ChatbotWidget/>
    {composerOpen && <CreateBlogPage modal onClose={closeComposer}/>}
  </>;
}
