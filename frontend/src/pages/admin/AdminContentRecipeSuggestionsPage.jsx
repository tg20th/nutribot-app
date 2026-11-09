import { AlertTriangle, ArrowUpDown, Check, ChefHat, ChevronLeft, ChevronRight, Clock3, ExternalLink, Eye, FileText, Info, ListOrdered, MapPin, PlaySquare, Plus, Search, Soup, UserRound, UsersRound, UtensilsCrossed, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
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
const recipeRejectionReasons = [
  ['INCOMPLETE_RECIPE', 'Incomplete recipe information'],
  ['INCORRECT_INGREDIENTS', 'Incorrect ingredient information'],
  ['INVALID_INSTRUCTIONS', 'Invalid preparation instructions'],
  ['INACCURATE_NUTRITION', 'Inaccurate nutritional information'],
  ['SOURCE_MISMATCH', 'Recipe does not match the source blog'],
  ['DUPLICATE_RECIPE', 'Duplicate or substantially similar recipe'],
  ['DIETARY_REQUIREMENTS', 'Does not meet dietary requirements'],
  ['CONTENT_QUALITY', 'Content quality does not meet standards'],
  ['OTHER', 'Other — specify a reason'],
];
const recipeRejectionReasonMaxLength = 2000;

const groupIngredientValidationIssues = (issues = []) => {
  const groups = new Map();
  issues.forEach((issue) => {
    const isIngredientIssue = /^ingredients\[\d+\]$/.test(issue.field ?? '');
    const key = isIngredientIssue ? `${issue.severity}|${issue.code}|${issue.message}` : null;
    if (!key) {
      groups.set(Symbol(), { issue, count: 1 });
      return;
    }
    const current = groups.get(key);
    groups.set(key, current ? { issue: current.issue, count: current.count + 1 } : { issue, count: 1 });
  });
  return [...groups.values()].map(({ issue, count }) => count > 1
    ? { ...issue, field: `ingredients (${count})` }
    : issue);
};

const validationFieldLabels = {
  'dish.name': 'Dish name',
  'dish.description': 'Dish description',
  'dish.serving': 'Serving information',
  'recipe.title': 'Recipe title',
  'recipe.description': 'Recipe description',
  'recipe.servings': 'Servings',
  'nutrition.calories': 'Calories',
  'nutrition.proteinG': 'Protein',
  'nutrition.carbsG': 'Carbohydrates',
  'nutrition.fatG': 'Total fat',
  'nutrition.fiberG': 'Fiber',
};

const readableValidationField = (field) => validationFieldLabels[field] ?? field ?? 'Suggestion';

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
  const issues = (validation.issues ?? []).filter((issue) => issue.field !== 'dish.serving');
  const displayedIssues = groupIngredientValidationIssues(issues);
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
      : <ul className="recipe-suggestion-issues">{displayedIssues.map((issue, index) => <li key={`${issue.field}-${issue.code}-${index}`} className={`is-${issue.severity.toLowerCase()}`}>
        <span>{issue.severity === 'ERROR' ? <X size={14} /> : <AlertTriangle size={14} />}</span>
        <div><strong>{readableValidationField(issue.field)}</strong><p>{issue.message}</p></div>
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

function IngredientMatcher({ proposalName, ingredients, value, onChange, loading = false }) {
  const selected = ingredients.find((item) => String(item.ingredientId) === String(value));
  const [query, setQuery] = useState(selected?.name ?? '');
  const [open, setOpen] = useState(false);
  useEffect(() => { setQuery(selected?.name ?? ''); }, [selected?.name]);
  const matches = ingredients.filter((item) => item.name.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi')));
  const choose = (item) => { onChange(item.ingredientId); setQuery(item.name); setOpen(false); };
  return <div className="recipe-suggestion-ingredient-search"><Search size={16} aria-hidden="true" /><input role="combobox" aria-label={`Catalog match for ${proposalName}`} aria-expanded={open} aria-controls={`ingredient-results-${proposalName}`} autoComplete="off" value={query} placeholder="Search active ingredients..." onFocus={() => setOpen(true)} onChange={(event) => { setQuery(event.target.value); setOpen(true); onChange(''); }} />{value && <button type="button" aria-label={`Clear catalog match for ${proposalName}`} onClick={() => { onChange(''); setQuery(''); setOpen(true); }}><X size={14} /></button>}{open && <div id={`ingredient-results-${proposalName}`} role="listbox" className="recipe-suggestion-ingredient-results">{loading ? <p>Loading active ingredients...</p> : matches.length ? matches.map((item) => <button type="button" role="option" aria-selected={String(item.ingredientId) === String(value)} key={item.ingredientId} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(item)}>{item.name}</button>) : <p>No active ingredients match this search.</p>}</div>}</div>;
}

function RecipeDetail({ suggestion, showReviewControls, onReview, onOpenSource, submitting, catalogIngredients = [], ingredientMappings = {}, onIngredientMapping, onCreateIngredient, mappingSectionRef }) {
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
  return <article className="admin-panel moderation-detail recipe-suggestion-detail" aria-label="Suggestion detail">
    <header className="moderation-detail-header recipe-suggestion-detail-head">
      <div><span>{source.contentType === 'VIDEO' ? 'VIDEO SUBMISSION' : 'BLOG SUBMISSION'}</span><SuggestionStatus status={suggestion.status} /></div>
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

      {validation?.ingredientResolutions?.some((item) => ['UNRESOLVED', 'AMBIGUOUS', 'INVALID_CATEGORY', 'DUPLICATED'].includes(item.status)) && <section ref={mappingSectionRef} className="recipe-suggestion-section recipe-suggestion-mapping-section" aria-label="Ingredient catalog matching">
        {(() => { const unresolved = validation.ingredientResolutions.filter((item) => ['UNRESOLVED', 'AMBIGUOUS', 'INVALID_CATEGORY', 'DUPLICATED'].includes(item.status)); return <><div className="recipe-suggestion-section-title"><UtensilsCrossed size={17} /><h3>Match ingredients to catalog</h3><span>{unresolved.length} ingredient{unresolved.length === 1 ? '' : 's'} need attention</span></div><p className="recipe-suggestion-mapping-help">Choose an existing catalog ingredient, or create one without leaving this review.</p><div className="recipe-suggestion-mapping-list">{unresolved.map((item) => <div key={item.proposalIndex} className="recipe-suggestion-ingredient-match"><div className="recipe-suggestion-original-ingredient"><small>Original ingredient</small><strong>{item.proposedName}</strong></div><span className="recipe-suggestion-mapping-arrow">Convert to</span><IngredientMatcher proposalName={item.proposedName} ingredients={catalogIngredients} loading={catalogIngredientsLoading} value={ingredientMappings[item.proposalIndex] ?? ''} onChange={(id) => onIngredientMapping?.(item.proposalIndex, id)} /><button type="button" className="recipe-suggestion-create-ingredient" onClick={() => onCreateIngredient?.(item.proposalIndex, item.proposedName)}><Plus size={15} /> Add ingredient</button></div>)}</div></>; })()}
      </section>}

      <section className="recipe-suggestion-section">
        <div className="recipe-suggestion-section-title"><Soup size={17} /><h3>Proposed dish</h3><span>Catalog candidate</span></div>
        <h4>{dish.name}</h4>
        {dish.description && <p>{dish.description}</p>}
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
        <div className="recipe-suggestion-recipe-meta" aria-label="Serving information">
          {recipe.prepTimeMin && <span>Prep {recipe.prepTimeMin} min</span>}
          {recipe.cookTimeMin && <span>Cook {recipe.cookTimeMin} min</span>}
          {dish.servingSize && <span>Serving size {dish.servingSize}</span>}
          {dish.servingUnit && <span>Unit {dish.servingUnit}</span>}
          {recipe.servings && <span>{recipe.servings} servings</span>}
        </div>
        {recipe.description && <p>{recipe.description}</p>}
        {recipe.steps.length ? <ol className="recipe-suggestion-steps">{recipe.steps.map((step, index) => <li key={`${step}-${index}`}>{step}</li>)}</ol> : <p className="recipe-suggestion-missing">No recipe steps were supplied by the server.</p>}
      </section>

      {(restaurant.name || restaurant.address || restaurant.reference) && <section className="recipe-suggestion-restaurant"><MapPin size={17} /><div><h3>Restaurant reference</h3>{restaurant.name && <strong>{restaurant.name}</strong>}{restaurant.address && <p>{restaurant.address}</p>}{restaurant.reference && <a href={restaurant.reference} target="_blank" rel="noreferrer">Open restaurant reference <ExternalLink size={13} /></a>}</div></section>}

      {showReviewControls && suggestion.status === 'PENDING' && <footer className="moderation-actions recipe-suggestion-review-actions"><div><strong>Decision required</strong><span>{approvalBlocked ? blockedMessage : 'Approve to import this dish and recipe, or reject with a reason.'}</span></div><div><button type="button" className="admin-btn secondary recipe-suggestion-reject" disabled={submitting} onClick={() => onReview('REJECT')}><X size={16} /> Reject</button><button type="button" className="admin-btn primary" disabled={submitting || approvalBlocked} title={approvalBlocked ? blockedMessage : undefined} onClick={() => onReview('APPROVE')}><Check size={16} /> Approve suggestion</button></div></footer>}
    </div>
  </article>;
}

function RecipeSuggestionMetadata({ totalMinutes, servings, ingredientCount, stepCount }) {
  return <div className="recipe-suggestion-metadata" aria-label="Recipe summary">
    <span className="recipe-suggestion-metadata__item"><Clock3 size={15} /><b>{totalMinutes > 0 ? `${totalMinutes} min` : '—'}</b><small>Total time</small></span>
    <span className="recipe-suggestion-metadata__item"><UsersRound size={15} /><b>{servings ?? '—'}</b><small>Servings</small></span>
    <span className="recipe-suggestion-metadata__item"><UtensilsCrossed size={15} /><b>{ingredientCount}</b><small>Ingredients</small></span>
    <span className="recipe-suggestion-metadata__item"><ListOrdered size={15} /><b>{stepCount}</b><small>Steps</small></span>
  </div>;
}

function EditorialRecipeDetail({ suggestion, showReviewControls, onReview, onOpenSource, sourceImage, submitting, catalogIngredients = [], catalogIngredientsLoading = false, ingredientMappings = {}, onIngredientMapping, onCreateIngredient, mappingSectionRef }) {
  const { source, dish, recipe, nutrition, ingredients, restaurant, validation } = suggestion;
  const consentValid = isRecipeConsentValid(source);
  const consentOutdated = source.recipeConsent === true && Boolean(source.recipeConsentTermsVersion) && source.recipeConsentTermsVersion !== RECIPE_CONSENT_TERMS_VERSION;
  const errors = (validation?.issues ?? []).filter((issue) => issue.severity === 'ERROR');
  const warnings = (validation?.issues ?? []).filter((issue) => issue.severity === 'WARNING');
  const mappingCodes = ['INGREDIENT_MAPPING_REQUIRED', 'INGREDIENT_MAPPING_AMBIGUOUS', 'INGREDIENT_CATEGORY_INVALID', 'INGREDIENT_MAPPING_DUPLICATED', 'VEGETARIAN_TYPE_UNKNOWN'];
  const mappingOnlyBlocked = errors.length > 0 && errors.every((issue) => mappingCodes.includes(issue.code));
  const approvalBlocked = !consentValid || (validation?.canApprove === false && !mappingOnlyBlocked);
  const blockedMessage = !consentValid ? (consentOutdated ? `Author consented to terms ${source.recipeConsentTermsVersion}; current terms are ${RECIPE_CONSENT_TERMS_VERSION}. The author must consent again.` : 'Author consent is required before this suggestion can be approved.') : 'Resolve the validation errors before approving this suggestion.';
  const unresolved = validation?.ingredientResolutions?.filter((item) => ['UNRESOLVED', 'AMBIGUOUS', 'INVALID_CATEGORY', 'DUPLICATED'].includes(item.status)) ?? [];
  const totalMinutes = (recipe.prepTimeMin ?? 0) + (recipe.cookTimeMin ?? 0);
  const validationTone = errors.length ? 'is-blocked' : warnings.length ? 'is-warning' : 'is-ready';
  const validationIssues = (validation?.issues ?? []).filter((issue) => issue.field !== 'dish.serving');
  const displayedValidationIssues = groupIngredientValidationIssues(validationIssues);
  return <article className="admin-panel moderation-detail recipe-suggestion-detail" aria-label="Suggestion detail">
    <header className="moderation-detail-header recipe-suggestion-detail-head"><div><span>RECIPE SUGGESTION</span><SuggestionStatus status={suggestion.status} /></div><time dateTime={suggestion.createdAt}>Received {formatDate(suggestion.createdAt)}</time></header>
    <div className="recipe-suggestion-detail-body">
      <section className="recipe-suggestion-hero" aria-labelledby="proposed-dish-title"><div className="recipe-suggestion-hero-top"><div className="recipe-suggestion-hero-copy"><div className="recipe-suggestion-kicker"><ChefHat size={16} /><span>PROPOSED DISH</span></div><h2 id="proposed-dish-title">{dish.name}</h2>{dish.description && <p className="recipe-suggestion-hero-description">{dish.description}</p>}<div className={`recipe-suggestion-validation-compact ${validationTone}`}><span className="recipe-suggestion-validation-dot" /><strong>{errors.length ? 'Validation needs attention' : warnings.length ? 'Validation warnings' : validation?.valid === true ? 'Validation confirmed' : 'Validation not confirmed'}</strong><span className={consentValid ? 'recipe-suggestion-consent recipe-suggestion-consent--yes' : 'recipe-suggestion-consent recipe-suggestion-consent--no'}>{consentValid ? '✓ Consent granted' : consentOutdated ? '! Consent outdated' : '✗ No consent'}</span>{validation?.vegetarianType && <span className="recipe-suggestion-diet">{validation.vegetarianType.replaceAll('_', ' ')}</span>}<button type="button" className="recipe-suggestion-source-toggle" aria-haspopup="dialog" onClick={() => onOpenSource(source)}><FileText size={14} /> View source blog</button></div>{displayedValidationIssues.length > 0 && <ul className="recipe-suggestion-compact-issues">{displayedValidationIssues.map((issue, index) => <li key={`${issue.field}-${issue.code}-${index}`} className={`is-${issue.severity.toLowerCase()}`}><span>{issue.severity === 'ERROR' ? <X size={13} /> : <AlertTriangle size={13} />}</span><div><b>{readableValidationField(issue.field)}</b><span>{issue.message}</span></div></li>)}</ul>}</div>{sourceImage && <img className="recipe-suggestion-hero-image" src={sourceImage} alt={`${dish.name} proposed dish`} />}</div><RecipeSuggestionMetadata totalMinutes={totalMinutes} servings={recipe.servings} ingredientCount={ingredients.length} stepCount={recipe.steps.length} /></section>
      <section className="recipe-suggestion-section recipe-suggestion-nutrition-section" aria-labelledby="nutrition-title"><div className="recipe-suggestion-section-title"><Soup size={17} /><h3 id="nutrition-title">Nutrition</h3><span>{recipe.servings ? `Per ${recipe.servings === 1 ? 'serving' : 'recipe'}` : 'Available values'}</span></div><NutritionGrid nutrition={nutrition} /></section>
      <section className="recipe-suggestion-section" aria-labelledby="ingredients-title"><div className="recipe-suggestion-section-title"><UtensilsCrossed size={17} /><h3 id="ingredients-title">Ingredients</h3></div>{ingredients.length ? <ul className="recipe-suggestion-ingredients">{ingredients.map((ingredient, index) => <li key={`${ingredient.name}-${index}`}><span>{ingredient.name}</span><small>{[ingredient.quantity, ingredient.unit].filter(Boolean).join(' ') || ingredient.notes || 'Quantity unavailable'}</small></li>)}</ul> : <p className="recipe-suggestion-missing">No ingredients were supplied by the server.</p>}{unresolved.length > 0 && <section ref={mappingSectionRef} className="recipe-suggestion-mapping-section" aria-label="Ingredient catalog matching"><div className="recipe-suggestion-section-title"><UtensilsCrossed size={16} /><h3>Match ingredients to catalog</h3><span>{unresolved.length} need attention</span></div><p className="recipe-suggestion-mapping-help">Choose an existing catalog ingredient, or create one without leaving this review.</p><div className="recipe-suggestion-mapping-list">{unresolved.map((item) => <div key={item.proposalIndex} className="recipe-suggestion-ingredient-match"><div className="recipe-suggestion-original-ingredient"><small>Original ingredient</small><strong>{item.proposedName}</strong></div><span className="recipe-suggestion-mapping-arrow">Convert to</span><IngredientMatcher proposalName={item.proposedName} ingredients={catalogIngredients} loading={catalogIngredientsLoading} value={ingredientMappings[item.proposalIndex] ?? ''} onChange={(id) => onIngredientMapping?.(item.proposalIndex, id)} /><button type="button" className="recipe-suggestion-create-ingredient" onClick={() => onCreateIngredient?.(item.proposalIndex, item.proposedName)}><Plus size={15} /> Add ingredient</button></div>)}</div></section>}</section>
      <section className="recipe-suggestion-section" aria-labelledby="steps-title"><div className="recipe-suggestion-section-title"><ListOrdered size={17} /><h3 id="steps-title">Preparation Steps</h3></div>{recipe.description && <p className="recipe-suggestion-recipe-description">{recipe.description}</p>}{recipe.steps.length ? <ol className="recipe-suggestion-steps">{recipe.steps.map((step, index) => <li key={`${step}-${index}`}><span className="recipe-suggestion-step-number">{index + 1}</span><p>{step}</p></li>)}</ol> : <p className="recipe-suggestion-missing">No recipe steps were supplied by the server.</p>}</section>
      {(restaurant.name || restaurant.address || restaurant.reference) && <div className="recipe-suggestion-restaurant-note recipe-suggestion-restaurant-inline"><MapPin size={14} /> {restaurant.name || restaurant.address}{restaurant.reference && <a href={restaurant.reference} target="_blank" rel="noreferrer">Open restaurant reference <ExternalLink size={13} /></a>}</div>}
      {showReviewControls && suggestion.status === 'PENDING' && <footer className="moderation-actions recipe-suggestion-review-actions"><div><strong>Decision required</strong><span>{approvalBlocked ? blockedMessage : 'Approve to import this dish and recipe, or reject with a reason.'}</span></div><div><button type="button" className="admin-btn secondary recipe-suggestion-reject" disabled={submitting} onClick={() => onReview('REJECT')}><X size={16} /> Reject</button><button type="button" className="admin-btn primary" disabled={submitting || approvalBlocked} title={approvalBlocked ? blockedMessage : undefined} onClick={() => onReview('APPROVE')}><Check size={16} /> Approve suggestion</button></div></footer>}
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

function ReviewDecisionDialog({ submitting, error, issues, onClose, onSubmit }) {
  return <div className="admin-modal-backdrop" onMouseDown={onClose}><section className="admin-dialog recipe-review-dialog" role="dialog" aria-modal="true" aria-labelledby="suggestion-review-title" onMouseDown={(event) => event.stopPropagation()}>
    <header className="recipe-dialog-header"><p>REVIEW</p><button type="button" className="recipe-dialog-close" onClick={onClose} disabled={submitting} aria-label="Close approval dialog"><X size={18} /></button></header>
    <div className="recipe-dialog-body"><h2 id="suggestion-review-title">Approve this suggestion?</h2><p>This recipe will be imported into the catalog after approval.</p><p className="recipe-dialog-note"><Info size={14} /> Please confirm that the recipe details have been reviewed.</p>{error && <div className="recipe-suggestion-review-error" role="alert"><strong>Approval was blocked</strong><p>{error}</p>{issues.length > 0 && <ul>{issues.map((issue, index) => <li key={`${issue.field}-${issue.code}-${index}`}><b>{readableValidationField(issue.field)}</b><span>{issue.message}</span></li>)}</ul>}</div>}</div><div className="recipe-dialog-divider" />
    <footer className="recipe-dialog-footer"><button type="button" className="admin-btn secondary" disabled={submitting} onClick={onClose}>Cancel</button><button type="button" className="admin-btn primary" disabled={submitting} onClick={onSubmit}>{submitting ? 'Saving...' : 'Approve'}</button></footer>
  </section></div>;
}

function RejectionDialog({ reasonCode, reason, error, submitting, onReasonCodeChange, onReasonChange, onClose, onConfirm }) {
  const isOther = reasonCode === 'OTHER';
  const valid = Boolean(reasonCode) && (!isOther || Boolean(reason.trim()));
  return <div className="admin-modal-backdrop" onMouseDown={onClose}><form className="admin-dialog recipe-review-dialog recipe-suggestion-rejection-dialog" role="dialog" aria-modal="true" aria-labelledby="recipe-rejection-title" onSubmit={(event) => { event.preventDefault(); if (valid) onConfirm(); }} onMouseDown={(event) => event.stopPropagation()}>
    <header className="recipe-dialog-header"><p>REVIEW DECISION</p><button type="button" className="recipe-dialog-close" onClick={onClose} disabled={submitting} aria-label="Close rejection dialog"><X size={18} /></button></header>
    <div className="recipe-dialog-body"><h2 id="recipe-rejection-title">Reject recipe suggestion</h2><p>Choose a reason for rejecting this recipe.</p>
      <label htmlFor="recipe-rejection-reason">Rejection reason<select id="recipe-rejection-reason" value={reasonCode} disabled={submitting} onChange={(event) => onReasonCodeChange(event.target.value)}><option value="">Select a reason</option>{recipeRejectionReasons.map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></label>
      {isOther && <label htmlFor="recipe-rejection-custom">Specify rejection reason<textarea id="recipe-rejection-custom" maxLength={recipeRejectionReasonMaxLength} value={reason} disabled={submitting} onChange={(event) => onReasonChange(event.target.value)} placeholder="Explain why this recipe should be rejected..." aria-invalid={Boolean(error)} /><small>{reason.length}/{recipeRejectionReasonMaxLength}</small></label>}
      {error && <div className="recipe-suggestion-review-error" role="alert"><strong>Rejection could not be submitted</strong><p>{error}</p></div>}
    </div>
    <footer className="recipe-dialog-footer"><button type="button" className="admin-btn secondary" disabled={submitting} onClick={onClose}>Cancel</button><button type="submit" className="admin-btn danger" disabled={!valid || submitting}>{submitting ? 'Rejecting...' : 'Confirm rejection'}</button></footer>
  </form></div>;
}

export default function AdminContentRecipeSuggestionsPage() {
  const preview = import.meta.env.DEV && new URLSearchParams(window.location.search).get('preview') === '1';
  const [workspace, setWorkspace] = useState('QUEUE');
  const [status, setStatus] = useState('PENDING');
  const [historyQuery, setHistoryQuery] = useState('');
  const [queueQuery, setQueueQuery] = useState('');
  const [queueContentType, setQueueContentType] = useState('');
  const [sortDirection, setSortDirection] = useState('desc');
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
  const [rejectionDialog, setRejectionDialog] = useState(false);
  const [rejectionReasonCode, setRejectionReasonCode] = useState('');
  const [reviewReason, setReviewReason] = useState('');
  const [reviewError, setReviewError] = useState('');
  const [reviewIssues, setReviewIssues] = useState([]);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [toast, setToast] = useState('');
  const [source, setSource] = useState(null);
  const [sourcePost, setSourcePost] = useState(null);
  const [sourcePreviewPost, setSourcePreviewPost] = useState(null);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceError, setSourceError] = useState(null);
  const [sourceRefresh, setSourceRefresh] = useState(0);
  useEffect(() => {
    if (!source) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [source]);

  useEffect(() => {
    if (!reviewDialog && !rejectionDialog) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape' && !submittingReview) {
        if (reviewDialog) closeReview();
        else closeRejection();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [reviewDialog, rejectionDialog, submittingReview]);
  const [catalogIngredients, setCatalogIngredients] = useState([]);
  const [catalogIngredientsLoading, setCatalogIngredientsLoading] = useState(true);
  const [ingredientMappings, setIngredientMappings] = useState({});
  const mappingSectionRef = useRef(null);
  const [ingredientCategories, setIngredientCategories] = useState([]);
  const [createIngredientDraft, setCreateIngredientDraft] = useState(null);
  const [createIngredientError, setCreateIngredientError] = useState('');
  const [creatingIngredient, setCreatingIngredient] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setCatalogIngredientsLoading(true);
    getAllergyIngredients(controller.signal).then((items) => { if (!controller.signal.aborted) setCatalogIngredients(Array.isArray(items) ? items : []); })
      .catch(() => { if (!controller.signal.aborted) setCatalogIngredients([]); })
      .finally(() => { if (!controller.signal.aborted) setCatalogIngredientsLoading(false); });
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
        setSelectedId((current) => {
          if (workspace !== 'QUEUE') return next.content.some((item) => item.suggestionId === current) ? current : null;
          return next.content.some((item) => item.suggestionId === current) ? current : next.content[0]?.suggestionId ?? null;
        });
      })
      .catch(() => { if (!controller.signal.aborted) { setResult({ content: [], totalElements: 0, totalPages: 0 }); setSelectedId(null); setError(true); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page, refreshKey, status, workspace]);

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
    if (!detail?.source?.contentId) { setSourcePreviewPost(null); return undefined; }
    const controller = new AbortController();
    getPost(detail.source.contentId, controller.signal, detail.source.contentType)
      .then((next) => { if (!controller.signal.aborted) setSourcePreviewPost(next); })
      .catch(() => { if (!controller.signal.aborted) setSourcePreviewPost(null); });
    return () => controller.abort();
  }, [detail]);

  useEffect(() => {
    if (!source) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') setSource(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [source]);

  const sortedSuggestions = useMemo(() => [...result.content].sort((left, right) => {
    const leftTime = new Date(left.createdAt ?? 0).getTime();
    const rightTime = new Date(right.createdAt ?? 0).getTime();
    return sortDirection === 'desc' ? rightTime - leftTime : leftTime - rightTime;
  }), [result.content, sortDirection]);
  const visibleSuggestions = useMemo(() => {
    const query = historyQuery.trim().toLocaleLowerCase('vi');
    if (workspace === 'QUEUE') {
      const queueSearch = queueQuery.trim().toLocaleLowerCase('vi');
      return sortedSuggestions.filter((item) => (!queueContentType || item.source.contentType === queueContentType)
        && (!queueSearch || [item.source.title, item.source.authorName, item.dish.name]
          .some((value) => String(value ?? '').toLocaleLowerCase('vi').includes(queueSearch))));
    }
    const reviewedSuggestions = sortedSuggestions.filter((item) => item.status !== 'PENDING');
    if (!query) return reviewedSuggestions;
    return reviewedSuggestions.filter((item) => [item.source.title, item.source.authorName, item.dish.name, item.suggestionId]
      .some((value) => String(value ?? '').toLocaleLowerCase('vi').includes(query)));
  }, [historyQuery, queueContentType, queueQuery, sortedSuggestions, workspace]);
  const selected = useMemo(() => sortedSuggestions.find((item) => item.suggestionId === selectedId) ?? null, [sortedSuggestions, selectedId]);
  const isQueue = workspace === 'QUEUE';
  const changeStatus = (nextStatus) => { setStatus(nextStatus); setPage(1); setSelectedId(null); };
  const changeWorkspace = (nextWorkspace) => {
    setWorkspace(nextWorkspace);
    setHistoryQuery('');
    setQueueQuery('');
    setQueueContentType('');
    changeStatus(nextWorkspace === 'QUEUE' ? 'PENDING' : '');
  };
  const workspaceTitle = isQueue ? 'Recipe suggestions' : 'Recipe suggestion history';
  const workspaceText = isQueue
    ? 'Assess pending community recipes, resolve validation issues, then approve or reject.'
    : 'Review completed approvals and rejections without interrupting the active queue.';
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
    const unresolvedIngredients = (detail?.validation?.ingredientResolutions ?? [])
      .filter((item) => ['UNRESOLVED', 'AMBIGUOUS', 'INVALID_CATEGORY', 'DUPLICATED'].includes(item.status));
    const hasUnmappedIngredients = unresolvedIngredients.some((item) => !ingredientMappings[item.proposalIndex]);
    if (action === 'APPROVE' && hasUnmappedIngredients) {
      setToast('Map an existing ingredient or add the missing ingredient before approving.');
      mappingSectionRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (action === 'APPROVE' && detail?.status === 'PENDING'
      && (!isRecipeConsentValid(detail.source) || (detail.validation?.canApprove === false && !mappingOnlyBlocked))) {
      setToast('This suggestion cannot be approved until consent and validation checks pass.');
      return;
    }
    if (action === 'REJECT') {
      setRejectionDialog(true);
      setRejectionReasonCode('');
      setReviewReason('');
      setReviewError('');
      setReviewIssues([]);
      return;
    }
    setReviewDialog(action);
    setReviewReason('');
    setReviewError('');
    setReviewIssues([]);
  };
  const closeReview = () => { if (!submittingReview) setReviewDialog(null); };
  const closeRejection = () => { if (!submittingReview) setRejectionDialog(false); };
  const openSource = (sourceInfo, fallback) => setSource({ contentId: sourceInfo.contentId, contentType: sourceInfo.contentType, fallback });
  const closeSource = () => setSource(null);
  const submitReview = async (actionOverride = reviewDialog, reasonOverride = reviewReason) => {
    if (!selectedId || !actionOverride || submittingReview) return;
    if (actionOverride === 'REJECT' && !reasonOverride.trim()) { setReviewError('Enter a reason before rejecting this suggestion.'); return; }
    setSubmittingReview(true);
    setReviewError('');
    setReviewIssues([]);
    try {
      const mappings = Object.entries(ingredientMappings).filter(([, id]) => id).map(([proposalIndex, ingredientId]) => ({ proposalIndex: Number(proposalIndex), ingredientId: Number(ingredientId) }));
      const updated = await contentRecipeSuggestionsApi.review(selectedId, actionOverride, reasonOverride, mappings);
      setDetail(updated);
      setReviewDialog(null);
      setRejectionDialog(false);
      setToast(actionOverride === 'APPROVE' ? 'Suggestion approved.' : 'Suggestion rejected.');
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
  const confirmRejection = () => {
    const selectedLabel = recipeRejectionReasons.find(([code]) => code === rejectionReasonCode)?.[1] ?? '';
    const reason = rejectionReasonCode === 'OTHER' ? reviewReason.trim() : selectedLabel;
    if (!rejectionReasonCode || (rejectionReasonCode === 'OTHER' && !reason)) {
      setReviewError('Select a reason before rejecting this suggestion.');
      return;
    }
    submitReview('REJECT', reason);
  };

  return <div className="moderation-page recipe-suggestions-page">
    <PageHeader
      eyebrow="ADMINISTRATION / CONTENT REVIEW"
      title={workspaceTitle}
      text={workspaceText}
      action={<div className="recipe-suggestions-total" aria-live="polite"><Soup size={18} /><div><strong>{result.totalElements}</strong><span>{isQueue ? 'awaiting review' : 'completed records'}</span></div></div>}
    />

    <section className="recipe-suggestions-workspace" aria-label="Recipe suggestion workspace">
      <nav className="moderation-workspace-tabs recipe-suggestions-tabs" aria-label="Recipe suggestion views">
        <button type="button" aria-current={isQueue ? 'page' : undefined} className={isQueue ? 'is-active' : ''} onClick={() => changeWorkspace('QUEUE')}>Review Queue</button>
        <button type="button" aria-current={!isQueue ? 'page' : undefined} className={!isQueue ? 'is-active' : ''} onClick={() => changeWorkspace('HISTORY')}>History</button>
      </nav>
      {isQueue && <AdminToolbar className="recipe-suggestions-toolbar" label="Suggestion filters">
        <label className="admin-search moderation-search" aria-label="Search pending recipe suggestions"><Search size={17} aria-hidden="true" /><input aria-label="Search pending recipe suggestions" value={queueQuery} onChange={(event) => setQueueQuery(event.target.value)} placeholder="Search title or author on this page..." />{queueQuery && <button type="button" onClick={() => setQueueQuery('')} aria-label="Clear pending recipe search"><X size={15} /></button>}</label>
        <div className="moderation-type-filter"><select className="admin-filter-select" aria-label="Recipe source type" value={queueContentType} onChange={(event) => setQueueContentType(event.target.value)}><option value="">All content</option><option value="BLOG">Blogs</option><option value="VIDEO">Videos</option></select></div>
      </AdminToolbar>}
    </section>

    {loading ? <section className="admin-panel recipe-suggestions-state"><LoadingState /></section>
      : error ? <section className="admin-panel recipe-suggestions-state"><ErrorState onRetry={retry} /></section>
        : !visibleSuggestions.length ? <section className="admin-panel recipe-suggestions-state"><EmptyState title={isQueue ? 'The review queue is clear.' : 'No history matches this filter.'} text={isQueue ? 'Eligible community content will appear here when the server creates a proposal.' : 'Try another decision filter or search term to see completed reviews.'} /></section>
          : !isQueue ? <>
            <section className="moderation-history-workspace recipe-suggestion-history-workspace" aria-label="Recipe review history controls">
              <div className="moderation-history-primary">
                <label className="moderation-history-search"><Search size={17} aria-hidden="true" /><input aria-label="Search recipe review history" value={historyQuery} onChange={(event) => setHistoryQuery(event.target.value)} placeholder="Search recipe, author or ID" />{historyQuery && <button type="button" onClick={() => setHistoryQuery('')} aria-label="Clear recipe history search"><X size={15} /></button>}</label>
                <div className="moderation-history-toolbar-controls"><label className="moderation-decision-dropdown"><span>Decision</span><select aria-label="Filter review history by decision" value={status} onChange={(event) => changeStatus(event.target.value)}><option value="">All decisions</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option></select></label><button type="button" className="recipe-suggestions-sort" onClick={() => setSortDirection((value) => value === 'desc' ? 'asc' : 'desc')} aria-label={sortDirection === 'desc' ? 'Sort by oldest first' : 'Sort by newest first'}><ArrowUpDown size={16} /><span>{sortDirection === 'desc' ? 'Newest' : 'Oldest'}</span></button></div>
              </div>
            </section>
            <section className="moderation-history-list recipe-suggestion-history-list" aria-label="Recipe review history">
              {visibleSuggestions.map((item) => {
                const approved = item.status === 'APPROVED';
                const Icon = item.source.contentType === 'VIDEO' ? PlaySquare : FileText;
                return <button className="moderation-history-row" type="button" key={item.suggestionId} onClick={() => setSelectedId(item.suggestionId)}>
                  <span className="moderation-history-content"><span className="moderation-history-type-icon"><Icon size={16} /></span><span><b>{item.source.title}</b><small>{item.source.contentType === 'VIDEO' ? 'Video' : 'Blog'} <i>/</i> @{item.source.authorName} <i>/</i> #{item.suggestionId}</small><em>{item.dish.name}</em></span></span>
                  <span className="moderation-history-trailing"><span className={approved ? 'moderation-decision approved' : 'moderation-decision rejected'}>{approved ? <Check size={16} /> : <X size={16} />}{approved ? 'Approved' : 'Rejected'}</span><time dateTime={item.reviewedAt || item.createdAt}>{formatDate(item.reviewedAt || item.createdAt)}</time><ChevronRight className="moderation-history-chevron" size={17} /></span>
                </button>;
              })}
              {result.totalPages > 1 && <nav className="moderation-pagination recipe-suggestion-history-pagination" aria-label="Recipe history pagination"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} aria-label="Previous page"><ChevronLeft size={17} /></button><span>{page} / {result.totalPages}</span><button type="button" disabled={page >= result.totalPages} onClick={() => setPage((value) => value + 1)} aria-label="Next page"><ChevronRight size={17} /></button></nav>}
            </section>
          </>
          : <div className="moderation-board recipe-suggestions-board">
            <section className="admin-panel moderation-queue recipe-suggestions-list" aria-label="Content recipe suggestions">
              <header><h2>Review queue</h2><span>{visibleSuggestions.length} shown</span></header>
              <div>{visibleSuggestions.map((item) => {
                const active = item.suggestionId === selectedId;
                const Icon = item.source.contentType === 'VIDEO' ? PlaySquare : FileText;
                return <button key={item.suggestionId} type="button" className={active ? 'moderation-queue-item recipe-suggestion-row is-active' : 'moderation-queue-item recipe-suggestion-row'} onClick={() => setSelectedId(item.suggestionId)} aria-pressed={active}>
                  <span className="moderation-type-icon recipe-suggestion-row-icon"><Icon size={18} /></span><span className="moderation-queue-copy recipe-suggestion-row-copy"><strong>{item.source.title}</strong><small>{item.source.contentType === 'VIDEO' ? 'Video' : 'Blog'} <i>/</i> @{item.source.authorName}</small><time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time></span><span className="moderation-queue-badges"><SuggestionStatus status={item.status} /></span>
                </button>;
              })}</div>
              {result.totalPages > 1 && <nav className="recipe-suggestion-pagination" aria-label="Suggestion pagination"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} aria-label="Previous page"><ChevronLeft size={16} /></button><span>Page {page} of {result.totalPages}</span><button type="button" disabled={page >= result.totalPages} onClick={() => setPage((value) => value + 1)} aria-label="Next page"><ChevronRight size={16} /></button></nav>}
            </section>
            {detailLoading ? <section className="admin-panel recipe-suggestion-detail-state"><LoadingState /></section>
              : detailError ? <section className="admin-panel recipe-suggestion-detail-state"><ErrorState onRetry={() => setDetailRefresh((value) => value + 1)} /></section>
                : detailUnavailable ? <section className="admin-panel recipe-suggestion-detail-state"><EmptyState title="Suggestion is no longer available." text="The server reported that this suggestion or its source content cannot be reviewed." /></section>
                : detail ? <EditorialRecipeDetail suggestion={detail} showReviewControls onReview={openReview} onOpenSource={(sourceInfo) => openSource(sourceInfo, detail)} sourceImage={sourcePreviewPost?.image} submitting={submittingReview} catalogIngredients={catalogIngredients} catalogIngredientsLoading={catalogIngredientsLoading} ingredientMappings={ingredientMappings} onIngredientMapping={(index, id) => setIngredientMappings((current) => ({ ...current, [index]: id }))} onCreateIngredient={openCreateIngredient} mappingSectionRef={mappingSectionRef} />
                  : selected ? <section className="admin-panel recipe-suggestion-detail-state"><EmptyState title="Suggestion detail is unavailable." text="The source may have changed or is no longer available on the server." /></section> : null}
          </div>}
    {!isQueue && selectedId && <aside className="moderation-history-drawer recipe-suggestion-history-drawer" role="dialog" aria-modal="true" aria-label="Recipe suggestion review detail"><header><div><span className="moderation-detail-kicker">RECIPE REVIEW</span><h2>{detail?.source?.title || selected?.source?.title || 'Recipe suggestion'}</h2></div><button type="button" onClick={() => setSelectedId(null)} aria-label="Close recipe history detail"><X size={19} /></button></header><div className="moderation-history-drawer-body recipe-suggestion-history-drawer-body">{detailLoading ? <LoadingState /> : detailError ? <ErrorState onRetry={() => setDetailRefresh((value) => value + 1)} /> : detail ? <EditorialRecipeDetail suggestion={detail} showReviewControls={false} onOpenSource={(sourceInfo) => openSource(sourceInfo, detail)} sourceImage={sourcePreviewPost?.image} /> : <EmptyState title="Suggestion detail is unavailable." />}</div></aside>}
{reviewDialog && <ReviewDecisionDialog submitting={submittingReview} error={reviewError} issues={reviewIssues} onClose={closeReview} onSubmit={() => submitReview()} />}
    {rejectionDialog && <RejectionDialog reasonCode={rejectionReasonCode} reason={reviewReason} error={reviewError} submitting={submittingReview} onReasonCodeChange={(value) => { setRejectionReasonCode(value); setReviewError(''); }} onReasonChange={(value) => { setReviewReason(value); setReviewError(''); }} onClose={closeRejection} onConfirm={confirmRejection} />}
    <CreateIngredientDialog draft={createIngredientDraft} categories={ingredientCategories} saving={creatingIngredient} error={createIngredientError} onClose={() => !creatingIngredient && setCreateIngredientDraft(null)} onChange={changeCreateIngredient} onSubmit={submitCreateIngredient} />
    <SourceContentModal open={Boolean(source)} loading={sourceLoading} error={sourceError} post={sourcePost} fallback={source?.fallback} onClose={closeSource} onRetry={() => setSourceRefresh((value) => value + 1)} />
    <Toast message={toast} onDismiss={() => setToast('')} />
    {preview && <span className="recipe-suggestions-preview-marker">Preview data</span>}
  </div>;
}

