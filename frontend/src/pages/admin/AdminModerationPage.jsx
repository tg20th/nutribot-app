import { AlertTriangle, Bot, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, CircleCheck, CircleX, FileText, ListOrdered, Maximize2, Search, ShieldCheck, SlidersHorizontal, Sparkles, UtensilsCrossed, Video, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { adminApi } from '../../services/adminApi';
import { AdminToolbar, EmptyState, ErrorState, LoadingState, PageHeader, Toast } from '../../components/admin/AdminUi';
import ContentDiffModal from '../../components/admin/ContentDiffModal';
import { extractStoryText } from '../../utils/content';

const pageSize = 10;
const actions = {
  APPROVE: { title: 'Approve content', label: 'Confirm Approval', message: 'Content approved and published.', confirmClass: 'primary' },
  REJECT: { title: 'Reject content', label: 'Confirm Rejection', message: 'Content rejected.' },
};
const rejectionReasons = [
  ['INAPPROPRIATE_CONTENT', 'Inappropriate or offensive content'],
  ['MISLEADING_INFORMATION', 'Misleading or inaccurate information'],
  ['SPAM', 'Spam or promotional content'],
  ['COPYRIGHT_CONCERN', 'Copyright or ownership concerns'],
  ['LOW_QUALITY_CONTENT', 'Incomplete or low-quality content'],
  ['COMMUNITY_GUIDELINES_VIOLATION', 'Content violates community guidelines'],
  ['OTHER', 'Other reason'],
];
const rejectionReasonText = Object.fromEntries(rejectionReasons);
const rejectionReasonMaxLength = 1000;

function ModerationDecisionDialog({ decision, reason, rejectionReasonCode, error, submitting, onReasonChange, onRejectionReasonCodeChange, onClose, onConfirm }) {
  if (!decision) return null;
  const rejecting = decision.action === 'REJECT';
  const trimmedReason = reason.trim();
  const validRejectReason = rejectionReasonCode && (rejectionReasonCode !== 'OTHER' || trimmedReason.length > 0);
  return <div className="admin-modal-backdrop moderation-decision-backdrop" onMouseDown={submitting ? undefined : onClose}>
    <section className="admin-dialog moderation-decision-dialog" role="dialog" aria-modal="true" aria-labelledby="moderation-decision-title" onMouseDown={(event) => event.stopPropagation()}>
      <button type="button" className="moderation-decision-close" aria-label="Close confirmation" title="Close" disabled={submitting} onClick={onClose}><X size={17} aria-hidden="true" /></button>
      <p>{rejecting ? 'REJECTION CONFIRMATION' : 'APPROVAL CONFIRMATION'}</p>
      <h2 id="moderation-decision-title">{actions[decision.action].title}</h2>
      {rejecting && <span className="moderation-decision-description">Select a reason for rejecting this submission. The author will be notified of your decision.</span>}
      <span className="moderation-decision-content-title">{decision.item.title}</span>
      {rejecting ? <>
        <label className="moderation-reason-field" htmlFor="moderation-rejection-reason-code"><b>Reason for rejection *</b><select id="moderation-rejection-reason-code" value={rejectionReasonCode} disabled={submitting} onChange={(event) => onRejectionReasonCodeChange(event.target.value)}><option value="">Select a rejection reason</option>{rejectionReasons.map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></label>
        {rejectionReasonCode === 'OTHER' && <label className="moderation-reason-field" htmlFor="moderation-decision-reason"><b>Custom reason *</b><textarea id="moderation-decision-reason" maxLength={rejectionReasonMaxLength} value={reason} disabled={submitting} onChange={(event) => onReasonChange(event.target.value)} placeholder="Explain why this content cannot be approved..." aria-invalid={Boolean(error)} aria-describedby={error ? 'moderation-decision-error' : undefined} /><small className="moderation-reason-count">{reason.length}/{rejectionReasonMaxLength}</small></label>}
      </> : <label className="moderation-reason-field" htmlFor="moderation-decision-reason"><b>Approval reason (optional)</b><textarea id="moderation-decision-reason" value={reason} disabled={submitting} onChange={(event) => onReasonChange(event.target.value)} placeholder="Add a note about why this content is approved (optional)" aria-invalid={Boolean(error)} aria-describedby={error ? 'moderation-decision-error' : undefined} /></label>}
      {error && <p id="moderation-decision-error" className="moderation-decision-error" role="alert">{error}</p>}
      <div className="moderation-decision-actions"><button type="button" className="admin-btn secondary" disabled={submitting} onClick={onClose}>Cancel</button><button type="button" className={`admin-btn ${actions[decision.action].confirmClass || 'danger'}`} disabled={submitting || (rejecting && !validRejectReason)} onClick={onConfirm}>{submitting ? 'Saving...' : rejecting ? 'Reject content' : actions[decision.action].label}</button></div>
    </section>
  </div>;
}

const formatDate = (value) => value
  ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
  : 'Date unavailable';

const formatHistoryDate = (value) => value ? {
  date: new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value)),
  time: new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(new Date(value)),
} : { date: 'Date unavailable', time: '' };

const statusLabel = (status) => {
  const s = String(status || '').toLowerCase();
  if (s === 'under_review') return 'Under Review';
  if (s === 'published') return 'Published';
  if (s === 'rejected') return 'Rejected';
  if (s === 'archived' || s === 'hidden') return 'Archived';
  return 'Pending';
};

function parseRecipeBody(rawBody) {
  if (!rawBody || typeof rawBody !== 'string') return null;
  const trimmed = rawBody.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null;
  try {
    const data = JSON.parse(trimmed);
    if (data && typeof data === 'object') {
      const isRecipe = data.story || data.ingredients || data.steps || data.nutrition || data.prepMinutes || data.cookMinutes;
      if (isRecipe) {
        return {
          story: data.story || data.description || '',
          prepMinutes: data.prepMinutes ?? data.details?.prepMinutes ?? '',
          cookMinutes: data.cookMinutes ?? data.details?.cookMinutes ?? '',
          servings: data.servings ?? data.details?.servings ?? '',
          nutrition: data.nutrition || data.details || {},
          ingredients: Array.isArray(data.ingredients) ? data.ingredients : [],
          steps: Array.isArray(data.steps) ? data.steps : [],
        };
      }
    }
  } catch {
    // fallback to plain text
  }
  return null;
}

