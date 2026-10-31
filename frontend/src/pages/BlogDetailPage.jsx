import { Fragment, createElement, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, BookOpen, CalendarDays, Clock3, Eye, ImageOff, ListOrdered, Sparkles, UsersRound, UtensilsCrossed } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { getPublishedBlog } from '../services/publicBlogApi';
import { extractStoryText } from '../utils/content';
import '../styles/public-blogs.css';
import '../styles/public-recipe-detail.css';

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

function parseRecipeBody(rawBody) {
  if (!rawBody || typeof rawBody !== 'string') return null;
  const trimmed = rawBody.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null;
  try {
    const data = JSON.parse(trimmed);
    if (!data || typeof data !== 'object') return null;
    const nutrition = data.nutrition ?? data.details ?? {};
    const ingredients = Array.isArray(data.ingredients) ? data.ingredients : [];
    const steps = Array.isArray(data.steps) ? data.steps : [];
    if (!data.story && !data.description && !ingredients.length && !steps.length && !Object.keys(nutrition).length) return null;
    return {
      story: data.story ?? data.description ?? '',
      prepMinutes: data.prepMinutes ?? data.details?.prepMinutes ?? '',
      cookMinutes: data.cookMinutes ?? data.details?.cookMinutes ?? '',
      servings: data.servings ?? data.details?.servings ?? '',
      nutrition,
      ingredients,
      steps,
    };
  } catch {
    return null;
  }
}

const hasValue = (value) => value !== null && value !== undefined && value !== '';

function RecipeDetail({ recipe }) {
  const nutritionItems = [
    ['Calories', recipe.nutrition.calories, 'kcal'],
    ['Protein', recipe.nutrition.proteinG, 'g'],
    ['Carbs', recipe.nutrition.carbsG, 'g'],
    ['Fat', recipe.nutrition.fatG, 'g'],
    ['Fiber', recipe.nutrition.fiberG, 'g'],
    ['Sodium', recipe.nutrition.sodiumMg, 'mg'],
  ].filter(([, value]) => hasValue(value));
  const facts = [
    ['Prep time', recipe.prepMinutes, 'min', Clock3],
    ['Cook time', recipe.cookMinutes, 'min', Clock3],
    ['Servings', recipe.servings, '', UsersRound],
  ].filter(([, value]) => hasValue(value));

  return <div className="public-recipe-detail">
    {recipe.story && <section className="public-recipe-story"><p>{recipe.story}</p></section>}
    {facts.length > 0 && <section className="public-recipe-facts" aria-label="Recipe facts">
      {facts.map(([label, value, unit, Icon]) => <div key={label}><Icon size={18}/><span>{label}</span><strong>{value}{unit && ` ${unit}`}</strong></div>)}
    </section>}
    {nutritionItems.length > 0 && <section className="public-recipe-nutrition" aria-labelledby="public-recipe-nutrition-title">
      <header><Sparkles size={17}/><div><span>Balanced serving</span><h2 id="public-recipe-nutrition-title">Nutrition at a glance</h2></div></header>
      <div>{nutritionItems.map(([label, value, unit]) => <article key={label}><strong>{value}<small>{unit}</small></strong><span>{label}</span></article>)}</div>
    </section>}
    {(recipe.ingredients.length > 0 || recipe.steps.length > 0) && <div className="public-recipe-content">
      {recipe.ingredients.length > 0 && <section className="public-recipe-ingredients" aria-labelledby="public-recipe-ingredients-title">
        <header><UtensilsCrossed size={18}/><div><span>Shopping list</span><h2 id="public-recipe-ingredients-title">Ingredients</h2></div></header>
        <ul>{recipe.ingredients.map((ingredient, index) => {
          const item = typeof ingredient === 'string' ? { name: ingredient } : ingredient;
          const amount = [item.quantity, item.unit].filter(hasValue).join(' ');
          return <li key={`${item.name ?? item.ingredientName ?? 'ingredient'}-${index}`}><span>{item.name ?? item.ingredientName ?? 'Ingredient'}</span>{amount && <small>{amount}</small>}</li>;
        })}</ul>
      </section>}
      {recipe.steps.length > 0 && <section className="public-recipe-steps" aria-labelledby="public-recipe-steps-title">
        <header><ListOrdered size={18}/><div><span>Make it step by step</span><h2 id="public-recipe-steps-title">Method</h2></div></header>
        <ol>{recipe.steps.map((step, index) => <li key={index}><b>{String(index + 1).padStart(2, '0')}</b><p>{typeof step === 'object' ? step.description ?? step.instruction ?? step.text ?? '' : step}</p></li>)}</ol>
      </section>}
    </div>}
  </div>;
}

export default function BlogDetailPage({ byId = false }) {
  const navigate = useNavigate();
  const { slug, id } = useParams();
  const identifier = byId ? id : slug;
  const [blog, setBlog] = useState(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setBlog(null);
    setError('');
    // The public detail endpoint records a view; delay it so StrictMode can
    // cancel its development-only simulated mount before it reaches the API.
    const timer = window.setTimeout(() => {
      getPublishedBlog(identifier, { byId, signal: controller.signal })
        .then((item) => { if (!controller.signal.aborted) { setBlog(item); setError(''); } })
        .catch((failure) => { if (!controller.signal.aborted) setError(failure.status === 400 || failure.status === 404 ? 'This story is not available.' : failure.message || 'Could not load this story.'); });
    }, 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [identifier, byId, retry]);

  useEffect(() => { window.scrollTo(0, 0); }, [identifier]);

  const openAuth = (mode) => navigate(mode === 'signup' ? '/register' : '/login');
  const recipe = blog ? parseRecipeBody(blog.body) : null;
  return <div className="public-blog-page">
    <Header onAuth={openAuth}/>
    <main className="public-blog-detail">
      {!blog && !error && <p className="public-blog-message" role="status">Loading story...</p>}
      {error && <div className="public-blog-message public-blog-message-error" role="alert"><BookOpen size={32}/><h1>Story unavailable</h1><p>{error}</p><button type="button" onClick={() => { setError(''); setBlog(null); setRetry((value) => value + 1); }}>Try again</button><Link to="/">Return home</Link></div>}
      {blog && <article>
        <header className="public-blog-detail-header">
          <p className="public-blog-eyebrow">THE NUTRIBOT JOURNAL</p>
          <h1>{blog.title}</h1>
          <div className="public-blog-detail-meta"><span>By {blog.authorName || 'NutriBot community'}</span><span><CalendarDays size={16}/><time dateTime={blog.createdAt}>{formatDate(blog.createdAt)}</time></span><span><Eye size={16}/>{blog.viewCount ?? 0} views</span></div>
        </header>
        <div className="public-blog-cover">{blog.thumbnailUrl ? <img src={blog.thumbnailUrl} alt=""/> : <span><ImageOff size={35}/><small>NutriBot Journal</small></span>}</div>
        {recipe
          ? <RecipeDetail recipe={recipe}/>
          : <div className="public-blog-detail-layout"><aside className="public-blog-detail-aside"><span>NutriBot journal</span><p>A little more to read, a little more to share.</p></aside><div className="public-blog-article"><ArticleBody body={extractStoryText(blog.body) || blog.description}/></div></div>}
        <footer className="public-blog-detail-footer"><Link to="/#community">Explore more <ArrowRight size={17}/></Link></footer>
      </article>}
    </main>
    <Footer onAuth={openAuth}/>
  </div>;
}
