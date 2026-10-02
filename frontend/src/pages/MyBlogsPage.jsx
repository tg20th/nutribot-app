import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowLeft, ArrowUpRight, BookOpen, CheckCircle2, ChevronLeft, ChevronRight, Eye, FileText, Film, LoaderCircle, Pencil, Trash2, X } from 'lucide-react';
import CommunityTopBar from '../components/community/CommunityTopBar';
import CommunitySideNav from '../components/community/CommunitySideNav';
import ChatbotWidget from '../components/chatbot/ChatbotWidget';
import { deleteMyBlog, deleteMyVideo, getBlogCategories, getMyBlog, getMyBlogs, getMyVideo, getMyVideos, updateMyBlog, updateMyVideo } from '../services/authorBlogApi';
import '../styles/my-blogs.css';

const PAGE_SIZE = 6;
const CONTENT_TYPES = {
  blog: {
    key: 'blog', label: 'Blogs', single: 'blog', title: 'My content', listTitle: 'Your stories', emptyTitle: 'Your story starts here.',
    emptyText: "You haven't added any blogs yet. Start with a recipe, note, or nutrition story.", icon: BookOpen,
    createPath: '/community/blogs/new', createText: 'Write blog', getList: getMyBlogs, getItem: getMyBlog, update: updateMyBlog, remove: deleteMyBlog,
    fallbackLoad: "We couldn't load your blogs. Please try again.", fallbackDelete: "We couldn't delete this blog. It is still in your list; please try again.", savedNotice: 'Your blog has been updated.', deletedNotice: 'Your blog has been deleted.',
  },
  video: {
    key: 'video', label: 'Videos', single: 'video', title: 'My content', listTitle: 'Your videos', emptyTitle: 'Your first video starts here.',
    emptyText: "You haven't added any videos yet. Share a cooking clip, demo, or helpful nutrition video.", icon: Film,
    createPath: '/community/videos/new', createText: 'Add video', getList: getMyVideos, getItem: getMyVideo, update: updateMyVideo, remove: deleteMyVideo,
    fallbackLoad: "We couldn't load your videos. Please try again.", fallbackDelete: "We couldn't delete this video. It is still in your list; please try again.", savedNotice: 'Your video has been updated.', deletedNotice: 'Your video has been deleted.',
  },
};
const statuses = {
  draft: 'Draft', under_review: 'Under review', published: 'Published', flagged: 'Flagged', rejected: 'Rejected', archived: 'Archived',
};

function errorMessage(error, fallback, type) {
  if (error.status === 401) return 'Your session has expired. Please sign in again.';
  if (error.status === 403) return `You do not have permission to manage this ${type}.`;
  if (error.status === 404) return `This ${type} is no longer available. Refresh the list to continue.`;
  return fallback;
}

function RequestError({ error, fallback, type }) {
  return <div className="my-blogs-alert my-blogs-alert--error" role="alert">
    <AlertCircle size={18}/><span>{errorMessage(error, fallback, type)}
      {error.status === 401 && <> <Link to="/login" state={{ from: '/community/my-blogs' }}>Sign in</Link></>}
    </span>
  </div>;
}

