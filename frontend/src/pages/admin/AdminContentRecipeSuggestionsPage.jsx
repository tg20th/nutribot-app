import { AlertTriangle, Check, ChevronLeft, ChevronRight, ExternalLink, Eye, FileText, ListOrdered, MapPin, PlaySquare, Plus, Search, Soup, UserRound, UtensilsCrossed, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AdminToolbar, EmptyState, ErrorState, LoadingState, PageHeader, Toast } from '../../components/admin/AdminUi';
import { contentRecipeSuggestionsApi, isRecipeConsentValid, RECIPE_CONSENT_TERMS_VERSION } from '../../services/contentRecipeSuggestionsApi';
import { getPost } from '../../services/communityApi';
import { getAllergyIngredients } from '../../services/profileApi';
import { adminIngredientApi } from '../../services/adminIngredientApi';
import '../../styles/admin-content-recipe-suggestions.css';

const pageSize = 10;
const slugFromName = (value = '') => value.trim().toLowerCase().replace(/đ/g, 'd').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

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

function ValidationPanel({ validation }) {
  if (!validation) return null;
  const issues = validation.issues ?? [];
  const errors = issues.filter((issue) => issue.severity === 'ERROR');
  const warnings = issues.filter((issue) => issue.severity === 'WARNING');
  const tone = errors.length ? 'is-blocked' : warnings.length ? 'is-warning' : 'is-ready';
  return <section className={`recipe-suggestion-validation ${tone}`} aria-label="Suggestion validation">
    <div className="recipe-suggestion-validation-head">
      <div>
        <span>PRE-APPROVAL CHECK</span>
        <h3>{errors.length ? 'Cannot approve yet' : warnings.length ? 'Review warnings before approving' : 'Ready to approve'}</h3>
      </div>
      {validation.vegetarianType && <span className="recipe-suggestion-vegetarian">{validation.vegetarianType.replaceAll('_', ' ')}</span>}
    </div>
    {errors.length === 0 && warnings.length === 0
      ? <p className="recipe-suggestion-validation-ok"><Check size={15} /> Data validation passed.</p>
      : <ul className="recipe-suggestion-issues">{issues.map((issue, index) => <li key={`${issue.field}-${issue.code}-${index}`} className={`is-${issue.severity.toLowerCase()}`}>
        <span>{issue.severity === 'ERROR' ? <X size={14} /> : <AlertTriangle size={14} />}</span>
        <div><strong>{issue.field || 'Suggestion'}</strong><p>{issue.message}</p></div>
      </li>)}</ul>}
  </section>;
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

function IngredientMatcher({ proposalName, ingredients, value, onChange }) {
  const selected = ingredients.find((item) => String(item.ingredientId) === String(value));
  const [query, setQuery] = useState(selected?.name ?? '');
  const [open, setOpen] = useState(false);
  useEffect(() => { setQuery(selected?.name ?? ''); }, [selected?.name]);
  const matches = ingredients.filter((item) => item.name.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi'))).slice(0, 8);
  const choose = (item) => { onChange(item.ingredientId); setQuery(item.name); setOpen(false); };
  return <div className="recipe-suggestion-ingredient-search"><Search size={16} aria-hidden="true" /><input role="combobox" aria-label={`Catalog match for ${proposalName}`} aria-expanded={open} aria-controls={`ingredient-results-${proposalName}`} autoComplete="off" value={query} placeholder="Search active ingredients..." onFocus={() => setOpen(true)} onChange={(event) => { setQuery(event.target.value); setOpen(true); onChange(''); }} />{value && <button type="button" aria-label={`Clear catalog match for ${proposalName}`} onClick={() => { onChange(''); setQuery(''); setOpen(true); }}><X size={14} /></button>}{open && <div id={`ingredient-results-${proposalName}`} role="listbox" className="recipe-suggestion-ingredient-results">{matches.length ? matches.map((item) => <button type="button" role="option" aria-selected={String(item.ingredientId) === String(value)} key={item.ingredientId} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(item)}>{item.name}</button>) : <p>No active ingredients match this search.</p>}</div>}</div>;
}

function RecipeDetail({ suggestion, showReviewControls, onReview, onOpenSource, submitting, catalogIngredients = [], ingredientMappings = {}, onIngredientMapping, onCreateIngredient }) {
  const { source, dish, recipe, nutrition, ingredients, restaurant, validation } = suggestion;
  const ContentIcon = source.contentType === 'VIDEO' ? PlaySquare : FileText;
  const consentValid = isRecipeConsentValid(source);
  const consentOutdated = source.recipeConsent === true
    && Boolean(source.recipeConsentTermsVersion)
    && source.recipeConsentTermsVersion !== RECIPE_CONSENT_TERMS_VERSION;
  const mappingCodes = ['INGREDIENT_MAPPING_REQUIRED', 'INGREDIENT_MAPPING_AMBIGUOUS', 'INGREDIENT_CATEGORY_INVALID', 'INGREDIENT_MAPPING_DUPLICATED', 'VEGETARIAN_TYPE_UNKNOWN'];
  const errors = (validation?.issues ?? []).filter((issue) => issue.severity === 'ERROR');
  const mappingOnlyBlocked = errors.length > 0 && errors.every((issue) => mappingCodes.includes(issue.code));
  const approvalBlocked = !consentValid || (validation?.canApprove === false && !mappingOnlyBlocked);
  const blockedMessage = !consentValid
    ? (consentOutdated
      ? `Author consented to terms ${source.recipeConsentTermsVersion}; current terms are ${RECIPE_CONSENT_TERMS_VERSION}. The author must consent again.`
      : 'Author consent is required before this suggestion can be approved.')
    : 'Resolve the validation errors before approving this suggestion.';
  return <article className="recipe-suggestion-detail" aria-label="Suggestion detail">
    <header className="recipe-suggestion-detail-head">
      <div><span>REVIEW DETAIL</span><SuggestionStatus status={suggestion.status} /></div>
      <time dateTime={suggestion.createdAt}>Received {formatDate(suggestion.createdAt)}</time>
    </header>

    <div className="recipe-suggestion-detail-body">
      <section className="recipe-suggestion-source">
        <div className="recipe-suggestion-source-heading"><div className="recipe-suggestion-source-type"><ContentIcon size={18} /><span>{source.contentType === 'VIDEO' ? 'Video source' : 'Blog source'}</span></div><span className="recipe-suggestion-source-caption">Original published content</span></div>
        <h2>{source.title}</h2>
        <div className="recipe-suggestion-source-meta">
          <span><UserRound size={14} /> {source.authorName}</span>
          <span><Eye size={14} /> {source.viewCount ?? 0} views</span>
          <span>{source.voteCount ?? 0} votes</span>
          <span className={source.recipeConsent ? 'recipe-suggestion-consent recipe-suggestion-consent--yes' : 'recipe-suggestion-consent recipe-suggestion-consent--no'}>
            {consentValid ? '✓ Consent granted' : consentOutdated ? '! Consent outdated' : '✗ No consent'}
          </span>
        </div>
        <SourceContentLink source={source} onOpenSource={onOpenSource} />
      </section>

      <ValidationPanel validation={validation} />

      {validation?.ingredientResolutions?.some((item) => ['UNRESOLVED', 'AMBIGUOUS', 'INVALID_CATEGORY', 'DUPLICATED'].includes(item.status)) && <section className="recipe-suggestion-section recipe-suggestion-mapping-section" aria-label="Ingredient catalog matching">
        {(() => { const unresolved = validation.ingredientResolutions.filter((item) => ['UNRESOLVED', 'AMBIGUOUS', 'INVALID_CATEGORY', 'DUPLICATED'].includes(item.status)); return <><div className="recipe-suggestion-section-title"><UtensilsCrossed size={17} /><h3>Match ingredients to catalog</h3><span>{unresolved.length} ingredient{unresolved.length === 1 ? '' : 's'} need attention</span></div><p className="recipe-suggestion-mapping-help">Choose an existing catalog ingredient, or create one without leaving this review.</p><div className="recipe-suggestion-mapping-list">{unresolved.map((item) => <div key={item.proposalIndex} className="recipe-suggestion-ingredient-match"><div className="recipe-suggestion-original-ingredient"><small>Original ingredient</small><strong>{item.proposedName}</strong></div><span className="recipe-suggestion-mapping-arrow">Convert to</span><IngredientMatcher proposalName={item.proposedName} ingredients={catalogIngredients} value={ingredientMappings[item.proposalIndex] ?? ''} onChange={(id) => onIngredientMapping?.(item.proposalIndex, id)} /><button type="button" className="recipe-suggestion-create-ingredient" onClick={() => onCreateIngredient?.(item.proposalIndex, item.proposedName)}><Plus size={15} /> Add ingredient</button></div>)}</div></>; })()}
      </section>}

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
      {showReviewControls && suggestion.status === 'PENDING' && <footer className="recipe-suggestion-review-actions"><div><strong>Decision required</strong><span>{approvalBlocked ? blockedMessage : 'Approve to import this dish and recipe, or reject with a reason.'}</span></div><div><button type="button" className="admin-btn secondary recipe-suggestion-reject" disabled={submitting} onClick={() => onReview('REJECT')}><X size={16} /> Reject</button><button type="button" className="admin-btn primary" disabled={submitting || approvalBlocked} title={approvalBlocked ? blockedMessage : undefined} onClick={() => onReview('APPROVE')}><Check size={16} /> Approve suggestion</button></div></footer>}
    </div>
  </article>;
}

function CreateIngredientDialog({ draft, categories, saving, error, onClose, onChange, onSubmit }) {
  if (!draft) return null;
  return <div className="admin-modal-backdrop" onMouseDown={() => !saving && onClose()}>
    <form className="admin-dialog recipe-create-ingredient-dialog" role="dialog" aria-modal="true" aria-labelledby="create-ingredient-title" onSubmit={onSubmit} onMouseDown={(event) => event.stopPropagation()}>
      <p>INGREDIENT CATALOG</p><h2 id="create-ingredient-title">Create missing ingredient</h2>
      <span>Create it now, then it will be selected for this recipe automatically.</span>
      {error && <p className="ingredient-form-error" role="alert">{error}</p>}
      <label>Name<input required maxLength="150" value={draft.name} onChange={(event) => onChange('name', event.target.value)} autoFocus /></label>
      <label>Ingredient category<select required value={draft.categoryId} onChange={(event) => onChange('categoryId', event.target.value)}><option value="">Select a category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
      <label>Description <small>(optional)</small><textarea maxLength="500" value={draft.description} onChange={(event) => onChange('description', event.target.value)} /></label>
      <div><button type="button" className="admin-btn secondary" disabled={saving} onClick={onClose}>Cancel</button><button className="admin-btn primary" disabled={saving}>{saving ? 'Creating...' : 'Create and select'}</button></div>
    </form>
  </div>;
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
  const [reviewIssues, setReviewIssues] = useState([]);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [toast, setToast] = useState('');
  const [source, setSource] = useState(null);
  const [sourcePost, setSourcePost] = useState(null);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceError, setSourceError] = useState(null);
  const [sourceRefresh, setSourceRefresh] = useState(0);
  const [catalogIngredients, setCatalogIngredients] = useState([]);
  const [ingredientMappings, setIngredientMappings] = useState({});
  const [ingredientCategories, setIngredientCategories] = useState([]);
  const [createIngredientDraft, setCreateIngredientDraft] = useState(null);
  const [createIngredientError, setCreateIngredientError] = useState('');
  const [creatingIngredient, setCreatingIngredient] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    getAllergyIngredients(controller.signal).then((items) => { if (!controller.signal.aborted) setCatalogIngredients(Array.isArray(items) ? items : []); })
      .catch(() => { if (!controller.signal.aborted) setCatalogIngredients([]); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    adminIngredientApi.getCategories(controller.signal)
      .then((items) => { if (!controller.signal.aborted) setIngredientCategories(Array.isArray(items) ? items : []); })
      .catch(() => { if (!controller.signal.aborted) setIngredientCategories([]); });
    return () => controller.abort();
  }, []);

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
    setIngredientMappings({});
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
  const openCreateIngredient = (proposalIndex, name) => {
    setCreateIngredientDraft({ proposalIndex, name: name ?? '', slug: slugFromName(name), categoryId: '', description: '' });
    setCreateIngredientError('');
  };
  const changeCreateIngredient = (field, value) => setCreateIngredientDraft((current) => {
    if (!current) return current;
    return { ...current, [field]: value, ...(field === 'name' ? { slug: slugFromName(value) } : {}) };
  });
  const submitCreateIngredient = async (event) => {
    event.preventDefault();
    if (!createIngredientDraft || creatingIngredient) return;
    if (!createIngredientDraft.name.trim() || !createIngredientDraft.slug || !createIngredientDraft.categoryId) {
      setCreateIngredientError('Name and ingredient category are required.');
      return;
    }
    setCreatingIngredient(true);
    setCreateIngredientError('');
    try {
      const created = await adminIngredientApi.createIngredient(createIngredientDraft);
      const option = { ingredientId: created.id, name: created.name };
      setCatalogIngredients((current) => [...current.filter((item) => item.ingredientId !== option.ingredientId), option].sort((a, b) => a.name.localeCompare(b.name, 'vi')));
      setIngredientMappings((current) => ({ ...current, [createIngredientDraft.proposalIndex]: String(option.ingredientId) }));
      setCreateIngredientDraft(null);
      setToast(`Created and selected “${created.name}”.`);
    } catch (requestError) {
      setCreateIngredientError(requestError.message || 'Could not create this ingredient.');
    } finally { setCreatingIngredient(false); }
  };
  const openReview = (action) => {
    const errors = (detail?.validation?.issues ?? []).filter((issue) => issue.severity === 'ERROR');
    const mappingOnlyBlocked = errors.length > 0 && errors.every((issue) => ['INGREDIENT_MAPPING_REQUIRED', 'INGREDIENT_MAPPING_AMBIGUOUS', 'INGREDIENT_CATEGORY_INVALID', 'INGREDIENT_MAPPING_DUPLICATED', 'VEGETARIAN_TYPE_UNKNOWN'].includes(issue.code));
    if (action === 'APPROVE' && detail?.status === 'PENDING'
      && (!isRecipeConsentValid(detail.source) || (detail.validation?.canApprove === false && !mappingOnlyBlocked))) {
      setToast('This suggestion cannot be approved until consent and validation checks pass.');
      return;
    }
    setReviewDialog(action);
    setReviewReason('');
    setReviewError('');
    setReviewIssues([]);
  };
  const closeReview = () => { if (!submittingReview) setReviewDialog(null); };
  const openSource = (sourceInfo, fallback) => setSource({ contentId: sourceInfo.contentId, contentType: sourceInfo.contentType, fallback });
  const closeSource = () => setSource(null);
  const submitReview = async () => {
    if (!selectedId || !reviewDialog || submittingReview) return;
    if (reviewDialog === 'REJECT' && !reviewReason.trim()) { setReviewError('Enter a reason before rejecting this suggestion.'); return; }
    setSubmittingReview(true);
    setReviewError('');
    setReviewIssues([]);
    try {
      const mappings = Object.entries(ingredientMappings).filter(([, id]) => id).map(([proposalIndex, ingredientId]) => ({ proposalIndex: Number(proposalIndex), ingredientId: Number(ingredientId) }));
      const updated = await contentRecipeSuggestionsApi.review(selectedId, reviewDialog, reviewReason, mappings);
      setDetail(updated);
      setReviewDialog(null);
      setToast(reviewDialog === 'APPROVE' ? 'Suggestion approved.' : 'Suggestion rejected.');
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      const payloadData = requestError?.payload?.data;
      const issues = Array.isArray(payloadData)
        ? payloadData
        : Array.isArray(payloadData?.issues) ? payloadData.issues : [];
      if (requestError?.status === 409 || requestError?.status === 404) {
        setReviewDialog(null);
        setToast(requestError?.message || 'Suggestion changed on the server. The queue has been refreshed.');
        setRefreshKey((value) => value + 1);
      } else {
        setReviewIssues(issues);
        setReviewError(requestError?.message || 'The review could not be saved.');
        if (issues.some((issue) => ['INGREDIENT_MAPPING_REQUIRED', 'INGREDIENT_MAPPING_AMBIGUOUS'].includes(issue.code))) {
          setReviewDialog(null);
          setDetailRefresh((value) => value + 1);
        }
      }
    } finally { setSubmittingReview(false); }
  };

  return <div className="recipe-suggestions-page">
    <PageHeader
      eyebrow="ADMINISTRATION / CONTENT REVIEW"
      title="Recipe suggestions"
      text="Review server-generated dish and recipe proposals from published community content."
      action={<div className="recipe-suggestions-total" aria-live="polite"><Soup size={18} /><div><strong>{result.totalElements}</strong><span>server suggestions</span></div></div>}
    />

    <AdminToolbar className="recipe-suggestions-toolbar" label="Suggestion filters">
      <select className="admin-filter-select" aria-label="Filter suggestions by status" value={status} onChange={(event) => changeStatus(event.target.value)}><option value="">All statuses</option><option value="PENDING">Pending</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option></select>
    </AdminToolbar>

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
                : detail ? <RecipeDetail suggestion={detail} showReviewControls onReview={openReview} onOpenSource={(sourceInfo) => openSource(sourceInfo, detail)} submitting={submittingReview} catalogIngredients={catalogIngredients} ingredientMappings={ingredientMappings} onIngredientMapping={(index, id) => setIngredientMappings((current) => ({ ...current, [index]: id }))} onCreateIngredient={openCreateIngredient} />
                  : selected ? <section className="admin-panel recipe-suggestion-detail-state"><EmptyState title="Suggestion detail is unavailable." text="The source may have changed or is no longer available on the server." /></section> : null}
          </div>}
    {reviewDialog && <div className="admin-modal-backdrop" onMouseDown={closeReview}><section className="admin-dialog recipe-suggestion-review-dialog" role="dialog" aria-modal="true" aria-labelledby="suggestion-review-title" onMouseDown={(event) => event.stopPropagation()}><p>REVIEW</p><h2 id="suggestion-review-title">{reviewDialog === 'APPROVE' ? 'Approve this suggestion?' : 'Reject this suggestion?'}</h2><span>{reviewDialog === 'APPROVE' ? 'The proposed dish and recipe will be imported into the catalog.' : 'State why this proposal should not enter the catalog.'}</span>{reviewDialog === 'REJECT' && <label>Rejection reason<textarea value={reviewReason} onChange={(event) => setReviewReason(event.target.value)} placeholder="Example: nutrition information needs a verifiable source" aria-invalid={Boolean(reviewError)} /></label>}{reviewError && <div className="recipe-suggestion-review-error" role="alert"><strong>{reviewDialog === 'APPROVE' ? 'Approval was blocked' : 'Review failed'}</strong><p>{reviewError}</p>{reviewIssues.length > 0 && <ul>{reviewIssues.map((issue, index) => <li key={`${issue.field}-${issue.code}-${index}`}><b>{issue.field || 'Suggestion'}</b>{issue.message}</li>)}</ul>}</div>}<div><button type="button" className="admin-btn secondary" disabled={submittingReview} onClick={closeReview}>Cancel</button><button type="button" className={`admin-btn ${reviewDialog === 'APPROVE' ? 'primary' : 'danger'}`} disabled={submittingReview} onClick={submitReview}>{submittingReview ? 'Saving...' : reviewDialog === 'APPROVE' ? 'Approve' : 'Reject'}</button></div></section></div>}
    <CreateIngredientDialog draft={createIngredientDraft} categories={ingredientCategories} saving={creatingIngredient} error={createIngredientError} onClose={() => !creatingIngredient && setCreateIngredientDraft(null)} onChange={changeCreateIngredient} onSubmit={submitCreateIngredient} />
    <SourceContentModal open={Boolean(source)} loading={sourceLoading} error={sourceError} post={sourcePost} fallback={source?.fallback} onClose={closeSource} onRetry={() => setSourceRefresh((value) => value + 1)} />
    <Toast message={toast} onDismiss={() => setToast('')} />
    {preview && <span className="recipe-suggestions-preview-marker">Preview data</span>}
  </div>;
}