const validMinutes = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
};

function normalizeRecipeData(recipe) {
  if (!recipe || typeof recipe !== 'object') return null;
  const nutrition = recipe.nutrition || recipe.details || {};
  const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
  const steps = Array.isArray(recipe.steps) ? recipe.steps : [];
  const hasRecipeData = recipe.story || ingredients.length || steps.length
    || Object.values(nutrition).some((value) => value != null && value !== '')
    || recipe.prepMinutes != null || recipe.cookMinutes != null || recipe.servings != null;
  return hasRecipeData ? {
    story: recipe.story || recipe.description || '',
    prepMinutes: recipe.prepMinutes ?? recipe.prepTimeMin ?? nutrition.prepMinutes ?? '',
    cookMinutes: recipe.cookMinutes ?? recipe.cookTimeMin ?? nutrition.cookMinutes ?? '',
    servings: recipe.servings ?? nutrition.servings ?? '',
    nutrition,
    ingredients,
    steps,
  } : null;
};

const ingredientParts = (ingredient) => {
  if (typeof ingredient === 'string') return { name: ingredient, quantity: '' };
  if (!ingredient || typeof ingredient !== 'object') return { name: 'Unnamed ingredient', quantity: '' };
  const quantity = [ingredient.quantity, ingredient.unit].filter(Boolean).join(' ');
  return { name: ingredient.name || ingredient.ingredient || 'Unnamed ingredient', quantity };
};

const stepText = (step) => typeof step === 'string' ? step : step?.instruction || step?.text || '';

function extractContentImages(body) {
  if (!body || typeof body !== 'string') return [];
  const images = [];
  const htmlSources = [...body.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)].map((match) => match[1]);
  const markdownSources = [...body.matchAll(/!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)].map((match) => match[1]);
  [...htmlSources, ...markdownSources].forEach((source) => {
    try {
      const url = new URL(source, window.location.origin);
      if (url.protocol === 'http:' || url.protocol === 'https:') images.push(url.href);
    } catch {
      // Ignore malformed or unsupported media references.
    }
  });
  return [...new Set(images)];
}

function getYouTubeVideoId(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
    let id = null;
    if (hostname === 'youtu.be') id = url.pathname.split('/').filter(Boolean)[0];
    if (hostname === 'youtube.com' || hostname === 'youtube-nocookie.com') {
      if (url.pathname === '/watch') id = url.searchParams.get('v');
      if (url.pathname.startsWith('/shorts/')) id = url.pathname.split('/')[2];
      if (url.pathname.startsWith('/embed/')) id = url.pathname.split('/')[2];
    }
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

function getSafeVideoUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

function VideoPreview({ source, poster, title }) {
  const [failed, setFailed] = useState(false);
  const safeSource = getSafeVideoUrl(source);
  const youtubeId = getYouTubeVideoId(source);
  const embedUrl = youtubeId ? `https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0` : null;

  useEffect(() => setFailed(false), [source]);

  if (!safeSource) {
    return <div className="moderation-video-state"><Video size={24} /><p>{source ? 'This video URL is not supported.' : 'No video URL is available for this submission.'}</p></div>;
  }

  if (failed) {
    return <div className="moderation-video-state"><Video size={24} /><p>This video could not be loaded.</p><a href={safeSource} target="_blank" rel="noreferrer">Open original video</a></div>;
  }

  return <div className="moderation-video-preview">
    {embedUrl
      ? <iframe title={`Play ${title}`} src={embedUrl} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen onError={() => setFailed(true)} />
      : <video controls playsInline preload="metadata" src={safeSource} poster={poster || undefined} aria-label={title} onError={() => setFailed(true)} />}
    <a className="moderation-video-link" href={safeSource} target="_blank" rel="noreferrer">Open original video</a>
  </div>;
}

function ContentImageGallery({ images, onOpen }) {
  if (images.length === 0) return null;
  return <div className="moderation-content-images" aria-label="Submitted content images">
    {images.map((image, index) => <button key={image} type="button" className="moderation-content-image" onClick={() => onOpen(index)} aria-label={`Open submitted image ${index + 1}`}>
      <img src={image} alt={`Submitted content ${index + 1}`} loading="lazy" />
    </button>)}
  </div>;
}

function ImageLightbox({ images, index, zoom, brokenImages, onClose, onNavigate, onZoom, onReset, onImageError }) {
  const image = images[index];
  const isBroken = !image || brokenImages.has(image);

  return <div className="moderation-lightbox" role="dialog" aria-modal="true" aria-label="Image inspection" onMouseDown={(event) => {
    if (event.target === event.currentTarget) onClose();
  }}>
    <div className="moderation-lightbox-toolbar">
      <span className="moderation-lightbox-counter">{index + 1} / {images.length}</span>
      <div className="moderation-lightbox-controls">
        <button type="button" onClick={() => onZoom(-0.25)} aria-label="Zoom out" title="Zoom out"><ZoomOut size={17} /></button>
        <button type="button" onClick={() => onZoom(0.25)} aria-label="Zoom in" title="Zoom in"><ZoomIn size={17} /></button>
        <button type="button" onClick={onReset} aria-label="Fit image to screen" title="Fit to screen"><Maximize2 size={17} /></button>
        {images.length > 1 && <>
          <button type="button" onClick={() => onNavigate(-1)} aria-label="Previous image" title="Previous image"><ChevronLeft size={18} /></button>
          <button type="button" onClick={() => onNavigate(1)} aria-label="Next image" title="Next image"><ChevronRight size={18} /></button>
        </>}
        <button type="button" onClick={onClose} aria-label="Close image preview" title="Close"><X size={18} /></button>
      </div>
    </div>
    <div className="moderation-lightbox-stage">
      {isBroken ? <div className="moderation-lightbox-empty"><FileText size={24} /><p>This image could not be loaded.</p></div> : <img
        src={image}
        alt={`Submitted content image ${index + 1} of ${images.length}`}
        style={{ transform: `scale(${zoom})` }}
        onError={() => onImageError(image)}
      />}
    </div>
  </div>;
}

function RecipeOverview({ recipe, expanded, onToggle }) {
  const prep = validMinutes(recipe.prepMinutes);
  const cook = validMinutes(recipe.cookMinutes);
  const total = prep != null && cook != null ? prep + cook : null;
  const time = total != null ? `${total} min total` : [prep != null && `Prep ${prep} min`, cook != null && `Cook ${cook} min`].filter(Boolean).join(' · ');
  const nutrition = recipe.nutrition || {};
  const hasNutrition = Object.values(nutrition).some((value) => value != null && value !== '');
  const hasOverview = time || recipe.servings || hasNutrition || recipe.ingredients.length || recipe.steps.length;

  if (!hasOverview) return null;

  return (
    <section className="moderation-recipe-overview" aria-labelledby="recipe-overview-title">
      <div
        className="moderation-recipe-overview-header"
        role="button"
        tabIndex="0"
        aria-expanded={expanded}
        aria-controls="recipe-details"
        aria-label={expanded ? 'Collapse recipe overview' : 'Expand recipe overview'}
        onClick={onToggle}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onToggle();
          }
        }}
      >
        <h3 id="recipe-overview-title">Recipe overview</h3>
        {expanded ? <ChevronUp className="moderation-recipe-chevron" size={18} aria-hidden="true" /> : <ChevronDown className="moderation-recipe-chevron" size={18} aria-hidden="true" />}
      </div>
      <div className="moderation-recipe-summary" aria-label="Recipe summary">
        {time && <strong>{time}</strong>}
        {recipe.servings && <strong>{recipe.servings} servings</strong>}
        {nutrition.calories != null && nutrition.calories !== '' && <strong>{nutrition.calories} kcal</strong>}
        {recipe.ingredients.length > 0 && <span>{recipe.ingredients.length} ingredients</span>}
        {recipe.steps.length > 0 && <span>{recipe.steps.length} steps</span>}
      </div>
      {expanded && <div id="recipe-details"><FullRecipeDetails recipe={recipe} /></div>}
    </section>
  );
}