function excerpt(body) {
  const doc = new DOMParser().parseFromString(body ?? '', 'text/html');
  doc.querySelectorAll('script, style').forEach((node) => node.remove());
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function formattedDate(value) {
  const date = new Date(value);
  return value && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Date unavailable';
}

function minutesFromSeconds(value) {
  return Number.isFinite(Number(value)) && Number(value) > 0 ? String(Math.round(Number(value) / 60)) : '';
}

function Thumbnail({ src, type }) {
  const [failed, setFailed] = useState(false);
  const Icon = type === 'video' ? Film : BookOpen;
  useEffect(() => setFailed(false), [src]);
  return <div className="my-blog-thumbnail">
    {src && !failed ? <img src={src} alt="" loading="lazy" onError={() => setFailed(true)}/>
      : <div className="my-blog-thumbnail-placeholder"><Icon size={32}/><span>{type === 'video' ? 'YOUR VIDEOS' : 'YOUR FOOD JOURNAL'}</span></div>}
  </div>;
}

function ContentDialog({ title, descriptionId, busy, onClose, children, danger = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);
  return <dialog ref={ref} className={`my-blog-dialog${danger ? ' my-blog-dialog--delete' : ''}`}
    aria-labelledby="content-dialog-title" aria-describedby={descriptionId} aria-modal="true"
    onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
    <header className="my-blog-dialog-header">
      <div><p className="my-blogs-eyebrow">{danger ? 'PLEASE CONFIRM' : 'YOUR CONTENT'}</p><h2 id="content-dialog-title">{title}</h2></div>
      <button type="button" className="my-blog-icon-button" aria-label="Close dialog" disabled={busy} onClick={onClose}><X size={20}/></button>
    </header>
    {children}
  </dialog>;
}

function EditContentDialog({ item, config, onClose, onSaved }) {
  const [values, setValues] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [revision, setRevision] = useState(0);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoadError(null);
    Promise.allSettled([config.getItem(item.contentId, controller.signal), getBlogCategories(controller.signal)]).then(([contentResult, categoryResult]) => {
      if (controller.signal.aborted) return;
      if (contentResult.status === 'rejected') { setLoadError(contentResult.reason); return; }
      const data = contentResult.value;
      setValues({
        title: data.title ?? '', body: data.body ?? '', thumbnailUrl: data.thumbnailUrl ?? '', categoryId: data.categoryId ? String(data.categoryId) : '',
        mediaUrl: data.mediaUrl ?? '', durationMinutes: minutesFromSeconds(data.durationSec),
      });
      setCategories(categoryResult.status === 'fulfilled' ? categoryResult.value : []);
    });
    return () => controller.abort();
  }, [config, item.contentId, revision]);

  async function save(event) {
    event.preventDefault();
    if (savingRef.current || !values.title.trim() || !values.body.trim() || !values.categoryId) return;
    if (config.key === 'video' && !values.mediaUrl.trim()) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      const payload = {
        title: values.title.trim(), body: values.body.trim(), thumbnailUrl: values.thumbnailUrl.trim(), categoryId: Number(values.categoryId),
      };
      if (config.key === 'video') {
        payload.mediaUrl = values.mediaUrl.trim();
        const duration = Number(values.durationMinutes);
        payload.durationSec = Number.isFinite(duration) && duration > 0 ? Math.round(duration * 60) : null;
      }
      await config.update(item.contentId, payload);
      onSaved();
    } catch (error) {
      setSaveError(error);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return <ContentDialog title={`Edit your ${config.single}`} busy={saving} onClose={onClose}>
    {loadError ? <div className="my-blog-dialog-state"><RequestError error={loadError} type={config.single} fallback={`We couldn't load this ${config.single}. Please try again.`}/><button className="my-blog-button" onClick={() => setRevision((value) => value + 1)}>Try again</button></div>
      : !values ? <p className="my-blog-dialog-state" role="status"><LoaderCircle className="my-blogs-spinner" size={20}/> Loading your {config.single}...</p>
        : <form className="my-blog-form" onSubmit={save}>
          <p className="my-blog-form-note">Update your {config.single}. Its publication status will stay the same.</p>
          <fieldset disabled={saving}>
            <label htmlFor="content-title">Title <span>{values.title.length}/255</span></label>
            <input id="content-title" value={values.title} maxLength={255} required onChange={(event) => setValues({ ...values, title: event.target.value })}/>
            <label htmlFor="content-category">Category <span>Required</span></label>
            <select id="content-category" required value={values.categoryId} onChange={(event) => setValues({ ...values, categoryId: event.target.value })}>
              <option value="">Select category</option>{categories.map((category) => <option key={category.categoryId} value={category.categoryId}>{category.name ?? category.categoryName}</option>)}
            </select>
            {config.key === 'video' && <>
              <label htmlFor="content-video-url">Video URL <span>Required</span></label>
              <input id="content-video-url" type="url" value={values.mediaUrl} required onChange={(event) => setValues({ ...values, mediaUrl: event.target.value })}/>
              <label htmlFor="content-duration">Duration <span>Optional, minutes</span></label>
              <input id="content-duration" type="number" min="1" max="600" step="0.5" value={values.durationMinutes} onChange={(event) => setValues({ ...values, durationMinutes: event.target.value })}/>
            </>}
            <label htmlFor="content-body">{config.key === 'video' ? 'Description' : 'Your story'}</label>
            <textarea id="content-body" value={values.body} rows={10} required onChange={(event) => setValues({ ...values, body: event.target.value })}/>
            <label htmlFor="content-thumbnail">Cover image URL <span>Optional</span></label>
            <input id="content-thumbnail" type="url" maxLength={500} pattern="https?://.*" placeholder="https://..." value={values.thumbnailUrl} onChange={(event) => setValues({ ...values, thumbnailUrl: event.target.value })}/>
          </fieldset>
          {saveError && <RequestError error={saveError} type={config.single} fallback="We couldn't save your changes. Your edits are still here; please try again."/>}
          <footer className="my-blog-dialog-actions">
            <button type="button" className="my-blog-button my-blog-button--secondary" disabled={saving} onClick={onClose}>Cancel</button>
            <button className="my-blog-button" disabled={saving || !values.title.trim() || !values.body.trim() || !values.categoryId || (config.key === 'video' && !values.mediaUrl.trim())}>{saving ? <><LoaderCircle className="my-blogs-spinner" size={16}/> Saving...</> : <><CheckCircle2 size={16}/> Save changes</>}</button>
          </footer>
        </form>}
  </ContentDialog>;
}

