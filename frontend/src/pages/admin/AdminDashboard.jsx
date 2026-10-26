import { ArrowRight, BarChart3, BookOpen, ClipboardCheck, Eye, FileText, FolderTree, Leaf, ListOrdered, Play, Users, UtensilsCrossed, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { adminApi } from '../../services/adminApi';
import { adminIngredientApi } from '../../services/adminIngredientApi';
import { contentRecipeSuggestionsApi } from '../../services/contentRecipeSuggestionsApi';
import { getPost } from '../../services/communityApi';
import CommentSection from '../../components/content/CommentSection';
import { ErrorState, LoadingState } from '../../components/admin/AdminUi';
import fallbackBowl from '../../assets/hero-bowl.jpg';
import fallbackPlate from '../../assets/colorful-plate.jpg';
import fallbackProduce from '../../assets/fresh-produce.jpg';

const trendPeriods = {
  week: { days: 7, buckets: 7, label: '7 days' },
  month: { days: 30, buckets: 10, label: '1 month' },
  quarter: { days: 90, buckets: 10, label: '3 months' },
};
const chartColors = ['#226543', '#82ad69', '#b8d89e', '#4f8962', '#d7e9c8'];
const formatDate = (value) => !value ? 'Recently submitted' : new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
const titleFor = (item) => item?.title ?? item?.contentTitle ?? item?.name ?? 'Untitled content';
const authorFor = (item) => item?.authorName ?? item?.authorUsername ?? item?.author ?? 'Unknown author';
const contentIdFor = (item) => item?.contentId ?? item?.id;
const imageFor = (item, index) => item?.thumbnailUrl ?? item?.imageUrl ?? item?.image ?? [fallbackBowl, fallbackPlate, fallbackProduce][index % 3];
const recipeFor = (article) => {
  const raw = article?.recipe ?? article?.recipeData;
  if (raw && typeof raw === 'object') return raw;
  try { const parsed = JSON.parse(article?.body ?? article?.content ?? '{}'); return parsed && typeof parsed === 'object' ? parsed : {}; } catch { return {}; }
};
const ingredientParts = (ingredient) => {
  if (typeof ingredient === 'string') return { name: ingredient, amount: '' };
  return {
    name: ingredient?.name ?? ingredient?.ingredientName ?? 'Ingredient',
    amount: [ingredient?.quantity ?? ingredient?.amount, ingredient?.unit].filter(Boolean).join(' '),
  };
};

const buildContentTrend = (content, period) => {
  const { days, buckets } = trendPeriods[period];
  const bucketDays = Math.ceil(days / buckets);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(start.getDate() - (days - 1));
  return Array.from({ length: buckets }, (_, index) => {
    const date = new Date(start);
    date.setDate(date.getDate() + (index * bucketDays));
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + bucketDays);
    const label = period === 'week' ? new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(date) : new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(date);
    return { label, total: content.filter((item) => {
      const createdAt = item.createdAt ? new Date(item.createdAt) : null;
      return createdAt && createdAt >= date && createdAt < nextDate;
    }).length };
  });
};

const buildDonut = (categories) => {
  const slices = categories.filter((category) => Number(category.contentCount) > 0).sort((left, right) => Number(right.contentCount) - Number(left.contentCount)).slice(0, 5).map((category, index) => ({ ...category, color: chartColors[index] }));
  const total = slices.reduce((sum, category) => sum + Number(category.contentCount), 0);
  let cursor = 0;
  const stops = slices.map((category) => {
    const start = cursor;
    cursor += (Number(category.contentCount) / total) * 100;
    return category.color + ' ' + start + '% ' + cursor + '%';
  });
  return { slices, total, background: total ? 'conic-gradient(' + stops.join(', ') + ')' : '#e4eee0' };
};

