import { Check, ChevronLeft, ChevronRight, ExternalLink, Eye, FileText, ListOrdered, MapPin, PlaySquare, Soup, UserRound, UtensilsCrossed, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, ErrorState, LoadingState, Toast } from '../../components/admin/AdminUi';
import { contentRecipeSuggestionsApi } from '../../services/contentRecipeSuggestionsApi';
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

function SourceContentLink({ source }) {
  if (source.url) {
    return <a className="recipe-suggestion-source-link" href={source.url} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Open source</a>;
  }
  if (!source.contentId) return null;
  return <Link className="recipe-suggestion-source-link" to={`/community/posts/${source.contentId}`} state={{ contentType: source.contentType }}><ExternalLink size={15} /> Open source</Link>;
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

function RecipeDetail({ suggestion, showReviewControls, onReview, submitting }) {
  const { source, dish, recipe, nutrition, ingredients, restaurant } = suggestion;
  const ContentIcon = source.contentType === 'VIDEO' ? PlaySquare : FileText;
  return <article className="recipe-suggestion-detail" aria-label="Suggestion detail">
    <header className="recipe-suggestion-detail-head">
      <div><span>RECIPE SUGGESTION</span><SuggestionStatus status={suggestion.status} /></div>
      <time dateTime={suggestion.createdAt}>Suggested {formatDate(suggestion.createdAt)}</time>
    </header>

    <div className="recipe-suggestion-detail-body">
      <section className="recipe-suggestion-source">
        <div className="recipe-suggestion-source-type"><ContentIcon size={18} /><span>{source.contentType === 'VIDEO' ? 'Video source' : 'Blog source'}</span></div>
        <h2>{source.title}</h2>
        <div className="recipe-suggestion-source-meta"><span><UserRound size={14} /> {source.authorName}</span><span><Eye size={14} /> {source.viewCount ?? 0} views</span><span>{source.voteCount ?? 0} votes</span></div>
        <SourceContentLink source={source} />
      </section>

      <section className="recipe-suggestion-section">
        <div className="recipe-suggestion-section-title"><Soup size={17} /><h3>Proposed dish</h3></div>
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

      {suggestion.rejectionReason && <section className="recipe-suggestion-review-note"><strong>Review note</strong><p>{suggestion.rejectionReason}</p></section>}
      {suggestion.reviewedAt && <footer className="recipe-suggestion-review-meta">Reviewed {formatDate(suggestion.reviewedAt)}{suggestion.reviewerName ? ` by ${suggestion.reviewerName}` : ''}</footer>}
      {showReviewControls && suggestion.status === 'PENDING' && <footer className="recipe-suggestion-review-actions"><div><strong>Preview review controls</strong><span>These actions only update local preview data.</span></div><div><button type="button" className="admin-btn secondary" disabled={submitting} onClick={() => onReview('REJECT')}><X size={16} /> Reject</button><button type="button" className="admin-btn primary" disabled={submitting} onClick={() => onReview('APPROVE')}><Check size={16} /> Approve</button></div></footer>}
    </div>
  </article>;
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

  const selected = useMemo(() => result.content.find((item) => item.suggestionId === selectedId) ?? null, [result.content, selectedId]);
  const changeStatus = (nextStatus) => { setStatus(nextStatus); setPage(1); setSelectedId(null); };
  const retry = () => setRefreshKey((value) => value + 1);
  const openReview = (action) => { setReviewDialog(action); setReviewReason(''); setReviewError(''); };
  const closeReview = () => { if (!submittingReview) setReviewDialog(null); };
  const submitReview = async () => {
    if (!selectedId || !reviewDialog || submittingReview) return;
    if (reviewDialog === 'REJECT' && !reviewReason.trim()) { setReviewError('Enter a reason before rejecting this suggestion.'); return; }
    setSubmittingReview(true);
    setReviewError('');
    try {
      const updated = await contentRecipeSuggestionsApi.review(selectedId, reviewDialog, reviewReason);
      setDetail(updated);
      setReviewDialog(null);
      setToast(reviewDialog === 'APPROVE' ? 'Suggestion approved in preview.' : 'Suggestion rejected in preview.');
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
      <div><p>ADMINISTRATION / CATALOG</p><h1>Recipe suggestions</h1><span>Review server-proposed dishes and recipes from published community content.</span></div>
      <div className="recipe-suggestions-total" aria-live="polite"><Soup size={20} /><strong>{result.totalElements}</strong><span>suggestions</span></div>
    </header>

    <div className="recipe-suggestions-filters"><label>Status<select value={status} onChange={(event) => changeStatus(event.target.value)}><option value="">All statuses</option><option value="PENDING">Pending</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option></select></label></div>

    {loading ? <section className="admin-panel recipe-suggestions-state"><LoadingState /></section>
      : error ? <section className="admin-panel recipe-suggestions-state"><ErrorState onRetry={retry} /></section>
        : !result.content.length ? <section className="admin-panel recipe-suggestions-state"><EmptyState title="No suggestions found." text={status ? 'Try another server status filter.' : 'Eligible content will appear here when the server creates a suggestion.'} /></section>
          : <div className="recipe-suggestions-board">
            <section className="admin-panel recipe-suggestions-list" aria-label="Content recipe suggestions">
              <header><h2>Suggestion queue</h2><span>{result.content.length} on this page</span></header>
              <div>{result.content.map((item) => {
                const active = item.suggestionId === selectedId;
                const Icon = item.source.contentType === 'VIDEO' ? PlaySquare : FileText;
                return <button key={item.suggestionId} type="button" className={active ? 'recipe-suggestion-row is-active' : 'recipe-suggestion-row'} onClick={() => setSelectedId(item.suggestionId)} aria-pressed={active}>
                  <span className="recipe-suggestion-row-icon"><Icon size={18} /></span><span className="recipe-suggestion-row-copy"><strong>{item.source.title}</strong><small>{item.source.contentType === 'VIDEO' ? 'Video' : 'Blog'} by {item.source.authorName}</small><span>Proposed: {item.dish.name}</span><time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time></span><SuggestionStatus status={item.status} />
                </button>;
              })}</div>
              {result.totalPages > 1 && <nav className="recipe-suggestion-pagination" aria-label="Suggestion pagination"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} aria-label="Previous page"><ChevronLeft size={16} /></button><span>Page {page} of {result.totalPages}</span><button type="button" disabled={page >= result.totalPages} onClick={() => setPage((value) => value + 1)} aria-label="Next page"><ChevronRight size={16} /></button></nav>}
            </section>
            {detailLoading ? <section className="admin-panel recipe-suggestion-detail-state"><LoadingState /></section>
              : detailError ? <section className="admin-panel recipe-suggestion-detail-state"><ErrorState onRetry={() => setDetailRefresh((value) => value + 1)} /></section>
                : detailUnavailable ? <section className="admin-panel recipe-suggestion-detail-state"><EmptyState title="Suggestion is no longer available." text="The server reported that this suggestion or its source content cannot be reviewed." /></section>
                : detail ? <RecipeDetail suggestion={detail} showReviewControls={preview} onReview={openReview} submitting={submittingReview} />
                  : selected ? <section className="admin-panel recipe-suggestion-detail-state"><EmptyState title="Suggestion detail is unavailable." text="The source may have changed or is no longer available on the server." /></section> : null}
          </div>}
    {reviewDialog && <div className="admin-modal-backdrop" onMouseDown={closeReview}><section className="admin-dialog recipe-suggestion-review-dialog" role="dialog" aria-modal="true" aria-labelledby="suggestion-review-title" onMouseDown={(event) => event.stopPropagation()}><p>PREVIEW REVIEW</p><h2 id="suggestion-review-title">{reviewDialog === 'APPROVE' ? 'Approve this suggestion?' : 'Reject this suggestion?'}</h2><span>{reviewDialog === 'APPROVE' ? 'The preview will show the approved state after confirmation.' : 'State why this proposal should not enter the catalog.'}</span>{reviewDialog === 'REJECT' && <label>Rejection reason<textarea value={reviewReason} onChange={(event) => setReviewReason(event.target.value)} placeholder="Example: nutrition information needs a verifiable source" aria-invalid={Boolean(reviewError)} />{reviewError && <small>{reviewError}</small>}</label>}<div><button type="button" className="admin-btn secondary" disabled={submittingReview} onClick={closeReview}>Cancel</button><button type="button" className={`admin-btn ${reviewDialog === 'APPROVE' ? 'primary' : 'danger'}`} disabled={submittingReview} onClick={submitReview}>{submittingReview ? 'Saving...' : reviewDialog === 'APPROVE' ? 'Approve' : 'Reject'}</button></div></section></div>}
    <Toast message={toast} onDismiss={() => setToast('')} />
    {preview && <span className="recipe-suggestions-preview-marker">Preview data</span>}
  </div>;
}
