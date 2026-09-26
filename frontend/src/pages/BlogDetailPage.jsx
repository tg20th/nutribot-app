import { Fragment, createElement, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpen, CalendarDays, Eye, ImageOff } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { getPublishedBlog } from '../services/publicBlogApi';
import '../styles/public-blogs.css';

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

function inline(text) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={index}>{part.slice(2, -2)}</strong>
      : <Fragment key={index}>{part}</Fragment>);
}

function renderHtmlNode(node, key) {
  if (node.nodeType === Node.TEXT_NODE) return <Fragment key={key}>{node.textContent}</Fragment>;
  if (node.nodeType !== Node.ELEMENT_NODE) return null;
  const tag = node.tagName.toLowerCase();
  if (['script', 'style', 'iframe', 'object'].includes(tag)) return null;
  const children = [...node.childNodes].map((child, index) => renderHtmlNode(child, index));
  const safeTags = { p: 'p', h1: 'h2', h2: 'h2', h3: 'h3', strong: 'strong', b: 'strong', em: 'em', i: 'em', ul: 'ul', ol: 'ol', li: 'li', blockquote: 'blockquote', br: 'br' };
  if (tag === 'a') {
    const href = node.getAttribute('href');
    if (href && /^(https?:\/\/|\/)/i.test(href)) return createElement('a', { key, href }, children);
  }
  return safeTags[tag] ? createElement(safeTags[tag], { key }, children) : <Fragment key={key}>{children}</Fragment>;
}

function ArticleBody({ body }) {
  if (/<[a-z][\s\S]*>/i.test(body || '')) {
    const document = new DOMParser().parseFromString(body, 'text/html');
    return [...document.body.childNodes].map((node, index) => renderHtmlNode(node, index));
  }
  const lines = String(body || '').replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) { index += 1; continue; }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const Tag = heading[1].length === 1 ? 'h2' : 'h3';
      blocks.push(<Tag key={index}>{inline(heading[2])}</Tag>);
      index += 1;
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        items.push(<li key={index}>{inline(lines[index].trim().replace(/^[-*]\s+/, ''))}</li>);
        index += 1;
      }
      blocks.push(<ul key={`list-${index}`}>{items}</ul>);
      continue;
    }
    const paragraph = [];
    while (index < lines.length && lines[index].trim() && !/^(#{1,3}|[-*])\s+/.test(lines[index].trim())) {
      paragraph.push(<Fragment key={index}>{paragraph.length > 0 && <br/>}{inline(lines[index].trim())}</Fragment>);
      index += 1;
    }
    blocks.push(<p key={`paragraph-${index}`}>{paragraph}</p>);
  }
  return blocks.length ? blocks : <p>This story has no content yet.</p>;
}

export default function BlogDetailPage({ byId = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const { slug, id } = useParams();
  const identifier = byId ? id : slug;
  const [blog, setBlog] = useState(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setBlog(null);
    setError('');
    getPublishedBlog(identifier, { byId, signal: controller.signal })
      .then((item) => { if (!controller.signal.aborted) { setBlog(item); setError(''); } })
      .catch((failure) => { if (!controller.signal.aborted) setError(failure.status === 400 || failure.status === 404 ? 'This story is not available.' : failure.message || 'Could not load this story.'); });
    return () => controller.abort();
  }, [identifier, byId, retry]);

  useEffect(() => { window.scrollTo(0, 0); }, [identifier]);

  const listParams = new URLSearchParams();
  if (import.meta.env.DEV && query.get('preview') === '1') listParams.set('preview', '1');
  const listHref = listParams.size ? `/blogs?${listParams}` : '/blogs';
  const openAuth = (mode) => navigate(mode === 'signup' ? '/register' : '/login');
  return <div className="public-blog-page">
    <Header onAuth={openAuth}/>
    <main className="public-blog-detail">
      <nav className="public-blog-detail-nav" aria-label="Breadcrumb"><Link to="/"><ArrowLeft size={16}/> Home</Link><span>/</span><Link to={listHref}>Blog stories</Link></nav>
      {!blog && !error && <p className="public-blog-message" role="status">Loading story...</p>}
      {error && <div className="public-blog-message public-blog-message-error" role="alert"><BookOpen size={32}/><h1>Story unavailable</h1><p>{error}</p><button type="button" onClick={() => { setError(''); setBlog(null); setRetry((value) => value + 1); }}>Try again</button><Link to={listHref}>Browse all stories</Link></div>}
      {blog && <article>
        <header className="public-blog-detail-header">
          <p className="public-blog-eyebrow">THE NUTRIBOT JOURNAL</p>
          <h1>{blog.title}</h1>
          <div className="public-blog-detail-meta"><span>By {blog.authorName || 'NutriBot community'}</span><span><CalendarDays size={16}/><time dateTime={blog.createdAt}>{formatDate(blog.createdAt)}</time></span><span><Eye size={16}/>{blog.viewCount ?? 0} views</span></div>
        </header>
        <div className="public-blog-cover">{blog.thumbnailUrl ? <img src={blog.thumbnailUrl} alt=""/> : <span><ImageOff size={35}/><small>NutriBot Journal</small></span>}</div>
        <div className="public-blog-detail-layout">
          <aside className="public-blog-detail-aside"><span>01 / JOURNAL</span><p>A little more to read, a little more to share.</p></aside>
          <div className="public-blog-article"><ArticleBody body={blog.body}/></div>
        </div>
        <footer className="public-blog-detail-footer"><Link to={listHref}><ArrowLeft size={17}/> Back to all stories</Link><Link to={listHref}>Explore more <ArrowRight size={17}/></Link></footer>
      </article>}
    </main>
    <Footer onAuth={openAuth}/>
  </div>;
}
