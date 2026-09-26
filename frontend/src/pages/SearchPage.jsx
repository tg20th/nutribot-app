import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowRight, BookOpen, Eye, LoaderCircle, Play, Search, SlidersHorizontal, Sparkles, Video, X } from 'lucide-react';
import CommunitySideNav from '../components/community/CommunitySideNav';
import CommunityTopBar from '../components/community/CommunityTopBar';
import Header from '../components/Header';
import ImageWithFallback from '../components/ImageWithFallback';
import AuthModal from '../components/AuthModal';
import { getCategories, searchContent } from '../services/searchApi';
import { googleAuthUrl } from '../services/contentApi';
import freshProduce from '../assets/fresh-produce.jpg';
import heroBowl from '../assets/hero-bowl.jpg';
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
  title: item.title || 'Content from NutriBot',
  thumbnailUrl: item.thumbnailUrl ?? item.thumbnail_url ?? item.imageUrl ?? item.image_url ?? item.image,
  authorName: item.authorName ?? item.author?.fullName ?? 'NutriBot',
  viewCount: item.viewCount ?? item.views ?? 0,
  createdAt: item.createdAt ?? item.created_at
});

function ResultCard({ item, index, isMember, onPreview }) {
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
    {isMember ? <Link to={`/community/posts/${item.id}`} aria-label={`Open ${item.title}`}>{content}</Link> : <button type="button" onClick={() => onPreview(item)} aria-label={`Preview ${item.title}`}>{content}</button>}
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

function PreviewDialog({ item, onClose }) {
  if (!item) return null;
  return <div className="search-preview-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="search-preview" role="dialog" aria-modal="true" aria-labelledby="preview-title" onMouseDown={(event) => event.stopPropagation()}>
      <button type="button" className="search-preview-close" onClick={onClose} aria-label="Close preview"><X /></button>
      <ImageWithFallback src={item.thumbnailUrl} alt="" />
      <div><span>Public content from NutriBot</span><h2 id="preview-title">{item.title}</h2><p>Create a free account to read the full story, save favorites, and receive recommendations tailored to your goals.</p><div><Link to="/register">Create an account <ArrowRight size={16} /></Link><Link to="/login">I already have an account</Link></div></div>
    </section>
  </div>;
}

function SearchExperience({ isMember }) {
  const pageRef = useRef(null);
  const loadMoreRef = useRef(null);
  const requestRef = useRef(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const contentType = searchParams.get('type') || '';
  const categoryId = searchParams.get('category') || '';
  const [draft, setDraft] = useState(query);
  const [results, setResults] = useState([]);
  const [categories, setCategories] = useState([]);
  const [meta, setMeta] = useState({ totalElements: 0, totalPages: 0, page: 0 });
  const [sort, setSort] = useState('newest');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);

  useEffect(() => setDraft(query), [query]);
  useEffect(() => { const controller = new AbortController(); getCategories(controller.signal).then(setCategories).catch(() => setCategories([])); return () => controller.abort(); }, []);

  const fetchPage = useCallback(async (page = 0, append = false) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    append ? setLoadingMore(true) : setLoading(true);
    setError('');
    try {
      const response = await searchContent({ keyword: query, contentType, categoryId: categoryId ? Number(categoryId) : undefined, page, size: 12, signal: controller.signal });
      const incoming = response.items.map((item) => normalizeItem(item, contentType));
      setResults((current) => append ? [...current, ...incoming] : incoming);
      setMeta(response.meta);
    } catch (fetchError) {
      if (fetchError.name !== 'AbortError') { setError('We could not load the results. Check your connection and try again.'); if (!append) setResults([]); }
    } finally {
      if (!controller.signal.aborted) { setLoading(false); setLoadingMore(false); }
    }
  }, [categoryId, contentType, query]);

  useEffect(() => { fetchPage(0); return () => requestRef.current?.abort(); }, [fetchPage]);
  useEffect(() => {
    if (loading || loadingMore || meta.page >= meta.totalPages - 1) return undefined;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) fetchPage(meta.page + 1, true); }, { rootMargin: '240px' });
    if (loadMoreRef.current) observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [fetchPage, loading, loadingMore, meta.page, meta.totalPages]);

  useGSAP(() => {
    gsap.utils.toArray('.search-result-card').forEach((card) => gsap.fromTo(card, { scale: .88, opacity: .25 }, { scale: 1, opacity: 1, ease: 'none', scrollTrigger: { trigger: card, start: 'top 96%', end: 'top 62%', scrub: .5 } }));
  }, { scope: pageRef, dependencies: [results.length], revertOnUpdate: true });

  useEffect(() => { if (!preview) return undefined; const close = (event) => { if (event.key === 'Escape') setPreview(null); }; window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close); }, [preview]);

  const sortedResults = useMemo(() => [...results].sort((a, b) => {
    if (sort === 'popular') return Number(b.viewCount) - Number(a.viewCount);
    const first = new Date(a.createdAt || 0).getTime(); const second = new Date(b.createdAt || 0).getTime();
    return sort === 'oldest' ? first - second : second - first;
  }), [results, sort]);

  const updateParams = (changes) => { const next = new URLSearchParams(searchParams); Object.entries(changes).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key)); setSearchParams(next); };
  const submitSearch = (event) => { event.preventDefault(); updateParams({ q: draft.trim() }); };
  const activeCategory = categories.find((category) => String(category.categoryId ?? category.id) === categoryId);

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
      <label>Sort by<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="newest">Newest</option><option value="popular">Most viewed</option><option value="oldest">Oldest</option></select></label>
    </section>

    <section className="public-search-results" id="search-results" aria-live="polite">
      <header><h2>{query ? `Results for “${query}”` : 'All content'}</h2>{!loading && <span>{meta.totalElements.toLocaleString('en-US')} results</span>}</header>
      {loading ? <div className="search-state"><LoaderCircle className="search-spinner" /><p>Searching...</p></div> : error ? <div className="search-state search-state--error"><p>{error}</p><button type="button" onClick={() => fetchPage(0)}>Try again</button></div> : sortedResults.length ? <div className="public-results-grid">{sortedResults.map((item, index) => <PublicResultCard key={`${item.id}-${index}`} item={item} onPreview={setPreview} />)}</div> : <div className="search-empty"><Search size={30} /><h3>No content found</h3><p>Try another keyword or clear the current filters.</p><button type="button" onClick={() => { setDraft(''); setSearchParams({}); }}>View all</button></div>}
      {meta.page < meta.totalPages - 1 && <div className="search-load-more" ref={loadMoreRef}>{loadingMore && <LoaderCircle className="search-spinner" />}</div>}
    </section>
    <PreviewDialog item={preview} onClose={() => setPreview(null)} />
  </main>;

  return <main className="search-experience" ref={pageRef}>
    <section className="search-hero" aria-labelledby="search-title">
      <div className="search-hero-copy">
        <span className="search-eyebrow">Your nutrition library</span>
        <h1 id="search-title">Find something nourishing <i style={{ backgroundImage: `url(${freshProduce})` }} /> for today&apos;s table.</h1>
        <p>Explore practical articles and videos shared across the NutriBot community.</p>
        <form className="search-main-form" onSubmit={submitSearch}><label><span className="sr-only">Search keyword</span><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Try: high-protein breakfast" />{draft && <button type="button" onClick={() => setDraft('')} aria-label="Clear keyword"><X size={17} /></button>}</label><button type="submit"><Search size={18} /> Search</button></form>
      </div>
      <div className="search-hero-art" aria-hidden="true"><img src={heroBowl} alt="" /><span><b>{meta.totalElements.toLocaleString('en-US')}</b> ideas ready to explore</span></div>
    </section>

    <div className="search-suggestion-marquee" aria-label="Search suggestions"><div>{[...SUGGESTIONS, ...SUGGESTIONS].map((suggestion, index) => <button type="button" key={`${suggestion}-${index}`} onClick={() => { setDraft(suggestion); updateParams({ q: suggestion }); }}>{suggestion}<ArrowRight size={14} /></button>)}</div></div>

    <section className="search-controls" aria-label="Search filters">
      <div className="search-type-accordion">{TYPES.map(({ value, label, description, icon: Icon }) => <button type="button" key={label} className={contentType === value ? 'is-active' : ''} onClick={() => updateParams({ type: value })}><Icon size={19} /><span><b>{label}</b><small>{description}</small></span></button>)}</div>
      <button type="button" className={`search-filter-trigger${filtersOpen ? ' is-active' : ''}`} onClick={() => setFiltersOpen((open) => !open)}><SlidersHorizontal size={17} /> Categories {activeCategory && <span>1</span>}</button>
      <label className="search-sort-control">Sort by<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="newest">Newest</option><option value="popular">Most viewed</option><option value="oldest">Oldest</option></select></label>
      {filtersOpen && <div className="search-category-panel"><button type="button" className={!categoryId ? 'is-active' : ''} onClick={() => updateParams({ category: '' })}>All categories</button>{categories.map((category) => { const id = String(category.categoryId ?? category.id); return <button type="button" key={id} className={categoryId === id ? 'is-active' : ''} onClick={() => updateParams({ category: id })}>{category.name}</button>; })}</div>}
    </section>

    <section className="search-results" id="search-results" aria-live="polite">
      <header><div><span>{query ? `Results for “${query}”` : 'Discover new content'}</span><h2>{loading ? 'Searching the library...' : `${meta.totalElements.toLocaleString('en-US')} matching results`}</h2></div>{(query || contentType || categoryId) && <button type="button" onClick={() => { setDraft(''); setSearchParams({}); }}>Clear all filters <X size={15} /></button>}</header>
      {loading ? <div className="search-state"><LoaderCircle className="search-spinner" /><p>Finding the right content...</p></div> : error ? <div className="search-state search-state--error"><p>{error}</p><button type="button" onClick={() => fetchPage(0)}>Try again</button></div> : sortedResults.length ? <div className="search-results-grid">{sortedResults.map((item, index) => <ResultCard key={`${item.id}-${index}`} item={item} index={index} isMember={isMember} onPreview={setPreview} />)}</div> : <div className="search-empty"><Search size={34} /><h3>No matching content found</h3><p>Try a shorter keyword or choose another content type.</p><button type="button" onClick={() => { setDraft(''); setSearchParams({}); }}>View all content</button></div>}
      {meta.page < meta.totalPages - 1 && <div className="search-load-more" ref={loadMoreRef}>{loadingMore && <LoaderCircle className="search-spinner" />}</div>}
    </section>

    <PreviewDialog item={preview} onClose={() => setPreview(null)} />
  </main>;
}

export default function SearchPage({ member = false }) {
  const navigate = useNavigate();
  const [authMode, setAuthMode] = useState(null);
  if (!member) return <div className="search-page search-page--public"><Header onAuth={setAuthMode} /><SearchExperience isMember={false} />{authMode && <AuthModal mode={authMode} onClose={() => setAuthMode(null)} onSubmit={(_, mode) => setAuthMode(mode)} onAuthenticated={() => navigate('/home')} onGoogle={() => window.location.assign(googleAuthUrl())} />}</div>;
  return <div className="community-page search-page search-page--member"><CommunityTopBar hideSearch activePath="/community/search" /><div className="community-shell"><CommunitySideNav activePath="/community/search" /><span className="community-sidenav-spacer" aria-hidden="true" /><SearchExperience isMember /></div></div>;
}