function FullRecipeDetails({ recipe }) {
  const nutrition = recipe.nutrition || {};
  const nutritionFields = [
    ['Calories', nutrition.calories, 'kcal'],
    ['Protein', nutrition.proteinG, 'g'],
    ['Carbs', nutrition.carbsG, 'g'],
    ['Fat', nutrition.fatG, 'g'],
    ['Fiber', nutrition.fiberG, 'g'],
    ['Sodium', nutrition.sodiumMg, 'mg'],
  ].filter(([, value]) => value != null && value !== '');

  return (
    <div className="moderation-full-recipe">
      {(recipe.prepMinutes || recipe.cookMinutes) && <p className="moderation-recipe-times">
        {recipe.prepMinutes && `Prep ${recipe.prepMinutes} min`}
        {recipe.prepMinutes && recipe.cookMinutes && ' · '}
        {recipe.cookMinutes && `Cook ${recipe.cookMinutes} min`}
      </p>}
      {recipe.ingredients.length > 0 && <section className="moderation-recipe-section">
        <h4 className="moderation-recipe-section-title"><UtensilsCrossed size={15} /> Ingredients</h4>
        <ul className="moderation-recipe-ingredient-list">
          {recipe.ingredients.map((ingredient, index) => {
            const parts = ingredientParts(ingredient);
            return <li key={`${parts.name}-${index}`}><span>{parts.name}</span><span>{parts.quantity || '—'}</span></li>;
          })}
        </ul>
      </section>}
      {recipe.steps.length > 0 && <section className="moderation-recipe-section">
        <h4 className="moderation-recipe-section-title"><ListOrdered size={15} /> Preparation steps</h4>
        <ol className="moderation-recipe-step-list">
          {recipe.steps.map((step, index) => <li key={index}><span>{index + 1}</span><p>{stepText(step)}</p></li>)}
        </ol>
      </section>}
      {nutritionFields.length > 0 && <section className="moderation-recipe-section">
        <h4 className="moderation-recipe-section-title"><Sparkles size={15} /> Nutrition</h4>
        <dl className="moderation-nutrition-list">
          {nutritionFields.map(([label, value, unit]) => <div key={label}><dt>{label}</dt><dd>{value} {unit}</dd></div>)}
        </dl>
      </section>}
    </div>
  );
}

function ModerationSubmissionContent({ body, recipeData, recipeExpanded, onToggleRecipe, contentImages, onOpenImage }) {
  const recipe = normalizeRecipeData(recipeData) || parseRecipeBody(body);
  const plainBody = extractStoryText(body);

  if (!recipe) {
    return <section className="moderation-story-section" aria-labelledby="story-title">
      <div className="moderation-section-heading"><h3 id="story-title">The story</h3></div>
      {plainBody ? <p className="moderation-plain-content">{plainBody}</p> : <p className="moderation-no-body">No additional content details are available for this submission.</p>}
      <ContentImageGallery images={contentImages} onOpen={onOpenImage} />
    </section>;
  }

  return <>
    <section className="moderation-story-section" aria-labelledby="story-title">
      <div className="moderation-section-heading"><h3 id="story-title">The story</h3></div>
      {plainBody ? <p className="moderation-plain-content">{plainBody}</p> : <p className="moderation-no-body">No story is available for this recipe submission.</p>}
      <ContentImageGallery images={contentImages} onOpen={onOpenImage} />
    </section>
    <RecipeOverview recipe={recipe} expanded={recipeExpanded} onToggle={onToggleRecipe} />
  </>;
}

function renderPolicyAssessment(text) {
  if (!text) return 'No AI evaluation is available for this submission.';
  const evidenceMarker = text.search(/(?:hình ảnh|ảnh|image)[^,.!?]*\b(?:hiển thị|display(?:s|ed)?)\s+/i);
  const violationMarker = text.search(/vi phạm chính sách|violat(?:es|ing)\s+(?:the\s+)?policy/i);
  if (evidenceMarker < 0 || violationMarker <= evidenceMarker) return text;
  const evidenceMatch = text.slice(evidenceMarker).match(/(?:hiển thị|display(?:s|ed)?)\s+/i);
  const evidenceStart = evidenceMarker + (evidenceMatch?.[0].length || 0);
  const evidenceEnd = text.lastIndexOf(',', violationMarker);
  const policyEndMatch = text.slice(violationMarker).match(/[.!?](?:\s|$)/);
  const policyEnd = policyEndMatch ? violationMarker + policyEndMatch.index + 1 : text.length;
  if (evidenceEnd <= evidenceStart || policyEnd <= violationMarker) return text;
  return <>{text.slice(0, evidenceStart)}<strong className="moderation-assessment-highlight">{text.slice(evidenceStart, evidenceEnd).trim()}</strong>{text.slice(evidenceEnd, violationMarker)}<strong className="moderation-assessment-highlight">{text.slice(violationMarker, policyEnd).trim()}</strong>{text.slice(policyEnd)}</>;
}

