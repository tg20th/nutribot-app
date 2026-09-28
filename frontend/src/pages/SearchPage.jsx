import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useNavigationType, useSearchParams } from 'react-router-dom';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowRight, BookOpen, Eye, LoaderCircle, Play, Search, SlidersHorizontal, Sparkles, Video, X } from 'lucide-react';
import CommunitySideNav from '../components/community/CommunitySideNav';
import CommunityTopBar from '../components/community/CommunityTopBar';
import Header from '../components/Header';
import ImageWithFallback from '../components/ImageWithFallback';
import AuthModal from '../components/AuthModal';
import { decodeLegacyText, getCategories, searchContent, searchPublicContent } from '../services/searchApi';
import { googleAuthUrl } from '../services/contentApi';
import '../styles/search.css';

gsap.registerPlugin(ScrollTrigger);

const TYPES = [
  { value: '', label: 'All', description: 'Blogs and videos', icon: Sparkles },
  { value: 'BLOG', label: 'Articles', description: 'Practical nutrition', icon: BookOpen },
  { value: 'VIDEO', label: 'Videos', description: 'Watch and cook', icon: Video }
];
const SUGGESTIONS = ['High-protein breakfast', 'Plant-based meals', 'Healthy eating', '20-minute dinner'];

const normalizeItem = (item, selectedType) => ({
  ...item,
  id: item.contentId ?? item.id,
  type: item.contentType ?? item.type ?? selectedType,
  title: decodeLegacyText(item.title) || 'Content from NutriBot',
  thumbnailUrl: item.thumbnailUrl ?? item.thumbnail_url ?? item.imageUrl ?? item.image_url ?? item.image,
  authorName: decodeLegacyText(item.authorName ?? item.author?.fullName) || 'NutriBot',
  viewCount: item.viewCount ?? item.views ?? 0,
  createdAt: item.createdAt ?? item.created_at
});

const appendUnique = (current, incoming) => {
  const known = new Set(current.map((item) => `${item.type}:${item.id}`));
  return [...current, ...incoming.filter((item) => !known.has(`${item.type}:${item.id}`))];
};

function ResultCard({ item, index, isMember, onPreview, onOpen, returnTo }) {
  const isVideo = item.type === 'VIDEO';
  const date = item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Recently updated';
  const content = <>
    <div className="search-result-media">
      <ImageWithFallback src={item.thumbnailUrl} alt="" loading="lazy" />
      <span className="search-result-kind">{isVideo ? <Play size={12} fill="currentColor" /> : <BookOpen size={12} />}{isVideo ? 'Video' : item.type === 'BLOG' ? 'Article' : 'Content'}</span>
      <span className="search-result-arrow"><ArrowRight size={17} /></span>
    </div>
    <div className="search-result-copy">
      <div><span>{item.authorName}</span><span>{date}</span></div>
      <h3>{item.title}</h3>
      <p><Eye size={13} /> {Number(item.viewCount).toLocaleString('en-US')} views</p>
    </div>
  </>;
  return <article className={`search-result-card search-result-card--${index % 6}`}>
    {isMember ? <Link to={`/community/posts/${item.id}`} state={{ returnTo, restoreSearch: true }} onClick={onOpen} aria-label={`Open ${item.title}`}>{content}</Link> : <button type="button" onClick={() => onPreview(item)} aria-label={`Preview ${item.title}`}>{content}</button>}
  </article>;
}

function PublicResultCard({ item, onPreview }) {
  const isVideo = item.type === 'VIDEO';
  const date = item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-US') : 'Recently updated';
  return <article className="public-result-card">
    <button type="button" onClick={() => onPreview(item)} aria-label={`Preview ${item.title}`}>
      <div className="public-result-image"><ImageWithFallback src={item.thumbnailUrl} alt="" loading="lazy" />{isVideo && <span><Play size={15} fill="currentColor" /></span>}</div>
      <div className="public-result-body"><span>{isVideo ? 'Video' : item.type === 'BLOG' ? 'Article' : 'Content'} · {date}</span><h2>{item.title}</h2><p>{item.authorName} · {Number(item.viewCount).toLocaleString('en-US')} views</p></div>
    </button>
  </article>;
}

