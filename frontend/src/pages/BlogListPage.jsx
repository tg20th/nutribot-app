import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpen, ChevronLeft, ChevronRight, Eye, ImageOff } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { blogHref, getPublishedBlogs } from '../services/publicBlogApi';
import '../styles/public-blogs.css';

const PAGE_SIZE = 9;

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

export default function BlogListPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const requestedPage = Number(params.get('page'));
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setResult(null);
    setError('');
    getPublishedBlogs(page - 1, PAGE_SIZE, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        if (data.totalPages > 0 && page > data.totalPages) {
          setParams((current) => { const next = new URLSearchParams(current); next.set('page', String(data.totalPages)); return next; }, { replace: true });
          return;
        }
        setResult(data);
        setError('');
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setError(failure.message || 'Could not load blogs.');
      });
    return () => controller.abort();
  }, [page, retry, setParams]);

  useEffect(() => { window.scrollTo(0, 0); }, [page]);

  const preview = params.get('preview') === '1';
  const pageHref = (number) => `/blogs?${new URLSearchParams({ ...(number > 1 ? { page: String(number) } : {}), ...(preview ? { preview: '1' } : {}) })}`.replace(/\?$/, '');
  const openAuth = (mode) => navigate(mode === 'signup' ? '/register' : '/login');

  return <div className="public-blog-page">
    <Header onAuth={openAuth}/>
    <main>
      <section className="public-blog-intro">
        <div className="public-blog-intro-inner">
          <Link className="public-blog-back" to="/"><ArrowLeft size={16}/> Home</Link>
          <p className="public-blog-eyebrow">THE NUTRIBOT JOURNAL</p>
          <h1>Stories worth<br/><em>coming back to.</em></h1>
          <p>Recipes, practical ideas, and everyday notes from our community.</p>
          <span className="public-blog-intro-icon" aria-hidden="true"><BookOpen size={42} strokeWidth={1.4}/></span>
        </div>
      </section>

      <section className="public-blog-list" aria-labelledby="public-blog-list-title">
        <div className="public-blog-list-heading">
          <div><p className="public-blog-eyebrow">EXPLORE THE JOURNAL</p><h2 id="public-blog-list-title">All blog stories</h2></div>
          {result && <span>{result.totalElements} {result.totalElements === 1 ? 'story' : 'stories'}</span>}
        </div>

        {!result && !error && <p className="public-blog-message" role="status">Loading stories...</p>}
        {error && <div className="public-blog-message public-blog-message-error" role="alert"><p>{error}</p><button type="button" onClick={() => { setError(''); setResult(null); setRetry((value) => value + 1); }}>Try again</button></div>}
        {result?.content.length === 0 && <p className="public-blog-message">No published blog stories yet.</p>}
        {!!result?.content.length && <div className="public-blog-grid">
          {result.content.map((blog) => <article className="public-blog-card" key={blog.contentId}>
            <Link className="public-blog-card-image" to={blogHref(blog)} aria-label={`Read ${blog.title}`}>
              {blog.thumbnailUrl ? <img src={blog.thumbnailUrl} alt="" loading="lazy"/> : <span><ImageOff size={29}/><small>NutriBot Journal</small></span>}
            </Link>
            <div className="public-blog-card-content">
              <p className="public-blog-card-meta"><span>BLOG STORY</span><time dateTime={blog.createdAt}>{formatDate(blog.createdAt)}</time></p>
              <h3><Link to={blogHref(blog)}>{blog.title}</Link></h3>
              <div className="public-blog-card-footer"><span>By {blog.authorName || 'NutriBot community'}</span><span><Eye size={15}/> {blog.viewCount ?? 0}</span></div>
              <Link className="public-blog-read" to={blogHref(blog)}>Read story <ArrowRight size={16}/></Link>
            </div>
          </article>)}
        </div>}

        {result?.totalPages > 1 && <nav className="public-blog-pagination" aria-label="Blog pages">
          {page <= 1 ? <span className="is-disabled"><ChevronLeft size={17}/> Previous</span> : <Link to={pageHref(page - 1)}><ChevronLeft size={17}/> Previous</Link>}
          <span>Page {page} of {result.totalPages}</span>
          {page >= result.totalPages ? <span className="is-disabled">Next <ChevronRight size={17}/></span> : <Link to={pageHref(page + 1)}>Next <ChevronRight size={17}/></Link>}
        </nav>}
      </section>
    </main>
    <Footer onAuth={openAuth}/>
  </div>;
}
