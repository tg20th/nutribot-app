import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ArrowUpRight, Play, Sparkles } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import MemberPageLayout from '../layouts/MemberPageLayout';
import CommunityComposer from '../components/community/CommunityComposer';
import CommunityFilters from '../components/community/CommunityFilters';
import CommunityPostCard from '../components/community/CommunityPostCard';
import CommunityRightRail from '../components/community/CommunityRightRail';
import ChatbotWidget from '../components/chatbot/ChatbotWidget';
import CreateBlogPage from './CreateBlogPage';
import { appendUniquePersonalizedPosts, getCommunityFilters, getPersonalizedPostsPage, getPost, prioritizePersonalizedPost } from '../services/communityApi';
import { getMyProfile } from '../services/profileApi';
import { captureFeedAnchor, clearFeedSnapshots, completeFeedPageLoad, feedSnapshotKey, getActiveFeedSnapshot, getFeedSnapshot, isFeedRequestCurrent, prepareFeedCacheForPageLoad, refreshFeedSnapshot, restoreFeedAnchor, saveActiveFeedSnapshot } from '../services/feedStateCache';

function postKey(post) {
  return `${post.type ?? 'POST'}:${post.id ?? post.slug ?? post.title}`;
}

function FeedPostSkeleton() {
  return <article className="community-post-skeleton" aria-hidden="true">
    <header className="feed-skeleton-header">
      <span className="feed-skeleton-shape feed-skeleton-avatar"/>
      <div className="feed-skeleton-author">
        <span className="feed-skeleton-shape feed-skeleton-line feed-skeleton-line--author"/>
        <span className="feed-skeleton-shape feed-skeleton-line feed-skeleton-line--meta"/>
      </div>
      <span className="feed-skeleton-shape feed-skeleton-options"/>
    </header>
    <div className="feed-skeleton-copy">
      <span className="feed-skeleton-shape feed-skeleton-line feed-skeleton-line--title"/>
      <span className="feed-skeleton-shape feed-skeleton-line feed-skeleton-line--title-short"/>
      <span className="feed-skeleton-shape feed-skeleton-line feed-skeleton-line--body"/>
    </div>
    <span className="feed-skeleton-shape feed-skeleton-media"/>
    <footer className="feed-skeleton-actions">
      <span className="feed-skeleton-shape feed-skeleton-action"/>
      <span className="feed-skeleton-shape feed-skeleton-action feed-skeleton-action--short"/>
    </footer>
  </article>;
}

