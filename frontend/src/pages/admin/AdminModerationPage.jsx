import { Bot, Check, ChevronLeft, ChevronRight, Clock3, EyeOff, FileText, ListOrdered, Search, ShieldCheck, Sparkles, UtensilsCrossed, Video, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { adminApi } from '../../services/adminApi';
import { ConfirmDialog, EmptyState, ErrorState, LoadingState, Toast } from '../../components/admin/AdminUi';

const pageSize = 10;
const actions = {
  APPROVE: { title: 'Approve this submission?', label: 'Approve', message: 'Content approved and published.', confirmClass: 'primary' },
  HIDE: { title: 'Hide this submission?', label: 'Hide', message: 'Content hidden from the community.' },
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

function ModerationSubmissionContent({ body }) {
  const recipe = parseRecipeBody(body);

  if (!recipe) {
    return body ? <p>{body}</p> : <p className="moderation-no-body">No additional content details are available for this submission.</p>;
  }

  const { story, prepMinutes, cookMinutes, servings, nutrition, ingredients, steps } = recipe;

  return (
    <div className="moderation-recipe-view">
      {story && (
        <div className="moderation-recipe-story">
          <p>{story}</p>
        </div>
      )}

      {(prepMinutes || cookMinutes || servings) && (
        <div className="moderation-recipe-section">
          <h4 className="moderation-recipe-section-title">
            <Clock3 size={15} /> Cooking time & Servings
          </h4>
          <div className="moderation-recipe-meta-cards">
            {prepMinutes && (
              <div className="moderation-recipe-meta-card">
                <span className="meta-label">Prep time</span>
                <strong className="meta-value">{prepMinutes} min</strong>
              </div>
            )}
            {cookMinutes && (
              <div className="moderation-recipe-meta-card">
                <span className="meta-label">Cook time</span>
                <strong className="meta-value">{cookMinutes} min</strong>
              </div>
            )}
            {servings && (
              <div className="moderation-recipe-meta-card">
                <span className="meta-label">Servings</span>
                <strong className="meta-value">{servings} portions</strong>
              </div>
            )}
          </div>
        </div>
      )}

      {nutrition && Object.keys(nutrition).length > 0 && (
        <div className="moderation-recipe-section">
          <h4 className="moderation-recipe-section-title">
            <Sparkles size={15} /> Nutrition facts
          </h4>
          <div className="moderation-recipe-nutrition-grid">
            {nutrition.calories != null && nutrition.calories !== '' && (
              <div className="moderation-nutrition-item">
                <span className="nut-label">Calories</span>
                <strong className="nut-value">{nutrition.calories} <small>kcal</small></strong>
              </div>
            )}
            {nutrition.proteinG != null && nutrition.proteinG !== '' && (
              <div className="moderation-nutrition-item">
                <span className="nut-label">Protein</span>
                <strong className="nut-value">{nutrition.proteinG} <small>g</small></strong>
              </div>
            )}
            {nutrition.carbsG != null && nutrition.carbsG !== '' && (
              <div className="moderation-nutrition-item">
                <span className="nut-label">Carbs</span>
                <strong className="nut-value">{nutrition.carbsG} <small>g</small></strong>
              </div>
            )}
            {nutrition.fatG != null && nutrition.fatG !== '' && (
              <div className="moderation-nutrition-item">
                <span className="nut-label">Fat</span>
                <strong className="nut-value">{nutrition.fatG} <small>g</small></strong>
              </div>
            )}
            {nutrition.fiberG != null && nutrition.fiberG !== '' && (
              <div className="moderation-nutrition-item">
                <span className="nut-label">Fiber</span>
                <strong className="nut-value">{nutrition.fiberG} <small>g</small></strong>
              </div>
            )}
            {nutrition.sodiumMg != null && nutrition.sodiumMg !== '' && (
              <div className="moderation-nutrition-item">
                <span className="nut-label">Sodium</span>
                <strong className="nut-value">{nutrition.sodiumMg} <small>mg</small></strong>
              </div>
            )}
          </div>
        </div>
      )}

      {ingredients.length > 0 && (
        <div className="moderation-recipe-section">
          <h4 className="moderation-recipe-section-title">
            <UtensilsCrossed size={15} /> Ingredients ({ingredients.length})
          </h4>
          <ul className="moderation-recipe-ingredient-list">
            {ingredients.map((ing, idx) => {
              const name = typeof ing === 'string' ? ing : ing.name;
              const qty = typeof ing === 'object' && ing.quantity ? `${ing.quantity} ${ing.unit || ''}`.trim() : '';
              return (
                <li key={idx} className="moderation-recipe-ingredient-tag">
                  <span className="ingredient-name">{name}</span>
                  {qty && <span className="ingredient-qty">{qty}</span>}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {steps.length > 0 && (
        <div className="moderation-recipe-section">
          <h4 className="moderation-recipe-section-title">
            <ListOrdered size={15} /> Preparation steps ({steps.length})
          </h4>
          <ol className="moderation-recipe-step-list">
            {steps.map((step, idx) => (
              <li key={idx} className="moderation-recipe-step-item">
                <span className="step-num">{idx + 1}</span>
                <p className="step-text">{step}</p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

export default function AdminModerationPage() {
  const preview = import.meta.env.DEV && new URLSearchParams(window.location.search).get('preview') === '1';
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
        setSelectedId((current) => nextItems.some((item) => item.id === current) ? current : nextItems[0]?.id ?? null);
      })
      .catch((requestError) => {
        if (!controller.signal.aborted) setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [contentType, page, refreshKey]);

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    return items.filter((item) => !value || `${item.title} ${item.author} ${item.authorEmail} ${item.slug}`.toLowerCase().includes(value));
  }, [items, query]);
  const selected = filtered.find((item) => item.id === selectedId) ?? filtered[0] ?? null;

  const changeType = (value) => {
    setContentType(value);
    setPage(1);
    setQuery('');
    setSelectedId(null);
  };

  const decide = async () => {
    if (!confirm) return;
    try {
      await adminApi.moderateContent(confirm.item.id, confirm.action);
      setToast(actions[confirm.action].message);
      setConfirm(null);
      setSelectedId(null);
      setRefreshKey((key) => key + 1);
    } catch {
      setConfirm(null);
      setToast('Could not update this submission. Please try again.');
    }
  };

  return <div className="moderation-page">
    <section className="moderation-hero">
      <header className="moderation-heading">
        <div>
          <p>ADMINISTRATION / CONTENT REVIEW</p>
          <h1>Content moderation</h1>
          <span>Review pending blog and video submissions.</span>
        </div>
        <div className="moderation-count" aria-live="polite"><ShieldCheck size={18} /><strong>{totalElements}</strong><span>pending</span></div>
      </header>
      <div className="moderation-toolbar">
        <label className="moderation-search" aria-label="Search submissions">
          <Search size={17} aria-hidden="true" />
          <input aria-label="Search title or author" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title or author on this page..." />
          {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search"><X size={15} /></button>}
        </label>
        <label className="moderation-type-filter">Content type
          <select value={contentType} onChange={(event) => changeType(event.target.value)}>
            <option value="">All content</option>
            <option value="BLOG">Blogs</option>
            <option value="VIDEO">Videos</option>
          </select>
        </label>
      </div>
    </section>

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
                  <time dateTime={selected.submittedAt}>Submitted {formatDate(selected.submittedAt)}</time>
                </div>
                {selected.thumbnailUrl
                  ? <img className="moderation-cover" src={selected.thumbnailUrl} alt="" />
                  : <div className="moderation-cover-placeholder"><span>{selected.type === 'VIDEO' ? <Video size={26} /> : <FileText size={26} />}</span></div>}
                <div className="moderation-detail-content">
                  <h2>{selected.title}</h2>

                  {selected.aiReason && (
                    <div className={`moderation-ai-card ${selected.aiFlagged !== false ? 'is-flagged' : 'is-passed'}`}>
                      <div className="moderation-ai-header">
                        <div className="moderation-ai-title">
                          <Bot size={16} />
                          <strong>Đánh giá kiểm duyệt AI</strong>
                          <span className={`moderation-ai-badge ${selected.aiFlagged !== false ? 'flagged' : 'approved'}`}>
                            {selected.aiFlagged !== false ? 'AI Yêu cầu Admin duyệt' : 'AI Đã duyệt'}
                          </span>
                        </div>
                        {selected.aiConfidence != null && (
                          <span className="moderation-ai-confidence">
                            Độ tin cậy: {Math.round(selected.aiConfidence * 100)}%
                          </span>
                        )}
                      </div>
                      <p className="moderation-ai-reason">{selected.aiReason}</p>
                    </div>
                  )}

                  <dl className="moderation-metadata">
                    <div><dt>Author</dt><dd>{selected.author}</dd></div>
                    {selected.authorEmail && <div><dt>Email</dt><dd>{selected.authorEmail}</dd></div>}
                    <div><dt>Content type</dt><dd>{selected.type === 'VIDEO' ? 'Video' : 'Blog'}</dd></div>
                    <div><dt>Views</dt><dd>{selected.viewCount}</dd></div>
                    {selected.slug && <div><dt>Slug</dt><dd>{selected.slug}</dd></div>}
                  </dl>
                  <section className="moderation-copy">
                    <h3>Submission</h3>
                    <ModerationSubmissionContent body={selected.body} />
                  </section>
                </div>
                <footer className="moderation-actions">
                  <button type="button" className="admin-btn primary" onClick={() => setConfirm({ item: selected, action: 'APPROVE' })}><Check size={16} /> Approve</button>
                  <button type="button" className="admin-btn moderation-hide" onClick={() => setConfirm({ item: selected, action: 'HIDE' })}><EyeOff size={16} /> Hide</button>
                  <button type="button" className="admin-btn danger" onClick={() => setConfirm({ item: selected, action: 'REJECT' })}><X size={16} /> Reject</button>
                </footer>
              </article>
            </div>}
    </div>

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