function ContentDialog({ post, detail, loading, onClose }) {
  if (!post) return null;
  const article = detail ?? post;
  const contentId = contentIdFor(post);
  const body = article.body ?? article.content ?? article.description ?? article.excerpt;
  const contentType = article.contentType ?? post.contentType;
  const recipe = recipeFor(article);
  const ingredients = article.ingredients ?? article.pantryItems ?? recipe.ingredients ?? [];
  const steps = article.steps ?? recipe.steps ?? recipe.instructions ?? [];
  return (
    <div className="dashboard-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="dashboard-dialog" role="dialog" aria-modal="true" aria-labelledby="dashboard-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="dashboard-dialog__close" onClick={onClose} aria-label="Close content preview"><X size={19} aria-hidden="true" /></button>
        <div className="dashboard-dialog__body">
          <article className="dashboard-dialog__article">
            <img src={imageFor(article, 0)} alt={titleFor(article)} />
            <span className="dashboard-post-card__type">{contentType === 'VIDEO' ? 'Video' : 'Blog'}</span>
            <h2 id="dashboard-dialog-title">{titleFor(article)}</h2>
            <p className="dashboard-dialog__meta">By {authorFor(article)} · {Number(article.viewCount ?? 0).toLocaleString('en-GB')} views</p>
            {loading ? <p className="dashboard-dialog__loading">Loading recipe details...</p> : <div className="dashboard-recipe-preview"><section><h3><UtensilsCrossed size={17} aria-hidden="true" /> Ingredients ({ingredients.length})</h3>{ingredients.length ? <ul className="dashboard-ingredient-pills">{ingredients.map((ingredient, index) => { const value = ingredientParts(ingredient); return <li key={index}><strong>{value.name}</strong>{value.amount && <span>{value.amount}</span>}</li>; })}</ul> : <p>Ingredient details are not available for this content.</p>}</section><section><h3><ListOrdered size={17} aria-hidden="true" /> Preparation steps ({steps.length})</h3>{steps.length ? <ol className="dashboard-recipe-steps">{steps.map((step, index) => <li key={index}><b>{index + 1}</b><span>{typeof step === 'string' ? step : step?.description ?? step?.text ?? 'Recipe step'}</span></li>)}</ol> : body ? <div className="dashboard-dialog__copy">{body}</div> : <p>Recipe instructions are not available for this content.</p>}</section></div>}
          </article>
          <aside className="dashboard-dialog__comments"><h3>Comments</h3>{contentId ? <CommentSection contentId={contentId} readOnly /> : <p>Comments are unavailable for this item.</p>}</aside>
        </div>
      </section>
    </div>
  );
}