function ModerationAssessment({ submission, onCompare }) {
  const hasMatch = Boolean(submission.matchedContentId || submission.matchedTitle || submission.matchedAuthor);
  const hasSimilarity = submission.similarityScore != null && Number.isFinite(Number(submission.similarityScore));
  const similarityPercent = hasSimilarity ? Math.round(Number(submission.similarityScore) * 100) : null;
  const isFormattedDuplicate = hasMatch && submission.matchedTitle && submission.matchedAuthor && hasSimilarity;
  return <section className={`moderation-ai-review ${submission.aiReason || hasMatch ? (submission.aiFlagged !== false ? 'is-flagged' : 'is-passed') : 'is-empty'}`} aria-labelledby="ai-review-title">
    <div className="moderation-section-heading">
      <div className="moderation-ai-heading"><Bot size={16} aria-hidden="true" /><h3 id="ai-review-title">AI Review</h3></div>
      <div className="moderation-ai-metrics">
        {submission.aiConfidence != null && <span className="moderation-ai-confidence">Confidence: <strong>{Math.round(submission.aiConfidence * 100)}%</strong></span>}
      </div>
    </div>
    <div className="moderation-assessment-row">
      <p className="moderation-assessment-text">
        {isFormattedDuplicate ? <>
          Suspected duplication of <strong className="moderation-assessment-highlight">“{submission.matchedTitle}”</strong> by <strong className="moderation-assessment-highlight">{submission.matchedAuthor}</strong> with <strong className="moderation-assessment-highlight">{similarityPercent}% similarity</strong>.
        </> : renderPolicyAssessment(submission.aiReason)}
      </p>
      {hasMatch && <button type="button" className="moderation-compare-action" onClick={onCompare}><Search size={15} aria-hidden="true" /> Compare</button>}
    </div>
  </section>;
}

function ModerationWorkspaceTabs({ active, onReviewQueue, onHistory }) {
  return <nav className="moderation-workspace-tabs" aria-label="Moderation workspace">
    <button type="button" className={active === 'queue' ? 'is-active' : ''} aria-current={active === 'queue' ? 'page' : undefined} onClick={onReviewQueue}>Review Queue</button>
    <button type="button" className={active === 'history' ? 'is-active' : ''} aria-current={active === 'history' ? 'page' : undefined} onClick={onHistory}>History</button>
  </nav>;
}

