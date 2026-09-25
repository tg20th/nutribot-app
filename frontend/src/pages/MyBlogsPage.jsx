import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowLeft, ArrowUpRight, BookOpen, CheckCircle2, ChevronLeft, ChevronRight, Eye, FileText, LoaderCircle, Pencil, Trash2, X } from 'lucide-react';
import CommunityTopBar from '../components/community/CommunityTopBar';
import CommunitySideNav from '../components/community/CommunitySideNav';
import ChatbotWidget from '../components/chatbot/ChatbotWidget';
import { deleteMyBlog, getMyBlog, getMyBlogs, updateMyBlog } from '../services/authorBlogApi';
import '../styles/my-blogs.css';

const PAGE_SIZE = 6;
const statuses = {
  draft: 'Draft', under_review: 'Under review', published: 'Published',
  flagged: 'Flagged', rejected: 'Rejected', archived: 'Archived',
};

function errorMessage(error, fallback) {
  if (error.status === 401) return 'Your session has expired. Please sign in again.';
  if (error.status === 403) return 'You do not have permission to manage this blog.';
  if (error.status === 404) return 'This blog is no longer available. Refresh the list to continue.';
  return fallback;
}

function RequestError({ error, fallback }) {
  return <div className="my-blogs-alert my-blogs-alert--error" role="alert">
    <AlertCircle size={18}/><span>{errorMessage(error, fallback)}
      {error.status === 401 && <> <Link to="/login" state={{ from: '/community/my-blogs' }}>Sign in</Link></>}
    </span>
  </div>;
}

function excerpt(body) {
  // Treat rich-text bodies as inert text. Never inject an author's HTML into the page.
  const doc = new DOMParser().parseFromString(body ?? '', 'text/html');
  doc.querySelectorAll('script, style').forEach((node) => node.remove());
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function formattedDate(value) {
  const date = new Date(value);
  return value && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Date unavailable';
}

function BlogThumbnail({ src }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return <div className="my-blog-thumbnail">
    {src && !failed ? <img src={src} alt="" loading="lazy" onError={() => setFailed(true)}/>
      : <div className="my-blog-thumbnail-placeholder"><BookOpen size={32}/><span>YOUR FOOD JOURNAL</span></div>}
  </div>;
}

function BlogDialog({ title, descriptionId, busy, onClose, children, danger = false }) {
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
    aria-labelledby="blog-dialog-title" aria-describedby={descriptionId} aria-modal="true"
    onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
    <header className="my-blog-dialog-header">
      <div><p className="my-blogs-eyebrow">{danger ? 'PLEASE CONFIRM' : 'YOUR FOOD JOURNAL'}</p><h2 id="blog-dialog-title">{title}</h2></div>
      <button type="button" className="my-blog-icon-button" aria-label="Close dialog" disabled={busy} onClick={onClose}><X size={20}/></button>
    </header>
    {children}
  </dialog>;
}

function EditBlogDialog({ blog, onClose, onSaved }) {
  const [values, setValues] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [revision, setRevision] = useState(0);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoadError(null);
    getMyBlog(blog.contentId, controller.signal).then((item) => {
      if (!controller.signal.aborted) setValues({ title: item.title ?? '', body: item.body ?? '', thumbnailUrl: item.thumbnailUrl ?? '' });
    }).catch((error) => { if (!controller.signal.aborted) setLoadError(error); });
    return () => controller.abort();
  }, [blog.contentId, revision]);

  async function save(event) {
    event.preventDefault();
    if (savingRef.current || !values.title.trim() || !values.body.trim()) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      // Keep the existing publication/moderation status when editing the text.
      await updateMyBlog(blog.contentId, { ...values, title: values.title.trim(), thumbnailUrl: values.thumbnailUrl.trim() });
      onSaved();
    } catch (error) {
      setSaveError(error);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return <BlogDialog title="Edit your blog" busy={saving} onClose={onClose}>
    {loadError ? <div className="my-blog-dialog-state"><RequestError error={loadError} fallback="We couldn't load this blog. Please try again."/><button className="my-blog-button" onClick={() => setRevision((value) => value + 1)}>Try again</button></div>
      : !values ? <p className="my-blog-dialog-state" role="status"><LoaderCircle className="my-blogs-spinner" size={20}/> Loading your blog...</p>
        : <form className="my-blog-form" onSubmit={save}>
          <p className="my-blog-form-note">Update your story. Its publication status will stay the same.</p>
          <fieldset disabled={saving}>
            <label htmlFor="blog-title">Title <span>{values.title.length}/255</span></label>
            <input id="blog-title" value={values.title} maxLength={255} required onChange={(event) => setValues({ ...values, title: event.target.value })}/>
            <label htmlFor="blog-body">Your story</label>
            <textarea id="blog-body" value={values.body} rows={10} required onChange={(event) => setValues({ ...values, body: event.target.value })}/>
            <label htmlFor="blog-thumbnail">Cover image URL <span>Optional</span></label>
            <input id="blog-thumbnail" type="url" maxLength={500} pattern="https?://.*" placeholder="https://..." value={values.thumbnailUrl} onChange={(event) => setValues({ ...values, thumbnailUrl: event.target.value })}/>
          </fieldset>
          {saveError && <RequestError error={saveError} fallback="We couldn't save your changes. Your edits are still here; please try again."/>}
          <footer className="my-blog-dialog-actions">
            <button type="button" className="my-blog-button my-blog-button--secondary" disabled={saving} onClick={onClose}>Cancel</button>
            <button className="my-blog-button" disabled={saving || !values.title.trim() || !values.body.trim()}>{saving ? <><LoaderCircle className="my-blogs-spinner" size={16}/> Saving...</> : <><CheckCircle2 size={16}/> Save changes</>}</button>
          </footer>
        </form>}
  </BlogDialog>;
}