export default function AdminDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState(false);
  const [trendPeriod, setTrendPeriod] = useState('week');
  const [selectedPost, setSelectedPost] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadDashboard = () => {
    const controller = new AbortController();
    setError(false);
    Promise.all([
      adminApi.getDashboard(controller.signal),
      adminIngredientApi.getIngredients({ page: 0, size: 1 }, controller.signal),
      contentRecipeSuggestionsApi.list({ status: 'PENDING', page: 0, size: 5 }, controller.signal),
    ]).then(([result, ingredients, suggestions]) => {
      if (!controller.signal.aborted) setDashboard({
        ...result,
        metrics: { ...result.metrics, totalIngredients: Number(ingredients.totalElements ?? 0), pendingRecipes: Number(suggestions.totalElements ?? 0) }, recipeQueue: suggestions.content ?? [],
      });
    }).catch(() => {
      if (!controller.signal.aborted) setError(true);
    });
    return () => controller.abort();
  };

  useEffect(loadDashboard, []);
  useEffect(() => {
    if (!selectedPost) {
      setSelectedDetail(null);
      return undefined;
    }
    let isCurrent = true;
    setDetailLoading(true);
    setSelectedDetail(null);
    getPost(contentIdFor(selectedPost), undefined, selectedPost.contentType).then((result) => {
      if (isCurrent) setSelectedDetail(result);
    }).catch(() => {
      if (isCurrent) setSelectedDetail(selectedPost);
    }).finally(() => {
      if (isCurrent) setDetailLoading(false);
    });
    return () => { isCurrent = false; };
  }, [selectedPost]);
  useEffect(() => {
    if (!selectedPost) return undefined;
    const closeOnEscape = (event) => { if (event.key === 'Escape') setSelectedPost(null); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [selectedPost]);

  if (!dashboard && !error) return <LoadingState label="Loading platform overview..." />;
  if (error) return <ErrorState onRetry={loadDashboard} />;

  const { metrics, moderationQueue, recipeQueue = [], categories, content } = dashboard;
  const trend = buildContentTrend(content, trendPeriod);
  const trendHigh = Math.max(...trend.map((item) => item.total), 1);
  const linePoints = trend.map((item, index) => {
    const x = trend.length === 1 ? 50 : (index / (trend.length - 1)) * 100;
    return x + ',' + (89 - ((item.total / trendHigh) * 69));
  }).join(' ');
  const topContent = [...content].sort((left, right) => Number(right.viewCount ?? 0) - Number(left.viewCount ?? 0)).slice(0, 3);
  const activeCategories = categories.filter((category) => category.active).length;
  const recipeCategories = categories.filter((category) => category.type === 'RECIPE_TYPE').length;
  const ingredientCategories = categories.filter((category) => category.type === 'FOOD_TYPE').length;
  const donut = buildDonut([
    { id: 'recipes', name: 'Recipe categories', contentCount: recipeCategories },
    { id: 'ingredients', name: 'Ingredient categories', contentCount: ingredientCategories },
  ]);

  return (
    <main className="admin-dashboard">
      <section className="admin-dashboard__overview" aria-label="Platform metrics">
        <header className="admin-dashboard__heading">
          <p>ADMIN OVERVIEW</p><h1>Platform operations</h1>
          <span>Review content, monitor catalogue coverage, and act on the work that needs attention.</span>
        </header>
      </section>
      <section className="admin-dashboard__metrics" aria-label="Platform metrics">
          <Link to="/admin/users" className="dashboard-metric"><Users aria-hidden="true" /><span>MEMBERS</span><strong>{metrics.totalUsers}</strong></Link>
          <Link to="/admin/moderation" className="dashboard-metric"><ClipboardCheck aria-hidden="true" /><span>PENDING CONTENT</span><strong>{metrics.pendingModeration}</strong></Link>
          <Link to="/admin/content-recipe-suggestions" className="dashboard-metric"><BookOpen aria-hidden="true" /><span>PENDING RECIPES</span><strong>{metrics.pendingRecipes}</strong></Link>
          <button type="button" className="dashboard-metric" onClick={() => document.getElementById('content-activity')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}><BarChart3 aria-hidden="true" /><span>PUBLISHED CONTENT</span><strong>{metrics.publishedContent}</strong></button>
          <Link to="/admin/categories" className="dashboard-metric"><FolderTree aria-hidden="true" /><span>ACTIVE CATEGORIES</span><strong>{activeCategories}</strong></Link>
          <Link to="/admin/ingredients" className="dashboard-metric"><Leaf aria-hidden="true" /><span>CATALOG INGREDIENTS</span><strong>{metrics.totalIngredients}</strong></Link>
      </section>

      <section className="admin-dashboard__insights"><article className="dashboard-panel dashboard-panel--top-content"><div className="dashboard-panel__heading"><div><p>POPULAR CONTENT</p><h2>Top 3 trending posts</h2></div></div>{topContent.length ? <div className="dashboard-top-content">{topContent.map((item, index) => <button type="button" onClick={() => setSelectedPost(item)} key={contentIdFor(item) ?? item.title + '-' + index} className="dashboard-post-card"><img src={imageFor(item, index)} alt="" /><div><span className="dashboard-post-card__type">{item.contentType === 'VIDEO' ? <><Play size={12} /> Video</> : <><FileText size={12} /> Blog</>}</span><strong>{titleFor(item)}</strong><small>By {authorFor(item)}</small><em><Eye size={13} /> {Number(item.viewCount ?? 0).toLocaleString('en-GB')} views</em></div></button>)}</div> : <div className="dashboard-empty-copy">There is no published content to rank yet.</div>}</article></section>

      <section className="admin-dashboard__analytics">
        <article id="content-activity" className="dashboard-panel dashboard-panel--trend">
          <div className="dashboard-panel__heading"><div><p>CONTENT ACTIVITY</p><h2>Published over time</h2></div><div className="dashboard-periods" role="group" aria-label="Content activity time range">{Object.entries(trendPeriods).map(([key, value]) => <button type="button" key={key} className={trendPeriod === key ? 'is-active' : ''} onClick={() => setTrendPeriod(key)}>{value.label}</button>)}</div></div>
          <div className="dashboard-bar-chart" aria-label={'Published content over ' + trendPeriods[trendPeriod].label}>
            {trend.map((item) => <div className="dashboard-bar-chart__column" key={item.label}><span>{item.total || ''}</span><i style={{ height: Math.max((item.total / trendHigh) * 100, item.total ? 10 : 2) + '%' }} /><small>{item.label}</small></div>)}
          </div>
        </article>
        <article className="dashboard-panel dashboard-panel--category-chart">
          <div className="dashboard-panel__heading"><div><p>CATEGORY MIX</p><h2>Recipe and ingredient categories</h2></div></div>
          {donut.total ? <div className="dashboard-donut-wrap"><div className="dashboard-donut" style={{ background: donut.background }}><div><strong>{donut.total}</strong><span>posts</span></div></div><ul className="dashboard-donut-legend">{donut.slices.map((category) => <li key={category.id}><i style={{ background: category.color }} /><span>{category.name}</span><strong>{category.contentCount}</strong></li>)}</ul></div> : <div className="dashboard-empty-copy">Publish content with a category to see this chart.</div>}
        </article>
      </section>

      <section className="admin-dashboard__workbench">
        <article className="dashboard-panel dashboard-panel--queue"><div className="dashboard-panel__heading"><div><p>MODERATION QUEUE</p><h2>Needs your review</h2></div><Link to="/admin/moderation" className="dashboard-text-link">View queue <ArrowRight size={15} aria-hidden="true" /></Link></div>{moderationQueue.length ? <ol className="dashboard-queue-list">{moderationQueue.map((item) => <li key={item.type + '-' + item.id}><Link to={'/admin/moderation?selected=' + encodeURIComponent(item.id)}><span className="dashboard-content-icon"><FileText size={18} aria-hidden="true" /></span><div><strong>{item.title}</strong><span>{item.author} · {formatDate(item.submittedAt)}</span></div><span className="dashboard-status">Pending</span></Link></li>)}</ol> : <div className="dashboard-empty-copy">No content is waiting for review.</div>}</article>
      </section>

      <section className="admin-dashboard__recipe-workbench"><article className="dashboard-panel dashboard-panel--recipes"><div className="dashboard-panel__heading"><div><p>RECIPE MODERATION</p><h2>Recipes awaiting review</h2></div></div>{recipeQueue.length ? <ol className="dashboard-recipe-list">{recipeQueue.map((item) => <li key={item.suggestionId}><Link to={'/admin/content-recipe-suggestions?selected=' + encodeURIComponent(item.suggestionId)}><span className="dashboard-content-icon"><BookOpen size={18} aria-hidden="true" /></span><div><strong>{item.dish?.name ?? item.source?.title}</strong><span>{item.source?.authorName ?? 'Community member'} · {formatDate(item.createdAt)}</span></div><span className="dashboard-status">Pending</span></Link></li>)}</ol> : <div className="dashboard-empty-copy">No recipes are waiting for review.</div>}</article></section>

      <ContentDialog post={selectedPost} detail={selectedDetail} loading={detailLoading} onClose={() => setSelectedPost(null)} />
    </main>
  );
}