function PreviewDialog({ item, onClose, onAuth }) {
  if (!item) return null;
  return <div className="search-preview-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="search-preview" role="dialog" aria-modal="true" aria-labelledby="preview-title" onMouseDown={(event) => event.stopPropagation()}>
      <button type="button" className="search-preview-close" onClick={onClose} aria-label="Close preview"><X /></button>
      <ImageWithFallback src={item.thumbnailUrl} alt="" />
      <div><span>Public content from NutriBot</span><h2 id="preview-title">{item.title}</h2><p>Create a free account to read the full story, save favorites, and receive recommendations tailored to your goals.</p><div><button type="button" onClick={() => onAuth?.('signup')}>Create an account <ArrowRight size={16} /></button><button type="button" onClick={() => onAuth?.('login')}>I already have an account</button></div></div>
    </section>
  </div>;
}

function SearchExperience({ isMember, onAuth }) {
  const location = useLocation();
  const navigationType = useNavigationType();
  const pageRef = useRef(null);
  const loadMoreRef = useRef(null);
  const requestRef = useRef(null);
  const loadingRef = useRef(false);
  const cursorRef = useRef({ page: 0, blogPage: 0, videoPage: 0, last: false });
  const restoredSnapshotRef = useRef(false);
  const pendingScrollRef = useRef(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const contentType = searchParams.get('type') || '';
  const categoryId = searchParams.get('category') || '';
  const [draft, setDraft] = useState(query);
  const [results, setResults] = useState([]);
  const [categories, setCategories] = useState([]);
  const [meta, setMeta] = useState({ totalElements: null, totalPages: 0, page: 0, last: false });
  const sort = searchParams.get('sort') || 'newest';
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const searchStateKey = `nutribot-search-state:${location.pathname}${location.search}`;

  const saveSearchSnapshot = useCallback(() => {
    try {
      sessionStorage.setItem(searchStateKey, JSON.stringify({
        results,
        meta,
        cursor: cursorRef.current,
        hasMore,
        scrollY: window.scrollY
      }));
    } catch {
      // Search remains usable when browser storage is unavailable.
    }
  }, [hasMore, meta, results, searchStateKey]);

  useEffect(() => setDraft(query), [query]);
  useEffect(() => { const controller = new AbortController(); getCategories(controller.signal).then(setCategories).catch(() => setCategories([])); return () => controller.abort(); }, []);

  useEffect(() => {
    restoredSnapshotRef.current = false;
    pendingScrollRef.current = null;
    if (navigationType !== 'POP' && location.state?.restoreSearch !== true) return;
    try {
      const snapshot = JSON.parse(sessionStorage.getItem(searchStateKey) ?? 'null');
      if (!snapshot || !Array.isArray(snapshot.results) || !snapshot.cursor) return;
      requestRef.current?.abort();
      loadingRef.current = false;
      cursorRef.current = snapshot.cursor;
      setResults(snapshot.results);
      setMeta(snapshot.meta ?? { totalElements: null, totalPages: 0, page: 0, last: false });
      setHasMore(Boolean(snapshot.hasMore));
      setLoading(false);
      setLoadingMore(false);
      setError('');
      pendingScrollRef.current = Number(snapshot.scrollY) || 0;
      restoredSnapshotRef.current = true;
    } catch {
      // Fall through to a fresh request when a stored snapshot is invalid.
    }
  }, [navigationType, searchStateKey]);

  const fetchPage = useCallback(async ({ reset = false } = {}) => {
    if (reset) {
      requestRef.current?.abort();
      loadingRef.current = false;
      cursorRef.current = { page: 0, blogPage: 0, videoPage: 0, last: false };
      setResults([]);
      setMeta({ totalElements: null, totalPages: 0, page: 0, last: false });
      setHasMore(false);
    }
    if (loadingRef.current || (!reset && cursorRef.current.last)) return;

    const cursor = cursorRef.current;
    const controller = new AbortController();
    requestRef.current = controller;
    loadingRef.current = true;
    const append = !reset;
    append ? setLoadingMore(true) : setLoading(true);
    setError('');
    try {
      const searchArgs = {
        keyword: query,
        contentType,
        categoryId: categoryId ? Number(categoryId) : undefined,
        page: cursor.page,
        blogPage: cursor.blogPage,
        videoPage: cursor.videoPage,
        size: 12,
        signal: controller.signal
      };
      let response;
      if (!isMember) {
        response = await searchPublicContent(searchArgs);
      } else {
        try {
          response = await searchContent(searchArgs);
        } catch (searchError) {
          if (searchError.name === 'AbortError') throw searchError;
          response = await searchPublicContent(searchArgs);
        }
      }
      const incoming = response.items.map((item) => normalizeItem(item, contentType));
      if (requestRef.current !== controller || controller.signal.aborted) return;
      setResults((current) => append ? appendUnique(current, incoming) : appendUnique([], incoming));
      setMeta(response.meta);
      const last = response.meta.last === true;
      cursorRef.current = response.meta.source === 'public'
        ? {
            page: (response.meta.page ?? cursor.page) + 1,
            blogPage: response.meta.blogLast ? cursor.blogPage : cursor.blogPage + 1,
            videoPage: response.meta.videoLast ? cursor.videoPage : cursor.videoPage + 1,
            last
          }
        : { page: Number(response.meta.page ?? cursor.page) + 1, blogPage: 0, videoPage: 0, last };
      setHasMore(!last);
    } catch (fetchError) {
      if (fetchError.name !== 'AbortError' && requestRef.current === controller) { setError('We could not load the results. Check your connection and try again.'); if (!append) setResults([]); }
    } finally {
      if (requestRef.current === controller) {
        loadingRef.current = false;
        if (!controller.signal.aborted) { setLoading(false); setLoadingMore(false); }
      }
    }
  }, [categoryId, contentType, isMember, query]);

  useEffect(() => {
    if (restoredSnapshotRef.current) {
      restoredSnapshotRef.current = false;
      return undefined;
    }
    fetchPage({ reset: true });
    return () => requestRef.current?.abort();
  }, [fetchPage, searchStateKey]);
  useEffect(() => {
    if (loading || loadingMore || !hasMore) return undefined;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) fetchPage(); }, { rootMargin: '240px' });
    if (loadMoreRef.current) observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [fetchPage, hasMore, loading, loadingMore]);

  useEffect(() => {
    if (pendingScrollRef.current == null || loading) return;
    const scrollY = pendingScrollRef.current;
    const frame = requestAnimationFrame(() => window.scrollTo({ top: scrollY, behavior: 'auto' }));
    pendingScrollRef.current = null;
    return () => cancelAnimationFrame(frame);
  }, [loading, results.length]);

  useGSAP(() => {
    gsap.utils.toArray('.search-result-card').forEach((card) => gsap.fromTo(card, { scale: .88, opacity: .25 }, { scale: 1, opacity: 1, ease: 'none', scrollTrigger: { trigger: card, start: 'top 96%', end: 'top 62%', scrub: .5 } }));
  }, { scope: pageRef, dependencies: [results.length], revertOnUpdate: true });

  useEffect(() => { if (!preview) return undefined; const close = (event) => { if (event.key === 'Escape') setPreview(null); }; window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close); }, [preview]);

  const sortedResults = useMemo(() => [...results].sort((a, b) => {
    if (sort === 'popular') return Number(b.viewCount) - Number(a.viewCount);
    const first = new Date(a.createdAt || 0).getTime(); const second = new Date(b.createdAt || 0).getTime();
    return sort === 'oldest' ? first - second : second - first;
  }), [results, sort]);

  const resultCount = Number.isFinite(meta.totalElements) ? meta.totalElements.toLocaleString('en-US') : null;

  const updateParams = (changes) => { const next = new URLSearchParams(searchParams); Object.entries(changes).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key)); setSearchParams(next); };
  const submitSearch = (event) => { event.preventDefault(); updateParams({ q: draft.trim() }); };
  const activeCategory = categories.find((category) => String(category.categoryId ?? category.id) === categoryId);
  const returnTo = `${location.pathname}${location.search}`;

  if (!isMember) return <main className="public-search-main" ref={pageRef}>
    <section className="public-search-intro" aria-labelledby="public-search-title">
      <h1 id="public-search-title">Search content</h1>
      <p>Find nutrition articles and videos available on NutriBot.</p>
      <form className="public-search-form" onSubmit={submitSearch}>
        <Search size={19} aria-hidden="true" />
        <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Enter a keyword..." aria-label="Search keyword" autoFocus />
        {draft && <button type="button" className="public-search-clear" onClick={() => setDraft('')} aria-label="Clear keyword"><X size={17} /></button>}
        <button type="submit" className="public-search-submit">Search</button>
      </form>
    </section>

    <section className="public-search-filters" aria-label="Search filters">
      <div className="public-type-tabs">{TYPES.map(({ value, label }) => <button type="button" key={label} className={contentType === value ? 'is-active' : ''} onClick={() => updateParams({ type: value })}>{label}</button>)}</div>
      <label>Category<select value={categoryId} onChange={(event) => updateParams({ category: event.target.value })}><option value="">All</option>{categories.map((category) => { const id = String(category.categoryId ?? category.id); return <option value={id} key={id}>{category.name}</option>; })}</select></label>
      <label>Sort by<select value={sort} onChange={(event) => updateParams({ sort: event.target.value === 'newest' ? '' : event.target.value })}><option value="newest">Newest</option><option value="popular">Most viewed</option><option value="oldest">Oldest</option></select></label>
    </section>

    <section className="public-search-results" id="search-results" aria-live="polite">
      <header><h2>{query ? `Results for “${query}”` : 'All content'}</h2>{!loading && resultCount && <span>{resultCount} results</span>}</header>
      {loading ? <div className="search-state"><LoaderCircle className="search-spinner" /><p>Searching...</p></div> : error ? <div className="search-state search-state--error"><p>{error}</p><button type="button" onClick={() => fetchPage({ reset: true })}>Try again</button></div> : sortedResults.length ? <div className="public-results-grid">{sortedResults.map((item, index) => <PublicResultCard key={`${item.id}-${index}`} item={item} onPreview={setPreview} />)}</div> : <div className="search-empty"><Search size={30} /><h3>No content found</h3><p>Try another keyword or clear the current filters.</p><button type="button" onClick={() => { setDraft(''); setSearchParams({}); }}>View all</button></div>}
      {hasMore && <div className="search-load-more" ref={loadMoreRef}>{loadingMore && <LoaderCircle className="search-spinner" />}</div>}
    </section>
    <PreviewDialog item={preview} onClose={() => setPreview(null)} onAuth={(mode) => { setPreview(null); onAuth?.(mode); }} />
  </main>;

  return <main className="search-experience search-experience--member" ref={pageRef}>
    <section className="member-search-header" aria-labelledby="search-title">
      <div><span className="search-eyebrow">Nutrition library</span><h1 id="search-title">Find the nutrition content you need.</h1><p>Search articles and videos, then narrow results with simple filters.</p></div>
      <form className="search-main-form" onSubmit={submitSearch}><label><span className="sr-only">Search keyword</span><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Try: high-protein breakfast" />{draft && <button type="button" onClick={() => setDraft('')} aria-label="Clear keyword"><X size={17} /></button>}</label><button type="submit"><Search size={18} /> Search</button></form>
    </section>

    <div className="member-search-suggestions" aria-label="Search suggestions">{SUGGESTIONS.map((suggestion) => <button type="button" key={suggestion} onClick={() => setDraft(suggestion)}>{suggestion}<ArrowRight size={14} /></button>)}</div>

    <section className="search-controls" aria-label="Search filters">
      <div className="search-type-accordion">{TYPES.map(({ value, label, description, icon: Icon }) => <button type="button" key={label} className={contentType === value ? 'is-active' : ''} onClick={() => updateParams({ type: value })}><Icon size={19} /><span><b>{label}</b><small>{description}</small></span></button>)}</div>
      <button type="button" className={`search-filter-trigger${filtersOpen ? ' is-active' : ''}`} onClick={() => setFiltersOpen((open) => !open)}><SlidersHorizontal size={17} /> Categories {activeCategory && <span>1</span>}</button>
      <label className="search-sort-control">Sort by<select value={sort} onChange={(event) => updateParams({ sort: event.target.value === 'newest' ? '' : event.target.value })}><option value="newest">Newest</option><option value="popular">Most viewed</option><option value="oldest">Oldest</option></select></label>
      {filtersOpen && <div className="search-category-panel"><button type="button" className={!categoryId ? 'is-active' : ''} onClick={() => updateParams({ category: '' })}>All categories</button>{categories.map((category) => { const id = String(category.categoryId ?? category.id); return <button type="button" key={id} className={categoryId === id ? 'is-active' : ''} onClick={() => updateParams({ category: id })}>{category.name}</button>; })}</div>}
    </section>

    <section className="search-results" id="search-results" aria-live="polite">
      <header><div><span>{query ? `Results for “${query}”` : 'Discover new content'}</span><h2>{loading ? 'Searching the library...' : resultCount ? `${resultCount} matching results` : 'Matching results'}</h2></div>{(query || contentType || categoryId) && <button type="button" onClick={() => { setDraft(''); setSearchParams({}); }}>Clear all filters <X size={15} /></button>}</header>
      {loading ? <div className="search-state"><LoaderCircle className="search-spinner" /><p>Finding the right content...</p></div> : error ? <div className="search-state search-state--error"><p>{error}</p><button type="button" onClick={() => fetchPage({ reset: true })}>Try again</button></div> : sortedResults.length ? <div className="search-results-grid">{sortedResults.map((item, index) => <ResultCard key={`${item.id}-${index}`} item={item} index={index} isMember={isMember} onPreview={setPreview} onOpen={saveSearchSnapshot} returnTo={returnTo} />)}</div> : <div className="search-empty"><Search size={34} /><h3>No matching content found</h3><p>Try a shorter keyword or choose another content type.</p><button type="button" onClick={() => { setDraft(''); setSearchParams({}); }}>View all content</button></div>}
      {hasMore && <div className="search-load-more" ref={loadMoreRef}>{loadingMore && <LoaderCircle className="search-spinner" />}</div>}
    </section>

    <PreviewDialog item={preview} onClose={() => setPreview(null)} />
  </main>;
}

export default function SearchPage({ member = false }) {
  const navigate = useNavigate();
  const [authMode, setAuthMode] = useState(null);
  if (!member) return <div className="search-page search-page--public"><Header onAuth={setAuthMode} /><SearchExperience isMember={false} onAuth={setAuthMode} />{authMode && <AuthModal mode={authMode} onClose={() => setAuthMode(null)} onSubmit={(_, mode) => setAuthMode(mode)} onAuthenticated={() => navigate('/home')} onGoogle={() => window.location.assign(googleAuthUrl())} />}</div>;
  return <div className="community-page search-page search-page--member"><CommunityTopBar hideSearch activePath="/community/search" /><div className="community-shell"><CommunitySideNav activePath="/community/search" /><span className="community-sidenav-spacer" aria-hidden="true" /><SearchExperience isMember /></div></div>;
}
