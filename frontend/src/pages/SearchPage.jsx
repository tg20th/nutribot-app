import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowRight, BookOpen, Eye, LoaderCircle, Play, Search, SlidersHorizontal, Sparkles, Video, X } from 'lucide-react';
import CommunitySideNav from '../components/community/CommunitySideNav';
import CommunityTopBar from '../components/community/CommunityTopBar';
import { getCategories, searchContent } from '../services/searchApi';
import { getCurrentUserFromToken } from '../utils/auth';
import freshProduce from '../assets/fresh-produce.jpg';
import heroBowl from '../assets/hero-bowl.jpg';
import '../styles/search.css';

gsap.registerPlugin(ScrollTrigger);

const TYPES = [
  { value: '', label: 'Tất cả', description: 'Blog và video', icon: Sparkles },
  { value: 'BLOG', label: 'Bài viết', description: 'Kiến thức dễ áp dụng', icon: BookOpen },
  { value: 'VIDEO', label: 'Video', description: 'Xem và nấu cùng', icon: Video }
];
const SUGGESTIONS = ['Bữa sáng giàu đạm', 'Món chay', 'Ăn lành mạnh', 'Bữa tối 20 phút'];

const normalizeItem = (item, selectedType) => ({
  ...item,
  id: item.contentId ?? item.id,
  type: item.contentType ?? item.type ?? selectedType,
  title: item.title || 'Nội dung từ NutriBot',
  thumbnailUrl: item.thumbnailUrl ?? item.imageUrl ?? item.image,
  authorName: item.authorName ?? item.author?.fullName ?? 'NutriBot',
  viewCount: item.viewCount ?? item.views ?? 0,
  createdAt: item.createdAt ?? item.created_at
});

function PublicSearchNav() {
  return <header className="public-search-nav">
    <Link to="/" className="public-search-brand" aria-label="Về trang chủ NutriBot"><span>Nutri</span>Bot<small>Good Food. Brighter You.</small></Link>
    <nav aria-label="Điều hướng công khai"><Link to="/">Khám phá</Link><a href="#search-results">Bài viết &amp; video</a></nav>
    <div><Link to="/login" className="public-search-login">Đăng nhập</Link><Link to="/register" className="public-search-signup">Tạo tài khoản</Link></div>
  </header>;
}