function DeleteBlogDialog({ blog, onClose, onDeleted }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const busyRef = useRef(false);
  async function confirmDelete() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      await deleteMyBlog(blog.contentId);
      onDeleted();
    } catch (failure) {
      setError(failure);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  return <BlogDialog title="Delete this blog?" descriptionId="blog-delete-description" danger busy={busy} onClose={onClose}>
    <div className="my-blog-delete-copy" id="blog-delete-description">
      <span className="my-blog-delete-icon"><Trash2 size={25}/></span>
      <strong>{blog.title}</strong>
      <p>This will permanently delete your blog and its comments. This action cannot be undone.</p>
    </div>
    {error && <RequestError error={error} fallback="We couldn't delete this blog. It is still in your list; please try again."/>}
    <footer className="my-blog-dialog-actions">
      <button type="button" className="my-blog-button my-blog-button--secondary" disabled={busy} onClick={onClose}>Keep blog</button>
      <button type="button" className="my-blog-button my-blog-button--danger" disabled={busy} onClick={confirmDelete}>{busy ? <><LoaderCircle className="my-blogs-spinner" size={16}/> Deleting...</> : <><Trash2 size={16}/> Delete blog</>}</button>
    </footer>
  </BlogDialog>;
}

export default function MyBlogsPage() {
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState({ content: [], totalElements: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [notice, setNotice] = useState('');
  const headingRef = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    getMyBlogs(page, PAGE_SIZE, controller.signal).then((data) => {
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
  }, [page, revision]);

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

  return <div className="community-page my-blogs-page">
    <CommunityTopBar hideSearch/>
    <div className="community-shell">
      <CommunitySideNav/>
      <span className="community-sidenav-spacer" aria-hidden="true"/>
      <main className="my-blogs-main">
        <Link className="my-blogs-back" to="/home"><ArrowLeft size={15}/> Back to the community</Link>
        <header className="my-blogs-header">
          <div><p className="my-blogs-eyebrow">YOUR PERSONAL JOURNAL</p><h1>My blogs<span>.</span></h1><p>Your stories, recipes, and kitchen notes. All in one place.</p></div>
          <span className="my-blogs-header-mark" aria-hidden="true"><BookOpen size={38} strokeWidth={1.3}/></span>
        </header>
        <section className="my-blogs-collection" aria-labelledby="my-blogs-list-title" aria-busy={loading}>
          <div className="my-blogs-list-heading">
            <h2 id="my-blogs-list-title" ref={headingRef} tabIndex={-1}>Your stories {!loading && !error && <span>{result.totalElements}</span>}</h2>
            <span>Last updated first</span>
          </div>
          {notice && <div className="my-blogs-alert" role="status"><CheckCircle2 size={18}/><span>{notice}</span><button className="my-blog-icon-button" aria-label="Dismiss notification" onClick={() => setNotice('')}><X size={16}/></button></div>}
          {loading ? <div className="my-blogs-state" role="status"><LoaderCircle className="my-blogs-spinner" size={28}/><h3>Gathering your stories...</h3><p>Your personal journal will be ready in a moment.</p></div>
            : error ? <div className="my-blogs-state"><RequestError error={error} fallback="We couldn't load your blogs. Please try again."/><button className="my-blog-button" onClick={() => setRevision((value) => value + 1)}>Try again</button></div>
              : !result.content.length ? <div className="my-blogs-state"><span className="my-blogs-empty-icon"><FileText size={32}/></span><p className="my-blogs-eyebrow">A FRESH PAGE</p><h3>Your story starts here.</h3><p>You haven't added any blogs yet. Explore the community for a little inspiration.</p><Link className="my-blog-button" to="/home">Explore the community <ArrowUpRight size={16}/></Link></div>
                : <div className="my-blogs-list">{result.content.map((blog) => <article className="my-blog-card" key={blog.contentId}>
                  <BlogThumbnail src={blog.thumbnailUrl}/>
                  <div className="my-blog-card-body">
                    <div className="my-blog-meta"><span className={`my-blog-status my-blog-status--${statuses[blog.status] ? blog.status : 'unknown'}`}>{statuses[blog.status] ?? 'Unknown status'}</span><span>Updated {formattedDate(blog.updatedAt ?? blog.createdAt)}</span></div>
                    <h3>{blog.status === 'published' ? <Link to={`/community/posts/${blog.contentId}`}>{blog.title}</Link> : blog.title}</h3>
                    <p className="my-blog-excerpt">{excerpt(blog.body) || 'No story text yet.'}</p>
                    <div className="my-blog-card-footer">
                      <span className="my-blog-views"><Eye size={15}/>{(blog.viewCount ?? 0).toLocaleString()} views</span>
                      <div className="my-blog-card-actions">
                        <button type="button" onClick={() => { setNotice(''); setDialog({ type: 'edit', blog }); }} aria-label={`Edit ${blog.title}`}><Pencil size={15}/> Edit</button>
                        <button type="button" className="my-blog-delete-button" onClick={() => { setNotice(''); setDialog({ type: 'delete', blog }); }} aria-label={`Delete ${blog.title}`}><Trash2 size={15}/> Delete</button>
                      </div>
                    </div>
                  </div>
                </article>)}</div>}
          {!loading && !error && result.totalElements > 0 && <nav className="my-blogs-pagination" aria-label="Blog pagination">
            <span>Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, result.totalElements)} of {result.totalElements}</span>
            {result.totalPages > 1 && <div><button type="button" disabled={page === 0} onClick={() => changePage(page - 1)} aria-label="Previous page"><ChevronLeft size={17}/></button><span>Page {page + 1} of {result.totalPages}</span><button type="button" disabled={page >= result.totalPages - 1} onClick={() => changePage(page + 1)} aria-label="Next page"><ChevronRight size={17}/></button></div>}
          </nav>}
        </section>
        <p className="my-blogs-footer-note"><BookOpen size={14}/> Small stories. A more nourishing community.</p>
      </main>
    </div>
    <ChatbotWidget/>
    {dialog?.type === 'edit' && <EditBlogDialog blog={dialog.blog} onClose={() => setDialog(null)} onSaved={() => refresh('Your blog has been updated.')}/>}
    {dialog?.type === 'delete' && <DeleteBlogDialog blog={dialog.blog} onClose={() => setDialog(null)} onDeleted={() => refresh('Your blog has been deleted.')}/>}
  </div>;
}