function ModerationHistory({ onReviewQueue }) {
  const emptyFilters = { query: '', action: '', contentType: '', adminUsername: '', from: '', to: '' };
  const [items, setItems] = useState([]); const [filters, setFilters] = useState(emptyFilters); const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1); const [totalPages, setTotalPages] = useState(1); const [totalElements, setTotalElements] = useState(0); const [loading, setLoading] = useState(true); const [error, setError] = useState(false); const [selected, setSelected] = useState(null); const [timeline, setTimeline] = useState([]);
  useEffect(() => { const controller = new AbortController(); setLoading(true); setError(false); adminApi.getModerationHistory({ ...filters, page: page - 1, size: pageSize }, controller.signal).then((data) => { setItems(data.content || []); setTotalPages(Math.max(1, data.totalPages || 1)); setTotalElements(data.totalElements ?? 0); }).catch(() => { if (!controller.signal.aborted) setError(true); }).finally(() => { if (!controller.signal.aborted) setLoading(false); }); return () => controller.abort(); }, [filters, page]);
  useEffect(() => { if (!selected) { setTimeline([]); return undefined; } const controller = new AbortController(); adminApi.getModerationTimeline(selected.contentId, controller.signal).then(setTimeline).catch(() => setTimeline([])); return () => controller.abort(); }, [selected]);
  const change = (key, value) => { setFilters((current) => ({ ...current, [key]: value })); setPage(1); };
  const advanced = Boolean(filters.contentType || filters.adminUsername || filters.from || filters.to);
  return <div className="moderation-page moderation-history-page"><PageHeader eyebrow="ADMINISTRATION / CONTENT REVIEW" title="Moderation History" text="A complete record of content review decisions" /><ModerationWorkspaceTabs active="history" onReviewQueue={onReviewQueue} onHistory={() => {}} />
    <section className="moderation-history-workspace" aria-label="Review history"><div className="moderation-history-primary"><label className="moderation-history-search"><Search size={17} aria-hidden="true" /><input aria-label="Search moderation history" value={filters.query} onChange={(e) => change('query', e.target.value)} placeholder="Search content, author or ID" />{filters.query && <button type="button" onClick={() => change('query', '')} aria-label="Clear search"><X size={15} /></button>}</label><div className="moderation-history-toolbar-controls"><label className="moderation-decision-dropdown"><span>Decision</span><select aria-label="Decision filter" value={filters.action} onChange={(e) => change('action', e.target.value)}><option value="">All decisions</option><option value="APPROVE">Approved</option><option value="REJECT">Rejected</option></select></label><button type="button" className={filtersOpen || advanced ? 'moderation-filter-toggle is-active' : 'moderation-filter-toggle'} onClick={() => setFiltersOpen((open) => !open)} aria-expanded={filtersOpen} aria-controls="moderation-advanced-filters"><SlidersHorizontal size={15} /> More filters <ChevronDown className={filtersOpen ? 'is-open' : ''} size={14} /></button></div></div>{filtersOpen && <div id="moderation-advanced-filters" className="moderation-advanced-filters"><label>Content type<select value={filters.contentType} onChange={(e) => change('contentType', e.target.value)}><option value="">All content</option><option value="BLOG">Blog</option><option value="VIDEO">Video</option></select></label><label>Administrator<input value={filters.adminUsername} onChange={(e) => change('adminUsername', e.target.value)} placeholder="Administrator" /></label><label>From<input type="date" value={filters.from} onChange={(e) => change('from', e.target.value)} /></label><label>To<input type="date" value={filters.to} onChange={(e) => change('to', e.target.value)} /></label><button type="button" className="moderation-clear-filters" disabled={!advanced && !filters.query && !filters.action} onClick={() => { setFilters(emptyFilters); setPage(1); }}>Reset filters</button></div>}</section>
    {loading ? <section className="admin-panel moderation-loading"><LoadingState /></section> : error ? <section className="admin-panel moderation-empty"><ErrorState onRetry={() => setFilters({ ...filters })} /></section> : items.length === 0 ? <section className="admin-panel moderation-empty"><EmptyState title={filters.query || filters.action || advanced ? 'No matching review records.' : 'No moderation history found.'} text="Try changing the search or filters." /></section> : <section className="moderation-history-list" aria-label="Audit history">{items.map((item) => { const reviewed = formatHistoryDate(item.reviewedAt); const approved = item.action === 'APPROVE'; const TypeIcon = item.type === 'VIDEO' ? Video : FileText; return <button className="moderation-history-row" type="button" key={item.id} onClick={() => setSelected(item)}><span className="moderation-history-content"><span className="moderation-history-type-icon"><TypeIcon size={16} /></span><span><b>{item.title}</b><small>{item.type === 'VIDEO' ? 'Video' : 'Blog'} <i>/</i> @{item.author} <i>/</i> #{item.contentId}</small><em>Reviewed by {item.admin}</em></span></span><span className="moderation-history-trailing"><span className={approved ? 'moderation-decision approved' : 'moderation-decision rejected'}>{approved ? <CircleCheck size={16} /> : <CircleX size={16} />}{approved ? 'Approved' : 'Rejected'}</span><time dateTime={item.reviewedAt}><b>{reviewed.date}</b><small>{reviewed.time}</small></time><ChevronRight className="moderation-history-chevron" size={17} /></span></button>; })}{totalPages > 1 && <nav className="moderation-pagination" aria-label="History pagination"><button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous page"><ChevronLeft size={17} /></button><span>{page} / {totalPages}</span><button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} aria-label="Next page"><ChevronRight size={17} /></button></nav>}</section>}
    {selected && <aside className="moderation-history-drawer" role="dialog" aria-modal="true" aria-label="Moderation audit detail"><header><div><span className="moderation-detail-kicker">{selected.type} REVIEW</span><h2>{selected.title}</h2></div><button type="button" onClick={() => setSelected(null)} aria-label="Close history detail"><X size={19} /></button></header><div className="moderation-history-drawer-body"><section><h3>Decision</h3><p className={selected.action === 'APPROVE' ? 'moderation-decision approved' : 'moderation-decision rejected'}>{selected.action === 'APPROVE' ? 'Approved' : 'Rejected'}</p><p>{selected.previousStatus} to {selected.newStatus}</p></section><section><h3>Reviewed by</h3><p>{selected.admin} · {formatDate(selected.reviewedAt)}</p></section><section><h3>AI Review snapshot</h3><p>{selected.aiReason || 'No AI assessment was available when this decision was made.'}{selected.aiConfidence != null && ` Confidence: ${Math.round(selected.aiConfidence * 100)}%.`}</p></section><section><h3>Decision reason</h3><p>{selected.reason || 'No reason was recorded.'}</p></section><section><h3>Original reviewed content</h3>{selected.body ? <ModerationSubmissionContent body={selected.body} recipeExpanded={false} onToggleRecipe={() => {}} contentImages={[]} onOpenImage={() => {}} /> : <p>This historical content snapshot is unavailable.</p>}</section><section><h3>Content moderation timeline</h3>{timeline.length ? timeline.map((event) => <p key={event.id}><strong>{event.action === 'APPROVE' ? 'Approved' : 'Rejected'}</strong> by {event.admin} on {formatDate(event.reviewedAt)}{event.reason ? `: ${event.reason}` : ''}</p>) : <p>No recorded decisions are available for this content.</p>}</section></div></aside>}</div>;
}

function LegacyModerationHistory({ onReviewQueue }) {
  const [items, setItems] = useState([]); const [filters, setFilters] = useState({ query: '', action: '', contentType: '', adminUsername: '', from: '', to: '' });
  const [page, setPage] = useState(1); const [totalPages, setTotalPages] = useState(1); const [loading, setLoading] = useState(true); const [error, setError] = useState(false); const [selected, setSelected] = useState(null); const [timeline, setTimeline] = useState([]);
  useEffect(() => { const controller = new AbortController(); setLoading(true); setError(false); adminApi.getModerationHistory({ ...filters, page: page - 1, size: pageSize }, controller.signal).then((data) => { setItems(data.content || []); setTotalPages(Math.max(1, data.totalPages || 1)); }).catch(() => { if (!controller.signal.aborted) setError(true); }).finally(() => { if (!controller.signal.aborted) setLoading(false); }); return () => controller.abort(); }, [filters, page]);
  useEffect(() => { if (!selected) { setTimeline([]); return undefined; } const controller = new AbortController(); adminApi.getModerationTimeline(selected.contentId, controller.signal).then(setTimeline).catch(() => setTimeline([])); return () => controller.abort(); }, [selected]);
  const change = (key, value) => { setFilters((current) => ({ ...current, [key]: value })); setPage(1); };
  return <div className="moderation-page moderation-history-page"><PageHeader eyebrow="ADMINISTRATION / CONTENT REVIEW" title="Moderation History" text="A complete record of content review decisions" /><ModerationWorkspaceTabs active="history" onReviewQueue={onReviewQueue} onHistory={() => {}} />
    <AdminToolbar className="moderation-toolbar moderation-history-filters" label="History filters"><label className="admin-search moderation-search"><Search size={17} /><input value={filters.query} onChange={(e) => change('query', e.target.value)} placeholder="Search title, ID, or author" /></label><select className="admin-filter-select" value={filters.action} onChange={(e) => change('action', e.target.value)}><option value="">All decisions</option><option value="APPROVE">Approved</option><option value="REJECT">Rejected</option></select><select className="admin-filter-select" value={filters.contentType} onChange={(e) => change('contentType', e.target.value)}><option value="">All content</option><option value="BLOG">Blogs</option><option value="VIDEO">Videos</option></select><input className="admin-filter-select" aria-label="Administrator" value={filters.adminUsername} onChange={(e) => change('adminUsername', e.target.value)} placeholder="Administrator" /><input className="admin-filter-select" aria-label="From date" type="date" value={filters.from} onChange={(e) => change('from', e.target.value)} /><input className="admin-filter-select" aria-label="To date" type="date" value={filters.to} onChange={(e) => change('to', e.target.value)} /></AdminToolbar>
    {loading ? <section className="admin-panel moderation-loading"><LoadingState /></section> : error ? <section className="admin-panel moderation-empty"><ErrorState onRetry={() => setFilters({ ...filters })} /></section> : items.length === 0 ? <section className="admin-panel moderation-empty"><EmptyState title="No moderation history found." text="Completed approval and rejection decisions will appear here." /></section> : <section className="admin-panel moderation-history-table"><div className="moderation-history-head"><span>Content</span><span>Decision</span><span>Administrator</span><span>Reviewed at</span></div>{items.map((item) => <button className="moderation-history-row" type="button" key={item.id} onClick={() => setSelected(item)}><span><b>{item.title}</b><small>{item.type === 'VIDEO' ? 'Video' : 'Blog'} · {item.author} · #{item.contentId}</small></span><span className={item.action === 'APPROVE' ? 'moderation-decision approved' : 'moderation-decision rejected'}>{item.action === 'APPROVE' ? 'Approved' : 'Rejected'}</span><span>{item.admin}</span><time dateTime={item.reviewedAt}>{formatDate(item.reviewedAt)}</time></button>)}<nav className="moderation-pagination" aria-label="History pagination"><button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft size={17} /></button><span>{page} / {totalPages}</span><button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}><ChevronRight size={17} /></button></nav></section>}
    {selected && <aside className="moderation-history-drawer" role="dialog" aria-modal="true" aria-label="Moderation audit detail"><header><div><span className="moderation-detail-kicker">{selected.type} REVIEW</span><h2>{selected.title}</h2></div><button type="button" onClick={() => setSelected(null)} aria-label="Close history detail"><X size={19} /></button></header><div className="moderation-history-drawer-body"><section><h3>Decision</h3><p className={selected.action === 'APPROVE' ? 'moderation-decision approved' : 'moderation-decision rejected'}>{selected.action === 'APPROVE' ? 'Approved' : 'Rejected'}</p><p>{selected.previousStatus} to {selected.newStatus}</p></section><section><h3>Reviewed by</h3><p>{selected.admin} · {formatDate(selected.reviewedAt)}</p></section><section><h3>AI Review snapshot</h3><p>{selected.aiReason || 'No AI assessment was available when this decision was made.'}{selected.aiConfidence != null && ` Confidence: ${Math.round(selected.aiConfidence * 100)}%.`}</p></section><section><h3>Decision reason</h3><p>{selected.reason || 'No reason was recorded.'}</p></section><section><h3>Original reviewed content</h3>{selected.body ? <ModerationSubmissionContent body={selected.body} recipeExpanded={false} onToggleRecipe={() => {}} contentImages={[]} onOpenImage={() => {}} /> : <p>This historical content snapshot is unavailable.</p>}</section><section><h3>Content moderation timeline</h3>{timeline.length ? timeline.map((event) => <p key={event.id}><strong>{event.action === 'APPROVE' ? 'Approved' : 'Rejected'}</strong> by {event.admin} on {formatDate(event.reviewedAt)}{event.reason ? `: ${event.reason}` : ''}</p>) : <p>No recorded decisions are available for this content.</p>}</section></div></aside>}</div>;
}

export default function AdminModerationPage() {
  const preview = import.meta.env.DEV && new URLSearchParams(window.location.search).get('preview') === '1';
  const requestedSelectedId = new URLSearchParams(window.location.search).get('selected');
  const [items, setItems] = useState([]);
  const [workspace, setWorkspace] = useState('queue');
  const [selectedId, setSelectedId] = useState(null);
  const [contentType, setContentType] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [confirm, setConfirm] = useState(null);
  const [decisionReason, setDecisionReason] = useState('');
  const [rejectionReasonCode, setRejectionReasonCode] = useState('');
  const [decisionError, setDecisionError] = useState('');
  const [toast, setToast] = useState('');
  const [recipeExpanded, setRecipeExpanded] = useState(false);
  const [submittingAction, setSubmittingAction] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxZoom, setLightboxZoom] = useState(1);
  const [brokenImages, setBrokenImages] = useState(() => new Set());
  const [diffModalOpen, setDiffModalOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    adminApi.getModerationQueue({ contentType, page: page - 1, size: pageSize }, controller.signal)
      .then((result) => {
        const nextItems = result.content ?? [];
        setItems(nextItems);
        setTotalPages(Math.max(result.totalPages || 1, 1));
        setTotalElements(result.totalElements ?? nextItems.length);
        setSelectedId((current) => {
          const requested = nextItems.find((item) => String(item.id) === requestedSelectedId);
          if (requested) return requested.id;
          return nextItems.some((item) => item.id === current) ? current : nextItems[0]?.id ?? null;
        });
      })
      .catch((requestError) => {
        if (!controller.signal.aborted) setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [contentType, page, refreshKey, requestedSelectedId]);

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    return items.filter((item) => !value || `${item.title} ${item.author} ${item.authorEmail} ${item.slug}`.toLowerCase().includes(value));
  }, [items, query]);
  const selected = filtered.find((item) => item.id === selectedId) ?? filtered[0] ?? null;
  const contentImages = useMemo(() => {
    if (!selected) return [];
    const bodyImages = extractContentImages(selected.body);
    return selected.thumbnailUrl
      ? [selected.thumbnailUrl, ...bodyImages.filter((image) => image !== selected.thumbnailUrl)]
      : bodyImages;
  }, [selected]);

  useEffect(() => {
    setRecipeExpanded(false);
    setLightboxOpen(false);
    setLightboxIndex(0);
    setLightboxZoom(1);
    setBrokenImages(new Set());
  }, [selected?.id]);

  useEffect(() => {
    if (!lightboxOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setLightboxOpen(false);
      if (event.key === 'ArrowLeft' && contentImages.length > 1) setLightboxIndex((current) => (current - 1 + contentImages.length) % contentImages.length);
      if (event.key === 'ArrowRight' && contentImages.length > 1) setLightboxIndex((current) => (current + 1) % contentImages.length);
    };
    document.addEventListener('keydown', handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [lightboxOpen, contentImages.length]);

  const changeType = (value) => {
    setContentType(value);
    setPage(1);
    setQuery('');
    setSelectedId(null);
  };

  const decide = async () => {
    if (!confirm || submittingAction) return;
    const reason = decisionReason.trim();
    if (confirm.action === 'REJECT' && (!rejectionReasonCode || (rejectionReasonCode === 'OTHER' && !reason))) {
      setDecisionError('A rejection reason is required.');
      return;
    }
    const submittedReason = confirm.action === 'REJECT' ? (rejectionReasonCode === 'OTHER' ? reason : rejectionReasonText[rejectionReasonCode]) : reason;
    setSubmittingAction(true);
    setDecisionError('');
    try {
      await adminApi.moderateContent(confirm.item.id, confirm.action, submittedReason);
      setToast(actions[confirm.action].message);
      setConfirm(null);
      setDiffModalOpen(false);
      setDecisionReason('');
      setRejectionReasonCode('');
      setSelectedId(null);
      setRefreshKey((key) => key + 1);
    } catch (requestError) {
      setDecisionError(requestError?.message || 'Could not update this submission. Please try again.');
    } finally {
      setSubmittingAction(false);
    }
  };

  const openImage = (index) => {
    if (contentImages.length === 0) return;
    setLightboxIndex(Math.max(0, Math.min(index, contentImages.length - 1)));
    setLightboxZoom(1);
    setLightboxOpen(true);
  };
  const navigateImage = (delta) => setLightboxIndex((current) => (current + delta + contentImages.length) % contentImages.length);
  const changeZoom = (delta) => setLightboxZoom((current) => Math.min(3, Math.max(1, Number((current + delta).toFixed(2)))));

  if (workspace === 'history') return <ModerationHistory onReviewQueue={() => setWorkspace('queue')} />;
  return <div className="moderation-page">
    <PageHeader
      eyebrow="ADMINISTRATION / CONTENT REVIEW"
      title="Content moderation"
      text="Review pending blog and video submissions."
      action={<div className="moderation-count" aria-live="polite"><ShieldCheck size={18} /><strong>{totalElements}</strong><span>pending</span></div>}
    />
    <ModerationWorkspaceTabs active="queue" onReviewQueue={() => {}} onHistory={() => setWorkspace('history')} />
    <AdminToolbar className="moderation-toolbar" label="Moderation filters">
        <label className="admin-search moderation-search" aria-label="Search submissions">
          <Search size={17} aria-hidden="true" />
          <input aria-label="Search title or author" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title or author on this page..." />
          {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search"><X size={15} /></button>}
        </label>
        <div className="moderation-type-filter">
          <select className="admin-filter-select" aria-label="Content type" value={contentType} onChange={(event) => changeType(event.target.value)}>
            <option value="">All content</option>
            <option value="BLOG">Blogs</option>
            <option value="VIDEO">Videos</option>
          </select>
        </div>
    </AdminToolbar>

    <div className="moderation-results" aria-live="polite">
      {loading ? <section className="admin-panel moderation-loading"><LoadingState /></section>
        : error ? <section className="admin-panel moderation-empty"><ErrorState onRetry={() => setRefreshKey((key) => key + 1)} /></section>
          : filtered.length === 0 ? <section className="admin-panel moderation-empty"><EmptyState title={query ? 'No submissions match your search.' : 'No submissions are waiting for review.'} text={query ? 'Try another title or author.' : 'The review queue is clear.'} /></section>
            : <div className="moderation-board">
              <section className="admin-panel moderation-queue" aria-label="Pending submissions">
                <header><h2>Review queue</h2><span>{filtered.length} shown</span></header>
                <div className="moderation-queue-list">
                  {filtered.map((item) => {
                    const active = item.id === selected?.id;
                    const Icon = item.type === 'VIDEO' ? Video : FileText;
                    return <button key={item.id} type="button" className={active ? 'moderation-queue-item is-active' : 'moderation-queue-item'} onClick={() => setSelectedId(item.id)} aria-pressed={active}>
                      <span className="moderation-type-icon"><Icon size={18} /></span>
                      <span className="moderation-queue-copy"><b>{item.title}</b><small>{item.type === 'VIDEO' ? 'Video' : 'Blog'} · {item.author}</small><time dateTime={item.submittedAt}>{formatDate(item.submittedAt)}</time></span>
                      <div className="moderation-queue-badges">
                        <span className="moderation-pending">{statusLabel(item.status)}</span>
                        {item.aiReason && (
                          <span className={`moderation-ai-pill ${item.aiFlagged !== false ? 'flagged' : 'passed'}`} title={item.aiReason}>
                            <Bot size={11} /> AI
                          </span>
                        )}
                      </div>
                    </button>;
                  })}
                </div>
                {totalPages > 1 && <nav className="moderation-pagination" aria-label="Queue pagination">
                  <button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} aria-label="Previous page"><ChevronLeft size={17} /></button>
                  <span>{page} / {totalPages}</span>
                  <button type="button" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)} aria-label="Next page"><ChevronRight size={17} /></button>
                </nav>}
              </section>

              <article className="admin-panel moderation-detail">
                <div className="moderation-detail-header">
                  <div><span className="moderation-detail-kicker">{selected.type === 'VIDEO' ? 'VIDEO SUBMISSION' : 'BLOG SUBMISSION'}</span><span className="moderation-pending">{statusLabel(selected.status)}</span></div>
                  {selected.submittedAt && <time dateTime={selected.submittedAt}>Submitted {formatDate(selected.submittedAt)}</time>}
                </div>
                {selected.type === 'VIDEO'
                  ? <VideoPreview source={selected.mediaUrl} poster={contentImages[0]} title={selected.title} />
                  : contentImages[0] && !brokenImages.has(contentImages[0])
                  ? <button type="button" className="moderation-cover-button" onClick={() => openImage(0)} aria-label="Open cover image">
                    <img className="moderation-cover" src={contentImages[0]} alt="" onError={() => setBrokenImages((current) => new Set(current).add(contentImages[0]))} />
                  </button>
                  : <div className="moderation-cover-placeholder"><span>{selected.type === 'VIDEO' ? <Video size={26} /> : <FileText size={26} />}</span></div>}
                <div className="moderation-detail-content">
                  <h2>{selected.title}</h2>
                  <div className="moderation-content-meta">
                    <span>{selected.author}</span>
                    <span>{selected.type === 'VIDEO' ? 'Video' : 'Blog'}</span>
                    {selected.submittedAt && <span>{formatDate(selected.submittedAt)}</span>}
                  </div>
                  {selected.decisionReason && <p className="moderation-latest-reason"><strong>Latest decision reason:</strong> {selected.decisionReason}</p>}

                  {false && Boolean(selected.moderationFlag === 'SUSPECTED_DUPLICATE' || selected.matchedContentId) && (
                    <section
                      className="moderation-duplicate-card"
                      style={{
                        backgroundColor: '#fffbeb',
                        border: '1px solid #fde68a',
                        borderRadius: '12px',
                        padding: '1rem 1.25rem',
                        marginBottom: '1rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '1rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                        <div
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '8px',
                            backgroundColor: '#fef3c7',
                            color: '#d97706',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <AlertTriangle size={20} />
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <strong style={{ fontSize: '0.9375rem', color: '#92400e' }}>
                              Cảnh báo nội dung gần trùng lặp
                            </strong>
                            <span
                              style={{
                                backgroundColor: '#fee2e2',
                                color: '#b91c1c',
                                padding: '2px 8px',
                                borderRadius: '9999px',
                                fontSize: '0.75rem',
                                fontWeight: '700',
                              }}
                            >
                              {selected.similarityScore ? Math.round(selected.similarityScore * 100) : 80}% Tương đồng
                            </span>
                          </div>
                          <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: '#b45309' }}>
                            Nghi ngờ sao chép từ bài viết gốc: <strong>"{selected.matchedTitle || `Bài #${selected.matchedContentId}`}"</strong>
                            {selected.matchedAuthor ? ` của tác giả ${selected.matchedAuthor}` : ''}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setDiffModalOpen(true)}
                        className="admin-btn secondary"
                        style={{
                          whiteSpace: 'nowrap',
                          backgroundColor: '#f59e0b',
                          color: '#ffffff',
                          border: 'none',
                          fontWeight: '600',
                          padding: '0.5rem 1rem',
                          borderRadius: '8px',
                          cursor: 'pointer',
                        }}
                      >
                        🔍 So sánh trực diện
                      </button>
                    </section>
                  )}

                  <ModerationAssessment submission={selected} onCompare={() => setDiffModalOpen(true)} />

                  <ModerationSubmissionContent
                    body={selected.body}
                    recipeData={selected.recipe}
                    recipeExpanded={recipeExpanded}
                    onToggleRecipe={() => setRecipeExpanded((expanded) => !expanded)}
                    contentImages={selected.thumbnailUrl ? contentImages.slice(1) : contentImages}
                    onOpenImage={(index) => openImage(selected.thumbnailUrl ? index + 1 : index)}
                  />

                </div>
                <footer className="moderation-actions">
                  <button type="button" className="admin-btn primary" disabled={submittingAction} onClick={() => { setDecisionReason(''); setRejectionReasonCode(''); setDecisionError(''); setConfirm({ item: selected, action: 'APPROVE' }); }}><Check size={16} /> Approve</button>
                  <button type="button" className="admin-btn danger" disabled={submittingAction} onClick={() => { setDecisionReason(''); setRejectionReasonCode(''); setDecisionError(''); setConfirm({ item: selected, action: 'REJECT' }); }}><X size={16} /> Reject</button>
                </footer>
              </article>
            </div>}
    </div>

    {lightboxOpen && contentImages.length > 0 && <ImageLightbox
      images={contentImages}
      index={lightboxIndex}
      zoom={lightboxZoom}
      brokenImages={brokenImages}
      onClose={() => setLightboxOpen(false)}
      onNavigate={navigateImage}
      onZoom={changeZoom}
      onReset={() => setLightboxZoom(1)}
      onImageError={(image) => setBrokenImages((current) => new Set(current).add(image))}
    />}

    {false && <ModerationDecisionDialog
      dialog={confirm ? {
        title: actions[confirm.action].title,
        text: `This will change the status of “${confirm.item.title}”.`,
        confirm: actions[confirm.action].label,
        confirmClass: actions[confirm.action].confirmClass,
      } : null}
      onClose={() => setConfirm(null)}
      onConfirm={decide}
    />}
    <ModerationDecisionDialog decision={confirm} reason={decisionReason} rejectionReasonCode={rejectionReasonCode} error={decisionError} submitting={submittingAction}
      onReasonChange={(value) => { setDecisionReason(value); if (decisionError) setDecisionError(''); }}
      onRejectionReasonCodeChange={(value) => { setRejectionReasonCode(value); if (value !== 'OTHER') setDecisionReason(''); if (decisionError) setDecisionError(''); }}
      onClose={() => { setConfirm(null); setDecisionReason(''); setRejectionReasonCode(''); setDecisionError(''); }} onConfirm={decide} />
    <Toast message={toast} onDismiss={() => setToast('')} />
    <ContentDiffModal
      isOpen={diffModalOpen}
      onClose={() => setDiffModalOpen(false)}
      currentPost={selected}
      submitting={submittingAction}
      onApprove={(item) => {
        setDecisionReason('');
        setRejectionReasonCode('');
        setDecisionError('');
        setConfirm({ item, action: 'APPROVE' });
      }}
      onReject={(item, defaultReason) => {
        setDecisionReason(defaultReason || 'Trùng lặp nội dung');
        setRejectionReasonCode('OTHER');
        setDecisionError('');
        setConfirm({ item, action: 'REJECT' });
      }}
    />
    {preview && <span className="moderation-preview-marker" aria-hidden="true">Preview</span>}
  </div>;
}