function ResultCard({ item, index, isMember, onPreview }) {
  const isVideo = item.type === 'VIDEO';
  const date = item.createdAt ? new Date(item.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Mới cập nhật';
  const content = <>
    <div className="search-result-media">
      <img src={item.thumbnailUrl || heroBowl} alt="" loading="lazy" />
      <span className="search-result-kind">{isVideo ? <Play size={12} fill="currentColor" /> : <BookOpen size={12} />}{isVideo ? 'Video' : item.type === 'BLOG' ? 'Bài viết' : 'Nội dung'}</span>
      <span className="search-result-arrow"><ArrowRight size={17} /></span>
    </div>
    <div className="search-result-copy">
      <div><span>{item.authorName}</span><span>{date}</span></div>
      <h3>{item.title}</h3>
      <p><Eye size={13} /> {Number(item.viewCount).toLocaleString('vi-VN')} lượt xem</p>
    </div>
  </>;
  return <article className={`search-result-card search-result-card--${index % 6}`}>
    {isMember ? <Link to={`/community/posts/${item.id}`} aria-label={`Mở ${item.title}`}>{content}</Link> : <button type="button" onClick={() => onPreview(item)} aria-label={`Xem trước ${item.title}`}>{content}</button>}
  </article>;
}

function PreviewDialog({ item, onClose }) {
  if (!item) return null;
  return <div className="search-preview-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="search-preview" role="dialog" aria-modal="true" aria-labelledby="preview-title" onMouseDown={(event) => event.stopPropagation()}>
      <button type="button" className="search-preview-close" onClick={onClose} aria-label="Đóng xem trước"><X /></button>
      <img src={item.thumbnailUrl || heroBowl} alt="" />
      <div><span>Nội dung công khai từ NutriBot</span><h2 id="preview-title">{item.title}</h2><p>Tạo tài khoản miễn phí để đọc toàn bộ nội dung, lưu bài yêu thích và nhận gợi ý phù hợp với mục tiêu của bạn.</p><div><Link to="/register">Tạo tài khoản <ArrowRight size={16} /></Link><Link to="/login">Đã có tài khoản</Link></div></div>
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
      if (fetchError.name !== 'AbortError') { setError('Chưa thể tải kết quả. Vui lòng kiểm tra kết nối và thử lại.'); if (!append) setResults([]); }
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
    gsap.from('.search-hero-copy > *', { y: 24, opacity: 0, duration: .75, stagger: .08, ease: 'power3.out' });
    gsap.utils.toArray('.search-result-card').forEach((card) => gsap.fromTo(card, { scale: .88, opacity: .25 }, { scale: 1, opacity: 1, ease: 'none', scrollTrigger: { trigger: card, start: 'top 96%', end: 'top 62%', scrub: .5 } }));
  }, { scope: pageRef, dependencies: [results.length] });

  useEffect(() => { if (!preview) return undefined; const close = (event) => { if (event.key === 'Escape') setPreview(null); }; window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close); }, [preview]);

  const sortedResults = useMemo(() => [...results].sort((a, b) => {
    if (sort === 'popular') return Number(b.viewCount) - Number(a.viewCount);
    const first = new Date(a.createdAt || 0).getTime(); const second = new Date(b.createdAt || 0).getTime();
    return sort === 'oldest' ? first - second : second - first;
  }), [results, sort]);

  const updateParams = (changes) => { const next = new URLSearchParams(searchParams); Object.entries(changes).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key)); setSearchParams(next); };
  const submitSearch = (event) => { event.preventDefault(); updateParams({ q: draft.trim() }); };
  const activeCategory = categories.find((category) => String(category.categoryId ?? category.id) === categoryId);

  return <main className="search-experience" ref={pageRef}>
    <section className="search-hero" aria-labelledby="search-title">
      <div className="search-hero-copy">
        <span className="search-eyebrow">Thư viện dinh dưỡng mở</span>
        <h1 id="search-title">Tìm điều tốt lành <i style={{ backgroundImage: `url(${freshProduce})` }} /> cho bữa ăn hôm nay.</h1>
        <p>Khám phá bài viết và video đã được cộng đồng NutriBot chia sẻ. Không cần tài khoản để bắt đầu tìm kiếm.</p>
        <form className="search-main-form" onSubmit={submitSearch}><label><span className="sr-only">Từ khóa tìm kiếm</span><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Ví dụ: bữa sáng giàu đạm" />{draft && <button type="button" onClick={() => setDraft('')} aria-label="Xóa từ khóa"><X size={17} /></button>}</label><button type="submit"><Search size={18} /> Tìm kiếm</button></form>
      </div>
      <div className="search-hero-art" aria-hidden="true"><img src={heroBowl} alt="" /><span><b>{meta.totalElements.toLocaleString('vi-VN')}</b> nội dung đang chờ bạn khám phá</span></div>
    </section>

    <div className="search-suggestion-marquee" aria-label="Gợi ý tìm kiếm"><div>{[...SUGGESTIONS, ...SUGGESTIONS].map((suggestion, index) => <button type="button" key={`${suggestion}-${index}`} onClick={() => { setDraft(suggestion); updateParams({ q: suggestion }); }}>{suggestion}<ArrowRight size={14} /></button>)}</div></div>

    <section className="search-controls" aria-label="Bộ lọc tìm kiếm">
      <div className="search-type-accordion">{TYPES.map(({ value, label, description, icon: Icon }) => <button type="button" key={label} className={contentType === value ? 'is-active' : ''} onClick={() => updateParams({ type: value })}><Icon size={19} /><span><b>{label}</b><small>{description}</small></span></button>)}</div>
      <button type="button" className={`search-filter-trigger${filtersOpen ? ' is-active' : ''}`} onClick={() => setFiltersOpen((open) => !open)}><SlidersHorizontal size={17} /> Danh mục {activeCategory && <span>1</span>}</button>
      <label className="search-sort-control">Sắp xếp<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="newest">Mới nhất</option><option value="popular">Xem nhiều nhất</option><option value="oldest">Cũ nhất</option></select></label>
      {filtersOpen && <div className="search-category-panel"><button type="button" className={!categoryId ? 'is-active' : ''} onClick={() => updateParams({ category: '' })}>Tất cả danh mục</button>{categories.map((category) => { const id = String(category.categoryId ?? category.id); return <button type="button" key={id} className={categoryId === id ? 'is-active' : ''} onClick={() => updateParams({ category: id })}>{category.name}</button>; })}</div>}
    </section>

    <section className="search-results" id="search-results" aria-live="polite">
      <header><div><span>{query ? `Kết quả cho “${query}”` : 'Khám phá nội dung mới'}</span><h2>{loading ? 'Đang tìm trong thư viện...' : `${meta.totalElements.toLocaleString('vi-VN')} kết quả phù hợp`}</h2></div>{(query || contentType || categoryId) && <button type="button" onClick={() => { setDraft(''); setSearchParams({}); }}>Xóa toàn bộ bộ lọc <X size={15} /></button>}</header>
      {loading ? <div className="search-state"><LoaderCircle className="search-spinner" /><p>Đang chuẩn bị những nội dung phù hợp...</p></div> : error ? <div className="search-state search-state--error"><p>{error}</p><button type="button" onClick={() => fetchPage(0)}>Thử lại</button></div> : sortedResults.length ? <div className="search-results-grid">{sortedResults.map((item, index) => <ResultCard key={`${item.id}-${index}`} item={item} index={index} isMember={isMember} onPreview={setPreview} />)}</div> : <div className="search-empty"><Search size={34} /><h3>Chưa tìm thấy nội dung phù hợp</h3><p>Thử một từ khóa ngắn hơn hoặc chọn lại loại nội dung.</p><button type="button" onClick={() => { setDraft(''); setSearchParams({}); }}>Xem tất cả nội dung</button></div>}
      {meta.page < meta.totalPages - 1 && <div className="search-load-more" ref={loadMoreRef}>{loadingMore && <LoaderCircle className="search-spinner" />}</div>}
    </section>

    {!isMember && <section className="search-guest-cta"><div><span>Biến cảm hứng thành thói quen</span><h2>Lưu món ngon. Xây thực đơn. Hiểu cơ thể mình hơn.</h2></div><Link to="/register">Bắt đầu miễn phí <ArrowRight size={18} /></Link></section>}
    {!isMember && <footer className="search-footer"><Link to="/">NutriBot</Link><span>Nội dung dinh dưỡng dễ hiểu cho mỗi ngày.</span><span>© 2026 NutriBot</span></footer>}
    <PreviewDialog item={preview} onClose={() => setPreview(null)} />
  </main>;
}

export default function SearchPage() {
  const isMember = Boolean(getCurrentUserFromToken());
  if (!isMember) return <div className="search-page search-page--public"><PublicSearchNav /><SearchExperience isMember={false} /></div>;
  return <div className="community-page search-page search-page--member"><CommunityTopBar hideSearch activePath="/search" /><div className="community-shell"><CommunitySideNav activePath="/search" /><span className="community-sidenav-spacer" aria-hidden="true" /><SearchExperience isMember /></div></div>;
}