export default function CommunityFeedPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [browserReload] = useState(prepareFeedCacheForPageLoad);
  const page = useRef(null);
  const composerTrigger = useRef(null);
  const loadMoreTrigger = useRef(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const requestGeneration = useRef(0);
  const requestedSnapshot = useMemo(() => {
    if (browserReload) {
      return { key: feedSnapshotKey('home', 'All'), snapshot: null };
    }
    const key = location.state?.feedSnapshotKey || feedSnapshotKey('home', location.state?.feedFilter || 'All');
    const snapshot = location.state?.feedSnapshotKey
      ? getFeedSnapshot(key)
      : getActiveFeedSnapshot('home') || getFeedSnapshot(key);
    return { key, snapshot };
  }, [browserReload, location.state, refreshVersion]);
  const restoredSnapshot = requestedSnapshot.snapshot;
  const pagination = useRef(restoredSnapshot?.pagination ?? { cursor: null, hasMore: true });
  const loadingNextPage = useRef(false);
  const requestedPriorityId = useRef(browserReload ? null : (location.state?.prioritizeContentId ?? null));
  const pinnedContentId = useRef(null);
  const [filter, setFilter] = useState(restoredSnapshot?.filter ?? (browserReload ? 'All' : location.state?.feedFilter) ?? 'All');
  const [composerType, setComposerType] = useState(null);
  const [posts, setPosts] = useState(restoredSnapshot?.posts ?? []); const [profile, setProfile] = useState({}); const [filters, setFilters] = useState(restoredSnapshot?.filters ?? []); const [loading, setLoading] = useState(!restoredSnapshot); const [loadingMore, setLoadingMore] = useState(false); const [error, setError] = useState('');
  const restorePending = useRef(restoredSnapshot ? { ...restoredSnapshot.anchor } : null);
  const [restoreReady, setRestoreReady] = useState(!restoredSnapshot);
  const latestFeed = useRef({ posts, pagination: pagination.current, filter, filters });
  latestFeed.current = { posts, pagination: pagination.current, filter, filters };

  useLayoutEffect(() => {
    const previousRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    if (browserReload) window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    completeFeedPageLoad();
    return () => { window.history.scrollRestoration = previousRestoration; };
  }, [browserReload]);

  useEffect(() => {
    const clearOnAuthChange = () => clearFeedSnapshots();
    const clearOnStorageChange = (event) => {
      if (event.key === 'nutribot-auth-token') clearFeedSnapshots();
    };
    window.addEventListener('nutribot-auth-changed', clearOnAuthChange);
    window.addEventListener('storage', clearOnStorageChange);
    return () => {
      window.removeEventListener('nutribot-auth-changed', clearOnAuthChange);
      window.removeEventListener('storage', clearOnStorageChange);
    };
  }, []);

  useLayoutEffect(() => () => {
    const current = latestFeed.current;
    if (!current.posts.length) return;
    const key = feedSnapshotKey('home', current.filter);
    saveActiveFeedSnapshot('home', key, { ...current, anchor: captureFeedAnchor(null, page.current) });
  }, []);

  const persistFeed = useCallback((postId = null) => {
    const anchor = captureFeedAnchor(postId, page.current);
    const key = feedSnapshotKey('home', filter);
    saveActiveFeedSnapshot('home', key, {
      posts,
      pagination: pagination.current,
      filter,
      filters,
      anchor
    });
    return key;
  }, [filter, filters, posts]);

  const openPost = useCallback((postId) => {
    const key = persistFeed(postId);
    navigate(`/community/posts/${postId}`, { state: { returnTo: '/home', feedSnapshotKey: key, feedFilter: filter, feedPostId: String(postId) } });
  }, [filter, navigate, persistFeed]);

  const refreshFeed = useCallback(() => {
    requestGeneration.current += 1;
    refreshFeedSnapshot(feedSnapshotKey('home', filter));
    pagination.current = { cursor: null, hasMore: true };
    loadingNextPage.current = false;
    pinnedContentId.current = null;
    requestedPriorityId.current = null;
    restorePending.current = null;
    setRestoreReady(true);
    setPosts([]);
    setError('');
    setLoading(true);
    setRefreshVersion((version) => version + 1);
  }, [filter]);

  const loadNextPage = useCallback(async (signal, { initial = false } = {}) => {
    if (loadingNextPage.current || (!initial && !pagination.current.hasMore)) return;

    const generation = requestGeneration.current;
    loadingNextPage.current = true;
    if (!initial) setLoadingMore(true);
    const current = pagination.current;
    try {
      const result = await getPersonalizedPostsPage({
        cursor: initial ? null : current.cursor,
        signal,
        cache: initial ? 'no-store' : undefined
      });
      if (!isFeedRequestCurrent(generation, requestGeneration.current, signal)) return;
      pagination.current = {
        cursor: result.nextCursor,
        hasMore: result.hasMore
      };
      let nextPosts = result.posts;
      if (initial && requestedPriorityId.current != null) {
        const priorityId = requestedPriorityId.current;
        let priorityPost = result.posts.find((post) => String(post.id ?? post.contentId) === String(priorityId));
        if (!priorityPost) {
          try {
            priorityPost = await getPost(priorityId, signal);
          } catch {
            // Pending, rejected, and inaccessible posts must not disrupt the feed.
          }
        }
        if (isFeedRequestCurrent(generation, requestGeneration.current, signal) && priorityPost) {
          pinnedContentId.current = priorityId;
          nextPosts = prioritizePersonalizedPost(result.posts, priorityPost);
        }
        requestedPriorityId.current = null;
      }
      if (!isFeedRequestCurrent(generation, requestGeneration.current, signal)) return;
      setPosts((existing) => {
        const incoming = pinnedContentId.current == null
          ? nextPosts
          : nextPosts.filter((post) => String(post.id ?? post.contentId) !== String(pinnedContentId.current));
        if (initial && pinnedContentId.current != null) {
          const priorityPost = nextPosts.find((post) => String(post.id ?? post.contentId) === String(pinnedContentId.current));
          return priorityPost
            ? prioritizePersonalizedPost(appendUniquePersonalizedPosts([], incoming), priorityPost)
            : appendUniquePersonalizedPosts([], incoming);
        }
        return appendUniquePersonalizedPosts(existing, incoming);
      });
      setError('');
    } catch (failure) {
      if (isFeedRequestCurrent(generation, requestGeneration.current, signal)) setError(initial ? 'Unable to load the community feed.' : failure.message || 'Unable to load more community posts.');
    } finally {
      loadingNextPage.current = false;
      if (!initial && isFeedRequestCurrent(generation, requestGeneration.current, signal)) setLoadingMore(false);
    }
  }, [browserReload]);

  useEffect(() => {
    if (requestedPriorityId.current != null && !restoredSnapshot) {
      // Consume route state now: after a browser reload the normal rank is used.
      const { prioritizeContentId: _ignored, ...rest } = location.state || {};
      navigate(location.pathname, { replace: true, state: rest });
    }
  }, [location.pathname, navigate]);

  useEffect(() => {
    const controller = new AbortController();
    const generation = requestGeneration.current;
    if (restoredSnapshot) {
      Promise.allSettled([getMyProfile(controller.signal), getCommunityFilters(controller.signal)]).then(([, profileResult, filtersResult]) => {
        if (controller.signal.aborted) return;
        if (profileResult.status === 'fulfilled') setProfile(profileResult.value);
        if (filtersResult.status === 'fulfilled' && !filters.length) setFilters(filtersResult.value);
      });
      return () => controller.abort();
    }
    // StrictMode runs an effect cleanup before its second development setup.
    // Scheduling in a microtask lets that simulated cleanup abort before any
    // first-page request reaches the backend; it is not a timing workaround.
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      Promise.allSettled([loadNextPage(controller.signal, { initial: true }), getMyProfile(controller.signal), getCommunityFilters(controller.signal)]).then(([, profileResult, filtersResult]) => {
        if (controller.signal.aborted) return;
        if (profileResult.status === 'fulfilled') setProfile(profileResult.value);
        if (filtersResult.status === 'fulfilled') setFilters(filtersResult.value);
        if (isFeedRequestCurrent(generation, requestGeneration.current, controller.signal)) setLoading(false);
      });
    });
    return () => {
      controller.abort();
      loadingNextPage.current = false;
    };
  }, [loadNextPage, refreshVersion]);

  useLayoutEffect(() => {
    if (loading || !restorePending.current) return undefined;
    if (!posts.length) {
      restorePending.current = null;
      setRestoreReady(true);
      return undefined;
    }
    const anchor = restorePending.current;
    // This is a layout effect, so the first restore happens before the Feed
    // paints. It avoids showing the list at the top before correcting it.
    restoreFeedAnchor(anchor, page.current);
    restorePending.current = null;
    setRestoreReady(true);

    // Images can change a card's height after the initial layout. Keep the
    // same saved anchor aligned while those already-rendered images settle;
    // this is event-driven and never delays restoration by a fixed timeout.
    const root = page.current;
    const pendingImages = new Set(
      Array.from(root?.querySelectorAll('img') ?? []).filter((image) => !image.complete)
    );
    if (!pendingImages.size) return undefined;

    const restoreAfterImageLoad = (event) => {
      if (!(event.target instanceof HTMLImageElement) || !pendingImages.delete(event.target)) return;
      restoreFeedAnchor(anchor, page.current);
      if (!pendingImages.size) root?.removeEventListener('load', restoreAfterImageLoad, true);
    };
    root?.addEventListener('load', restoreAfterImageLoad, true);
    return () => root?.removeEventListener('load', restoreAfterImageLoad, true);
  }, [loading, posts]);

  useEffect(() => {
    const trigger = loadMoreTrigger.current;
    if (!trigger || loading || !restoreReady || !pagination.current.hasMore) return;
    const controller = new AbortController();
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) loadNextPage(controller.signal);
    }, { rootMargin: '400px 0px' });
    observer.observe(trigger);
    return () => { observer.disconnect(); controller.abort(); };
  }, [loadNextPage, loading, posts, restoreReady]);

  const visiblePosts = useMemo(() => posts.filter((post) => {
    const matchesFilter = filter === 'All' || post.title.toLowerCase().includes(filter.replace('#', '').toLowerCase());
    return matchesFilter;
  }), [posts, filter]);
  const discoverPosts = useMemo(() => posts.filter((post) => post.image).slice(0, 2), [posts]);
  const openComposer = (type = 'blog') => { composerTrigger.current = document.activeElement; setComposerType(type); };
  const closeComposer = () => { setComposerType(null); requestAnimationFrame(() => composerTrigger.current?.focus()); };

  useGSAP(() => {
    gsap.from('.feed-intro > *', { y: 28, opacity: 0, duration: .85, stagger: .11, ease: 'power3.out' });
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
            <article className="discover-feature group" role="link" tabIndex="0" aria-label={`Watch ${discoverPosts[0].title}`} onClick={() => openPost(discoverPosts[0].id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openPost(discoverPosts[0].id); } }}><img src={discoverPosts[0].image} alt={discoverPosts[0].title}/><div><span><Play size={13} fill="currentColor"/> Watch now</span><h2>{discoverPosts[0].title}</h2><p>{discoverPosts[0].description}</p>{discoverPosts[0].description?.length > 160 && <button type="button" onClick={(event) => { event.stopPropagation(); openPost(discoverPosts[0].id); }}>See more</button>}</div></article>
            <article className="discover-note"><span>Today&apos;s mood</span><b>Bright,<br/>fresh,<br/>uncomplicated.</b><small>Curated for your table</small></article>
            <article className="discover-feature discover-feature--small group" role="link" tabIndex="0" aria-label={`Read ${discoverPosts[1].title}`} onClick={() => openPost(discoverPosts[1].id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openPost(discoverPosts[1].id); } }}><img src={discoverPosts[1].image} alt={discoverPosts[1].title}/><div><span>READ &amp; SAVE</span><h2>{discoverPosts[1].title}</h2></div></article>
          </section>}
          <div className="feed-stream-heading"><div><span>The community stream</span><h2>What&apos;s nourishing people now</h2></div></div>
          <CommunityComposer onOpen={openComposer} profile={profile}/>
          <CommunityFilters filters={filters} active={filter} onChange={setFilter}/>
           {loading ? <div className="feed-skeleton-list" role="status" aria-label="Loading community posts" aria-busy="true">
            {Array.from({ length: 3 }, (_, index) => <FeedPostSkeleton key={index}/>)}
           </div> : error && !posts.length ? <p className="content-status content-status--error">{error}</p> : visiblePosts.length ? visiblePosts.map((post) => <CommunityPostCard key={postKey(post)} post={post} profile={profile} routeDetail onOpenPost={openPost}/>) : <div className="empty-results">No posts match that filter yet.</div>}
          {!loading && <div ref={loadMoreTrigger} className="feed-load-more" aria-live="polite">
            {loadingMore && <div className="feed-skeleton-more" role="status" aria-label="Loading more community posts" aria-busy="true">
              {Array.from({ length: 2 }, (_, index) => <FeedPostSkeleton key={index}/>)}
            </div>}
            {error && posts.length > 0 && <span className="content-status--error">{error}</span>}
          </div>}
        </main>
        <CommunityRightRail/>
      </div>
    </MemberPageLayout>
    <ChatbotWidget/>
    {composerType && <CreateBlogPage modal defaultType={composerType} onClose={closeComposer}/>}
  </>;
}
