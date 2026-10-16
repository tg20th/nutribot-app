import { Check, ChevronLeft, ChevronRight, ExternalLink, Eye, FileText, ListOrdered, MapPin, PlaySquare, Soup, UserRound, UtensilsCrossed, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { EmptyState, ErrorState, LoadingState, Toast } from '../../components/admin/AdminUi';
import { contentRecipeSuggestionsApi } from '../../services/contentRecipeSuggestionsApi';
import { getPost } from '../../services/communityApi';
import '../../styles/admin-content-recipe-suggestions.css';

const pageSize = 10;

const formatDate = (value) => {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(date);
};

const statusLabels = { PENDING: 'Pending', APPROVED: 'Approved', REJECTED: 'Rejected' };
const statusLabel = (status) => statusLabels[status] ?? status ?? 'Pending';

function SuggestionStatus({ status }) {
  const safeStatus = String(status || 'PENDING').toLowerCase();
  return <span className={`recipe-suggestion-status is-${safeStatus}`}>{statusLabel(status)}</span>;
}

function SourceContentLink({ source, onOpenSource }) {
  if (source.url) {
    return <a className="recipe-suggestion-source-link" href={source.url} target="_blank" rel="noreferrer"><ExternalLink size={16} /> Open original content</a>;
  }
  if (!source.contentId) return null;
  return <button type="button" className="recipe-suggestion-source-link" onClick={() => onOpenSource(source)}><Eye size={16} /> Open original content</button>;
}

function NutritionGrid({ nutrition }) {
  const values = [
    ['Calories', nutrition.calories, 'kcal'],
    ['Protein', nutrition.proteinG, 'g'],
    ['Carbs', nutrition.carbsG, 'g'],
    ['Fat', nutrition.fatG, 'g'],
    ['Fiber', nutrition.fiberG, 'g'],
  ].filter(([, value]) => value !== null && value !== undefined && value !== '');
  if (!values.length) return <p className="recipe-suggestion-missing">Nutrition details were not supplied by the server.</p>;
  return <div className="recipe-suggestion-nutrition-grid">{values.map(([label, value, unit]) => <div key={label}><span>{label}</span><strong>{value}<small> {unit}</small></strong></div>)}</div>;
}

function RecipeDetail({ suggestion, showReviewControls, onReview, onOpenSource, submitting }) {
  const { source, dish, recipe, nutrition, ingredients, restaurant } = suggestion;
  const ContentIcon = source.contentType === 'VIDEO' ? PlaySquare : FileText;
  return <article className="recipe-suggestion-detail" aria-label="Suggestion detail">
    <header className="recipe-suggestion-detail-head">
      <div><span>REVIEW DETAIL</span><SuggestionStatus status={suggestion.status} /></div>
      <time dateTime={suggestion.createdAt}>Received {formatDate(suggestion.createdAt)}</time>
    </header>

    <div className="recipe-suggestion-detail-body">
      <section className="recipe-suggestion-source">
        <div className="recipe-suggestion-source-heading"><div className="recipe-suggestion-source-type"><ContentIcon size={18} /><span>{source.contentType === 'VIDEO' ? 'Video source' : 'Blog source'}</span></div><span className="recipe-suggestion-source-caption">Original published content</span></div>
        <h2>{source.title}</h2>
        <div className="recipe-suggestion-source-meta"><span><UserRound size={14} /> {source.authorName}</span><span><Eye size={14} /> {source.viewCount ?? 0} views</span><span>{source.voteCount ?? 0} votes</span></div>
        <SourceContentLink source={source} onOpenSource={onOpenSource} />
      </section>

      <section className="recipe-suggestion-section">
        <div className="recipe-suggestion-section-title"><Soup size={17} /><h3>Proposed dish</h3><span>Catalog candidate</span></div>
        <h4>{dish.name}</h4>
        {dish.description && <p>{dish.description}</p>}
        {dish.servingSize && <small className="recipe-suggestion-serving">Serving: {dish.servingSize}{dish.servingUnit ? ` ${dish.servingUnit}` : ''}</small>}
      </section>

      <section className="recipe-suggestion-section">
        <div className="recipe-suggestion-section-title"><UtensilsCrossed size={17} /><h3>Nutrition</h3></div>
        <NutritionGrid nutrition={nutrition} />
      </section>

      <section className="recipe-suggestion-section">
        <div className="recipe-suggestion-section-title"><UtensilsCrossed size={17} /><h3>Ingredients</h3></div>
        {ingredients.length ? <ul className="recipe-suggestion-ingredients">{ingredients.map((ingredient, index) => <li key={`${ingredient.name}-${index}`}><span>{ingredient.name}</span><small>{[ingredient.quantity, ingredient.unit].filter(Boolean).join(' ') || ingredient.notes || 'Quantity unavailable'}</small></li>)}</ul> : <p className="recipe-suggestion-missing">No ingredients were supplied by the server.</p>}
      </section>

      <section className="recipe-suggestion-section">
        <div className="recipe-suggestion-section-title"><ListOrdered size={17} /><h3>{recipe.title}</h3></div>
        {(recipe.prepTimeMin || recipe.cookTimeMin || recipe.servings) && <div className="recipe-suggestion-recipe-meta">{recipe.prepTimeMin && <span>Prep {recipe.prepTimeMin} min</span>}{recipe.cookTimeMin && <span>Cook {recipe.cookTimeMin} min</span>}{recipe.servings && <span>{recipe.servings} servings</span>}</div>}
        {recipe.description && <p>{recipe.description}</p>}
        {recipe.steps.length ? <ol className="recipe-suggestion-steps">{recipe.steps.map((step, index) => <li key={`${step}-${index}`}>{step}</li>)}</ol> : <p className="recipe-suggestion-missing">No recipe steps were supplied by the server.</p>}
      </section>

      {(restaurant.name || restaurant.address || restaurant.reference) && <section className="recipe-suggestion-restaurant"><MapPin size={17} /><div><h3>Restaurant reference</h3>{restaurant.name && <strong>{restaurant.name}</strong>}{restaurant.address && <p>{restaurant.address}</p>}{restaurant.reference && <a href={restaurant.reference} target="_blank" rel="noreferrer">Open restaurant reference <ExternalLink size={13} /></a>}</div></section>}

      {(suggestion.rejectionReason || suggestion.reviewedAt) && <section className={`recipe-suggestion-review-record is-${String(suggestion.status || '').toLowerCase()}`}>
        <span className="recipe-suggestion-review-record-icon">{suggestion.status === 'REJECTED' ? <X size={16} /> : <Check size={16} />}</span>
        <div><strong>{suggestion.status === 'REJECTED' ? 'Suggestion rejected' : 'Suggestion reviewed'}</strong>{suggestion.rejectionReason && <p>{suggestion.rejectionReason}</p>}</div>
        {suggestion.reviewedAt && <time dateTime={suggestion.reviewedAt}>{formatDate(suggestion.reviewedAt)}{suggestion.reviewerName ? ` by ${suggestion.reviewerName}` : ''}</time>}
      </section>}
      {showReviewControls && suggestion.status === 'PENDING' && <footer className="recipe-suggestion-review-actions"><div><strong>Decision required</strong><span>Approve to import this dish and recipe, or reject with a reason.</span></div><div><button type="button" className="admin-btn secondary recipe-suggestion-reject" disabled={submitting} onClick={() => onReview('REJECT')}><X size={16} /> Reject</button><button type="button" className="admin-btn primary" disabled={submitting} onClick={() => onReview('APPROVE')}><Check size={16} /> Approve suggestion</button></div></footer>}
    </div>
  </article>;
}

function SourceContentFallback({ suggestion }) {
  const { source, dish, ingredients, recipe } = suggestion;
  return <article className="source-content-fallback">
    <div className="source-content-fallback-notice"><strong>Original content is not publicly available.</strong><span>The stored review snapshot is shown below so this suggestion can still be assessed.</span></div>
    <div className="source-content-fallback-heading"><span>{source.contentType === 'VIDEO' ? 'VIDEO SOURCE' : 'BLOG SOURCE'}</span><h3>{source.title}</h3><p>By {source.authorName}</p></div>
    <section><h4>Stored proposal</h4><strong>{dish.name}</strong>{dish.description && <p>{dish.description}</p>}</section>
    {ingredients.length > 0 && <section><h4>Ingredients</h4><ul>{ingredients.map((ingredient, index) => <li key={`${ingredient.name}-${index}`}>{ingredient.name}{[ingredient.quantity, ingredient.unit].filter(Boolean).join(' ') ? ` - ${[ingredient.quantity, ingredient.unit].filter(Boolean).join(' ')}` : ''}</li>)}</ul></section>}
    {recipe.steps.length > 0 && <section><h4>Recipe steps</h4><ol>{recipe.steps.map((step, index) => <li key={`${step}-${index}`}>{step}</li>)}</ol></section>}
  </article>;
}

function SourceContentModal({ open, loading, error, post, fallback, onClose, onRetry }) {
  if (!open) return null;
  const story = String(post?.cleanBody || post?.body || '').trim();
  return <div className="admin-modal-backdrop" onMouseDown={onClose}>
    <section className="admin-dialog source-content-dialog" role="dialog" aria-modal="true" aria-labelledby="source-content-title" onMouseDown={(event) => event.stopPropagation()}>
      <header className="source-content-head">
        <div><p>SOURCE CONTENT</p><h2 id="source-content-title">{post?.title || 'Source content'}</h2></div>
        <button type="button" className="source-content-close" onClick={onClose} aria-label="Close source content"><X size={18} /></button>
      </header>
      {loading ? <div className="source-content-state"><LoadingState /></div>
        : error && error.status === 404 && fallback ? <SourceContentFallback suggestion={fallback} />
          : error ? <div className="source-content-state"><ErrorState onRetry={onRetry} /></div>
          : !post ? <div className="source-content-state"><EmptyState title="Source content is unavailable." text="The article or video could not be loaded from the server." /></div>
            : <article className="source-content-body">
              {post.type === 'video' && post.videoUrl
                ? <video className="source-content-media" controls preload="metadata" src={post.videoUrl} poster={post.image || undefined} />
                : post.image && <img className="source-content-media" src={post.image} alt={post.title} />}
              <div className="source-content-meta">
                <span><UserRound size={14} /> {post.author || 'Unknown author'}</span>
                <span><Eye size={14} /> {post.viewCount ?? 0} views</span>
                {post.createdAt && <time dateTime={post.createdAt}>{formatDate(post.createdAt)}</time>}
              </div>
              <div className="source-content-nutrition">
                <div><strong>{post.calories ?? '—'}<small> kcal</small></strong><span>Calories</span></div>
                <div><strong>{post.protein ?? '—'}<small> g</small></strong><span>Protein</span></div>
                <div><strong>{post.nutrition?.carbs ?? '—'}</strong><span>Carbs</span></div>
                <div><strong>{post.nutrition?.fat ?? '—'}</strong><span>Healthy fats</span></div>
              </div>
              {Array.isArray(post.pantryItems) && post.pantryItems.length > 0 && <section className="source-content-section"><h3>Ingredients</h3><ul>{post.pantryItems.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul></section>}
              {Array.isArray(post.steps) && post.steps.length > 0 && <section className="source-content-section"><h3>Method</h3><ol>{post.steps.map((step, index) => <li key={`${step}-${index}`}>{step}</li>)}</ol></section>}
              {story && <section className="source-content-section"><h3>{post.type === 'video' ? 'About this video' : 'The story'}</h3>{story.split(/\n\n+/).filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</section>}
            </article>}
    </section>
  </div>;
}

export default function AdminContentRecipeSuggestionsPage() {
  const preview = import.meta.env.DEV && new URLSearchParams(window.location.search).get('preview') === '1';
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ content: [], totalElements: 0, totalPages: 0 });
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState(false);
  const [detailError, setDetailError] = useState(false);
  const [detailUnavailable, setDetailUnavailable] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [detailRefresh, setDetailRefresh] = useState(0);
  const [reviewDialog, setReviewDialog] = useState(null);
  const [reviewReason, setReviewReason] = useState('');
  const [reviewError, setReviewError] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [toast, setToast] = useState('');
  const [source, setSource] = useState(null);
  const [sourcePost, setSourcePost] = useState(null);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceError, setSourceError] = useState(null);
  const [sourceRefresh, setSourceRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    contentRecipeSuggestionsApi.list({ status, page: page - 1, size: pageSize }, controller.signal)
      .then((next) => {
        if (controller.signal.aborted) return;
        if (page > 1 && next.totalPages > 0 && page > next.totalPages) {
          setPage(next.totalPages);
          return;
        }
        setResult(next);
        setSelectedId((current) => next.content.some((item) => item.suggestionId === current) ? current : next.content[0]?.suggestionId ?? null);
      })
      .catch(() => { if (!controller.signal.aborted) { setResult({ content: [], totalElements: 0, totalPages: 0 }); setSelectedId(null); setError(true); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page, refreshKey, status]);

  useEffect(() => {
    if (!selectedId) { setDetail(null); setDetailError(false); setDetailUnavailable(false); return undefined; }
    const controller = new AbortController();
    setDetail(null);
    setDetailLoading(true);
    setDetailError(false);
    setDetailUnavailable(false);
    contentRecipeSuggestionsApi.getById(selectedId, controller.signal)
      .then((next) => { if (!controller.signal.aborted) setDetail(next); })
      .catch((requestError) => { if (!controller.signal.aborted) { setDetailUnavailable(requestError?.status === 404); setDetailError(requestError?.status !== 404); } })
      .finally(() => { if (!controller.signal.aborted) setDetailLoading(false); });
    return () => controller.abort();
  }, [detailRefresh, selectedId]);

  useEffect(() => {
    if (!source?.contentId) return undefined;
    const controller = new AbortController();
    setSourcePost(null);
    setSourceLoading(true);
    setSourceError(null);
    getPost(source.contentId, controller.signal, source.contentType)
      .then((next) => { if (!controller.signal.aborted) setSourcePost(next); })
      .catch((requestError) => { if (!controller.signal.aborted && requestError?.name !== 'AbortError') setSourceError(requestError); })
      .finally(() => { if (!controller.signal.aborted) setSourceLoading(false); });
    return () => controller.abort();
  }, [source, sourceRefresh]);

  useEffect(() => {
    if (!source) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') setSource(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [source]);

  const selected = useMemo(() => result.content.find((item) => item.suggestionId === selectedId) ?? null, [result.content, selectedId]);
  const changeStatus = (nextStatus) => { setStatus(nextStatus); setPage(1); setSelectedId(null); };
  const retry = () => setRefreshKey((value) => value + 1);
  const openReview = (action) => { setReviewDialog(action); setReviewReason(''); setReviewError(''); };
  const closeReview = () => { if (!submittingReview) setReviewDialog(null); };
  const openSource = (sourceInfo, fallback) => setSource({ contentId: sourceInfo.contentId, contentType: sourceInfo.contentType, fallback });
  const closeSource = () => setSource(null);
  const submitReview = async () => {
    if (!selectedId || !reviewDialog || submittingReview) return;
    if (reviewDialog === 'REJECT' && !reviewReason.trim()) { setReviewError('Enter a reason before rejecting this suggestion.'); return; }
    setSubmittingReview(true);
    setReviewError('');
    try {
      const updated = await contentRecipeSuggestionsApi.review(selectedId, reviewDialog, reviewReason);
      setDetail(updated);
      setReviewDialog(null);
      setToast(reviewDialog === 'APPROVE' ? 'Suggestion approved.' : 'Suggestion rejected.');
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      if (requestError?.status === 409 || requestError?.status === 404) {
        setReviewDialog(null);
        setToast('Suggestion changed on the server. The queue has been refreshed.');
        setRefreshKey((value) => value + 1);
      } else setReviewError(requestError?.message || 'The review could not be saved.');
    } finally { setSubmittingReview(false); }
  };

  return <div className="recipe-suggestions-page">
    <header className="recipe-suggestions-hero">
      <div><p>ADMINISTRATION / CONTENT REVIEW</p><h1>Recipe suggestions</h1><span>Review server-generated dish and recipe proposals from published community content.</span></div>
      <div className="recipe-suggestions-total" aria-live="polite"><Soup size={20} /><div><strong>{result.totalElements}</strong><span>server suggestions</span></div></div>
    </header>

    <section className="recipe-suggestions-toolbar" aria-label="Suggestion filters">
      <select aria-label="Filter suggestions by status" value={status} onChange={(event) => changeStatus(event.target.value)}><option value="">All statuses</option><option value="PENDING">Pending</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option></select>
    </section>

    {loading ? <section className="admin-panel recipe-suggestions-state"><LoadingState /></section>
      : error ? <section className="admin-panel recipe-suggestions-state"><ErrorState onRetry={retry} /></section>
        : !result.content.length ? <section className="admin-panel recipe-suggestions-state"><EmptyState title="No suggestions found." text={status ? 'Try another server status filter.' : 'Eligible content will appear here when the server creates a suggestion.'} /></section>
          : <div className="recipe-suggestions-board">
            <section className="admin-panel recipe-suggestions-list" aria-label="Content recipe suggestions">
              <header><div><p>QUEUE</p><h2>Suggestions to review</h2></div><span>{result.content.length} on this page</span></header>
              <div>{result.content.map((item) => {
                const active = item.suggestionId === selectedId;
                const Icon = item.source.contentType === 'VIDEO' ? PlaySquare : FileText;
                return <button key={item.suggestionId} type="button" className={active ? 'recipe-suggestion-row is-active' : 'recipe-suggestion-row'} onClick={() => setSelectedId(item.suggestionId)} aria-pressed={active}>
                  <span className="recipe-suggestion-row-icon"><Icon size={18} /></span><span className="recipe-suggestion-row-copy"><span className="recipe-suggestion-row-top"><small>{item.source.contentType === 'VIDEO' ? 'Video' : 'Blog'}</small><SuggestionStatus status={item.status} /></span><strong>{item.source.title}</strong><small>By {item.source.authorName}</small><span className="recipe-suggestion-row-proposal">Proposed dish: <b>{item.dish.name}</b></span><time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time></span>
                </button>;
              })}</div>
              {result.totalPages > 1 && <nav className="recipe-suggestion-pagination" aria-label="Suggestion pagination"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} aria-label="Previous page"><ChevronLeft size={16} /></button><span>Page {page} of {result.totalPages}</span><button type="button" disabled={page >= result.totalPages} onClick={() => setPage((value) => value + 1)} aria-label="Next page"><ChevronRight size={16} /></button></nav>}
            </section>
            {detailLoading ? <section className="admin-panel recipe-suggestion-detail-state"><LoadingState /></section>
              : detailError ? <section className="admin-panel recipe-suggestion-detail-state"><ErrorState onRetry={() => setDetailRefresh((value) => value + 1)} /></section>
                : detailUnavailable ? <section className="admin-panel recipe-suggestion-detail-state"><EmptyState title="Suggestion is no longer available." text="The server reported that this suggestion or its source content cannot be reviewed." /></section>
                : detail ? <RecipeDetail suggestion={detail} showReviewControls onReview={openReview} onOpenSource={(sourceInfo) => openSource(sourceInfo, detail)} submitting={submittingReview} />
                  : selected ? <section className="admin-panel recipe-suggestion-detail-state"><EmptyState title="Suggestion detail is unavailable." text="The source may have changed or is no longer available on the server." /></section> : null}
          </div>}
    {reviewDialog && <div className="admin-modal-backdrop" onMouseDown={closeReview}><section className="admin-dialog recipe-suggestion-review-dialog" role="dialog" aria-modal="true" aria-labelledby="suggestion-review-title" onMouseDown={(event) => event.stopPropagation()}><p>REVIEW</p><h2 id="suggestion-review-title">{reviewDialog === 'APPROVE' ? 'Approve this suggestion?' : 'Reject this suggestion?'}</h2><span>{reviewDialog === 'APPROVE' ? 'The proposed dish and recipe will be imported into the catalog.' : 'State why this proposal should not enter the catalog.'}</span>{reviewDialog === 'REJECT' && <label>Rejection reason<textarea value={reviewReason} onChange={(event) => setReviewReason(event.target.value)} placeholder="Example: nutrition information needs a verifiable source" aria-invalid={Boolean(reviewError)} />{reviewError && <small>{reviewError}</small>}</label>}<div><button type="button" className="admin-btn secondary" disabled={submittingReview} onClick={closeReview}>Cancel</button><button type="button" className={`admin-btn ${reviewDialog === 'APPROVE' ? 'primary' : 'danger'}`} disabled={submittingReview} onClick={submitReview}>{submittingReview ? 'Saving...' : reviewDialog === 'APPROVE' ? 'Approve' : 'Reject'}</button></div></section></div>}
    <SourceContentModal open={Boolean(source)} loading={sourceLoading} error={sourceError} post={sourcePost} fallback={source?.fallback} onClose={closeSource} onRetry={() => setSourceRefresh((value) => value + 1)} />
    <Toast message={toast} onDismiss={() => setToast('')} />
    {preview && <span className="recipe-suggestions-preview-marker">Preview data</span>}
  </div>;
}