function DeleteContentDialog({ item, config, onClose, onDeleted }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const busyRef = useRef(false);
  async function confirmDelete() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      await config.remove(item.contentId);
      onDeleted();
    } catch (failure) {
      setError(failure);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  return <ContentDialog title={`Delete this ${config.single}?`} descriptionId="content-delete-description" danger busy={busy} onClose={onClose}>
    <div className="my-blog-delete-copy" id="content-delete-description">
      <span className="my-blog-delete-icon"><Trash2 size={25}/></span>
      <strong>{item.title}</strong>
      <p>This will permanently delete your {config.single} and its comments. This action cannot be undone.</p>
    </div>
    {error && <RequestError error={error} type={config.single} fallback={config.fallbackDelete}/>}<footer className="my-blog-dialog-actions">
      <button type="button" className="my-blog-button my-blog-button--secondary" disabled={busy} onClick={onClose}>Keep {config.single}</button>
      <button type="button" className="my-blog-button my-blog-button--danger" disabled={busy} onClick={confirmDelete}>{busy ? <><LoaderCircle className="my-blogs-spinner" size={16}/> Deleting...</> : <><Trash2 size={16}/> Delete {config.single}</>}</button>
    </footer>
  </ContentDialog>;
}

export default function MyBlogsPage({ defaultType = 'blog' } = {}) {
  const [type, setType] = useState(defaultType === 'video' ? 'video' : 'blog');
  const config = CONTENT_TYPES[type];
  const Icon = config.icon;
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState({ content: [], totalElements: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [notice, setNotice] = useState('');
  const headingRef = useRef(null);

  useEffect(() => {
    setType(defaultType === 'video' ? 'video' : 'blog');
    setPage(0);
  }, [defaultType]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    config.getList(page, PAGE_SIZE, controller.signal).then((data) => {
      if (controller.signal.aborted) return;
      const lastPage = Math.max(0, data.totalPages - 1);
      if (page > lastPage) { setPage(lastPage); return; }
      setResult(data);
      setLoading(false);
    }).catch((failure) => {
      if (controller.signal.aborted) return;
      setError(failure);
      setLoading(false);
    });
    return () => controller.abort();
  }, [config, page, revision]);

  function refresh(message) {
    setDialog(null);
    setNotice(message);
    setLoading(true);
    setRevision((value) => value + 1);
    headingRef.current?.focus();
  }

  function changePage(nextPage) {
    setLoading(true);
    setPage(nextPage);
    headingRef.current?.focus();
  }

  function changeType(nextType) {
    if (nextType === type) return;
    setType(nextType);
    setPage(0);
    setNotice('');
    setDialog(null);
  }

  return <div className="community-page my-blogs-page">
    <CommunityTopBar/><div className="community-shell"><CommunitySideNav/><span className="community-sidenav-spacer" aria-hidden="true"/>
      <main className="my-blogs-main">
        <Link className="my-blogs-back" to="/home"><ArrowLeft size={15}/> Back to the community</Link>
        <header className="my-blogs-header">
          <div><p className="my-blogs-eyebrow">YOUR PERSONAL CONTENT</p><h1>{config.title}<span>.</span></h1><p>Manage your blogs and videos in one place. Drafts, published posts, and reviews stay together.</p></div>
          <span className="my-blogs-header-mark" aria-hidden="true"><Icon size={38} strokeWidth={1.3}/></span>
        </header>
        <nav className="my-blogs-tabs" aria-label="Content type">
          {Object.values(CONTENT_TYPES).map((item) => <button key={item.key} type="button" className={type === item.key ? 'is-active' : ''} onClick={() => changeType(item.key)}>{item.key === 'video' ? <Film size={16}/> : <BookOpen size={16}/>} {item.label}</button>)}
        </nav>
        <section className="my-blogs-collection" aria-labelledby="my-blogs-list-title" aria-busy={loading}>
          <div className="my-blogs-list-heading"><h2 id="my-blogs-list-title" ref={headingRef} tabIndex={-1}>{config.listTitle} {!loading && !error && <span>{result.totalElements}</span>}</h2><Link className="my-blog-button" to={config.createPath}>{config.createText}</Link></div>
          {notice && <div className="my-blogs-alert" role="status"><CheckCircle2 size={18}/><span>{notice}</span><button className="my-blog-icon-button" aria-label="Dismiss notification" onClick={() => setNotice('')}><X size={16}/></button></div>}
          {loading ? <div className="my-blogs-state" role="status"><LoaderCircle className="my-blogs-spinner" size={28}/><h3>Gathering your {config.label.toLowerCase()}...</h3><p>Your personal content will be ready in a moment.</p></div>
            : error ? <div className="my-blogs-state"><RequestError error={error} type={config.single} fallback={config.fallbackLoad}/><button className="my-blog-button" onClick={() => setRevision((value) => value + 1)}>Try again</button></div>
              : !result.content.length ? <div className="my-blogs-state"><span className="my-blogs-empty-icon"><Icon size={32}/></span><p className="my-blogs-eyebrow">A FRESH PAGE</p><h3>{config.emptyTitle}</h3><p>{config.emptyText}</p><Link className="my-blog-button" to={config.createPath}>{config.createText} <ArrowUpRight size={16}/></Link></div>
                : <div className="my-blogs-list">{result.content.map((item) => <article className="my-blog-card" key={item.contentId}>
                  <Thumbnail src={item.thumbnailUrl} type={type}/><div className="my-blog-card-body">
                    <div className="my-blog-meta"><span className={`my-blog-status my-blog-status--${statuses[item.status] ? item.status : 'unknown'}`}>{statuses[item.status] ?? 'Unknown status'}</span><span>Updated {formattedDate(item.updatedAt ?? item.createdAt)}</span>{type === 'video' && item.durationSec ? <span>{Math.round(item.durationSec / 60)} min</span> : null}</div>
                    <h3>{item.status === 'published' ? <Link to={`/community/posts/${item.contentId}`}>{item.title}</Link> : item.title}</h3>
                    <p className="my-blog-excerpt">{excerpt(item.body) || (type === 'video' ? 'No description yet.' : 'No story text yet.')}</p>
                    <div className="my-blog-card-footer"><span className="my-blog-views"><Eye size={15}/>{(item.viewCount ?? 0).toLocaleString()} views</span><div className="my-blog-card-actions">
                      <button type="button" onClick={() => { setNotice(''); setDialog({ type: 'edit', item }); }} aria-label={`Edit ${item.title}`}><Pencil size={15}/> Edit</button>
                      <button type="button" className="my-blog-delete-button" onClick={() => { setNotice(''); setDialog({ type: 'delete', item }); }} aria-label={`Delete ${item.title}`}><Trash2 size={15}/> Delete</button>
                    </div></div>
                  </div>
                </article>)}</div>}
          {!loading && !error && result.totalElements > 0 && <nav className="my-blogs-pagination" aria-label={`${config.label} pagination`}><span>Showing {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, result.totalElements)} of {result.totalElements}</span>{result.totalPages > 1 && <div><button type="button" disabled={page === 0} onClick={() => changePage(page - 1)} aria-label="Previous page"><ChevronLeft size={17}/></button><span>Page {page + 1} of {result.totalPages}</span><button type="button" disabled={page >= result.totalPages - 1} onClick={() => changePage(page + 1)} aria-label="Next page"><ChevronRight size={17}/></button></div>}</nav>}
        </section>
        <p className="my-blogs-footer-note"><FileText size={14}/> One library for everything you share with the community.</p>
      </main>
    </div><ChatbotWidget/>
    {dialog?.type === 'edit' && <EditContentDialog item={dialog.item} config={config} onClose={() => setDialog(null)} onSaved={() => refresh(config.savedNotice)}/>} {dialog?.type === 'delete' && <DeleteContentDialog item={dialog.item} config={config} onClose={() => setDialog(null)} onDeleted={() => refresh(config.deletedNotice)}/>} </div>;
}
