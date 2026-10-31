import { Bot, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, FileText, ListOrdered, Maximize2, Search, ShieldCheck, Sparkles, UtensilsCrossed, Video, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { adminApi } from '../../services/adminApi';
import { AdminToolbar, ConfirmDialog, EmptyState, ErrorState, LoadingState, PageHeader, Toast } from '../../components/admin/AdminUi';

const pageSize = 10;
const actions = {
  APPROVE: { title: 'Approve this submission?', label: 'Approve', message: 'Content approved and published.', confirmClass: 'primary' },
  REJECT: { title: 'Reject this submission?', label: 'Reject', message: 'Content rejected.' },
};

const formatDate = (value) => value
  ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
  : 'Date unavailable';

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
  const hasOverview = time || recipe.servings || nutrition.calories != null || recipe.ingredients.length || recipe.steps.length;

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

function ModerationSubmissionContent({ body, recipeExpanded, onToggleRecipe, contentImages, onOpenImage }) {
  const recipe = parseRecipeBody(body);

  if (!recipe) {
    return <section className="moderation-story-section" aria-labelledby="story-title">
      <div className="moderation-section-heading"><h3 id="story-title">The story</h3></div>
      {body ? <p className="moderation-plain-content">{body}</p> : <p className="moderation-no-body">No additional content details are available for this submission.</p>}
      <ContentImageGallery images={contentImages} onOpen={onOpenImage} />
    </section>;
  }

  return <>
    <section className="moderation-story-section" aria-labelledby="story-title">
      <div className="moderation-section-heading"><h3 id="story-title">The story</h3></div>
      {recipe.story ? <p className="moderation-plain-content">{recipe.story}</p> : <p className="moderation-no-body">No story is available for this recipe submission.</p>}
      <ContentImageGallery images={contentImages} onOpen={onOpenImage} />
    </section>
    <RecipeOverview recipe={recipe} expanded={recipeExpanded} onToggle={onToggleRecipe} />
  </>;
}

export default function AdminModerationPage() {
  const preview = import.meta.env.DEV && new URLSearchParams(window.location.search).get('preview') === '1';
  const requestedSelectedId = new URLSearchParams(window.location.search).get('selected');
  const [items, setItems] = useState([]);
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
  const [toast, setToast] = useState('');
  const [recipeExpanded, setRecipeExpanded] = useState(false);
  const [submittingAction, setSubmittingAction] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxZoom, setLightboxZoom] = useState(1);
  const [brokenImages, setBrokenImages] = useState(() => new Set());

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
    setSubmittingAction(true);
    try {
      await adminApi.moderateContent(confirm.item.id, confirm.action);
      setToast(actions[confirm.action].message);
      setConfirm(null);
      setSelectedId(null);
      setRefreshKey((key) => key + 1);
    } catch {
      setConfirm(null);
      setToast('Could not update this submission. Please try again.');
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

  return <div className="moderation-page">
    <PageHeader
      eyebrow="ADMINISTRATION / CONTENT REVIEW"
      title="Content moderation"
      text="Review pending blog and video submissions."
      action={<div className="moderation-count" aria-live="polite"><ShieldCheck size={18} /><strong>{totalElements}</strong><span>pending</span></div>}
    />
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
                {contentImages[0] && !brokenImages.has(contentImages[0])
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

                  <section className={`moderation-ai-review ${selected.aiReason ? (selected.aiFlagged !== false ? 'is-flagged' : 'is-passed') : 'is-empty'}`} aria-labelledby="ai-review-title">
                    <div className="moderation-section-heading">
                      <div className="moderation-ai-heading"><Bot size={16} /><h3 id="ai-review-title">AI Review</h3></div>
                      {selected.aiConfidence != null && <span className="moderation-ai-confidence">Confidence: {Math.round(selected.aiConfidence * 100)}%</span>}
                    </div>
                    {selected.aiReason ? <p>{selected.aiReason}</p> : <p>No AI evaluation is available for this submission.</p>}
                  </section>

                  <ModerationSubmissionContent
                    body={selected.body}
                    recipeExpanded={recipeExpanded}
                    onToggleRecipe={() => setRecipeExpanded((expanded) => !expanded)}
                    contentImages={selected.thumbnailUrl ? contentImages.slice(1) : contentImages}
                    onOpenImage={(index) => openImage(selected.thumbnailUrl ? index + 1 : index)}
                  />

                </div>
                <footer className="moderation-actions">
                  <button type="button" className="admin-btn primary" disabled={submittingAction} onClick={() => setConfirm({ item: selected, action: 'APPROVE' })}><Check size={16} /> Approve</button>
                  <button type="button" className="admin-btn danger" disabled={submittingAction} onClick={() => setConfirm({ item: selected, action: 'REJECT' })}><X size={16} /> Reject</button>
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

    <ConfirmDialog
      dialog={confirm ? {
        title: actions[confirm.action].title,
        text: `This will change the status of “${confirm.item.title}”.`,
        confirm: actions[confirm.action].label,
        confirmClass: actions[confirm.action].confirmClass,
      } : null}
      onClose={() => setConfirm(null)}
      onConfirm={decide}
    />
    <Toast message={toast} onDismiss={() => setToast('')} />
    {preview && <span className="moderation-preview-marker" aria-hidden="true">Preview</span>}
  </div>;
}
