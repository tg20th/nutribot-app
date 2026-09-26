import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ImagePlus, Link2, LoaderCircle, Send, Video, X } from 'lucide-react';
import CommunityTopBar from '../components/community/CommunityTopBar';
import CommunitySideNav from '../components/community/CommunitySideNav';
import ChatbotWidget from '../components/chatbot/ChatbotWidget';
import { createMyBlog, createMyVideo, getBlogCategories, uploadBlogThumbnail } from '../services/authorBlogApi';
import '../styles/my-blogs.css';
import '../styles/create-blog.css';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const CONTENT_TYPES = { BLOG: 'blog', VIDEO: 'video' };

function isSupportedVideoUrl(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const path = url.pathname.toLowerCase();
    return ['http:', 'https:'].includes(url.protocol)
      && (host.includes('youtube.com') || host.includes('youtu.be') || ['.mp4', '.webm', '.mov'].some((ext) => path.endsWith(ext)));
  } catch {
    return false;
  }
}

export default function CreateBlogPage({ modal = false, onClose, defaultType = CONTENT_TYPES.BLOG } = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const preview = import.meta.env.DEV && new URLSearchParams(location.search).get('preview') === '1';
  const [contentType, setContentType] = useState(defaultType === CONTENT_TYPES.VIDEO ? CONTENT_TYPES.VIDEO : CONTENT_TYPES.BLOG);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [categories, setCategories] = useState([]);
  const [file, setFile] = useState(null);
  const [imageUrl, setImageUrl] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const bodyRef = useRef(null);
  const dialogRef = useRef(null);
  const submitting = useRef(false);

  const isVideo = contentType === CONTENT_TYPES.VIDEO;
  const trimmedTitle = title.trim();
  const trimmedBody = body.trim();
  const trimmedVideoUrl = videoUrl.trim();
  const parsedDuration = Number(durationMinutes);
  const canSubmit = trimmedTitle && trimmedBody && categoryId
    && (!isVideo || isSupportedVideoUrl(trimmedVideoUrl));

  useEffect(() => {
    if (!modal) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focus = requestAnimationFrame(() => dialogRef.current?.querySelector('#create-blog-title')?.focus());
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !submitting.current) onClose?.();
      if (event.key === 'Tab') {
        const controls = [...dialogRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]')]
          .filter((element) => element.getClientRects().length);
        if (!controls.length) return;
        const first = controls[0];
        const last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      cancelAnimationFrame(focus);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [modal, onClose]);

  useEffect(() => {
    if (preview) {
      setCategories([{ categoryId: 1, name: 'Nutrition' }, { categoryId: 2, name: 'Recipe' }, { categoryId: 3, name: 'Lifestyle' }]);
      return undefined;
    }
    const controller = new AbortController();
    getBlogCategories(controller.signal).then((items) => setCategories(items))
      .catch(() => { if (!controller.signal.aborted) setCategories([]); });
    return () => controller.abort();
  }, [preview]);

  useEffect(() => {
    if (!file) { setImageUrl(''); return undefined; }
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    const input = bodyRef.current;
    if (!input) return;
    input.style.height = 'auto';
    input.style.height = `${Math.max(116, input.scrollHeight)}px`;
  }, [body]);

  function chooseImage(event) {
    const selected = event.target.files?.[0];
    if (!selected) return;
    if (!IMAGE_TYPES.includes(selected.type) || selected.size > MAX_IMAGE_SIZE) {
      setError('Choose a JPG, PNG, or WebP image smaller than 5 MB.');
      event.target.value = '';
      return;
    }
    setError('');
    setFile(selected);
  }

  function format(mark) {
    const input = bodyRef.current;
    if (!input) return;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const selected = body.slice(start, end) || 'your text';
    const replacement = mark === 'heading' ? `\n## ${selected}\n` : mark === 'list' ? `\n- ${selected}\n` : `**${selected}**`;
    setBody(`${body.slice(0, start)}${replacement}${body.slice(end)}`);
    requestAnimationFrame(() => { input.focus(); input.setSelectionRange(start, start + replacement.length); });
  }

  async function submit(event) {
    event.preventDefault();
    if (preview || submitting.current || !canSubmit) return;
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      const thumbnailUrl = file ? await uploadBlogThumbnail(file) : null;
      const payload = { title: trimmedTitle, body: trimmedBody, thumbnailUrl, categoryId: Number(categoryId) };
      if (isVideo) {
        const videoPayload = { ...payload, mediaUrl: trimmedVideoUrl };
        if (Number.isFinite(parsedDuration) && parsedDuration > 0) videoPayload.durationSec = Math.round(parsedDuration * 60);
        await createMyVideo(videoPayload);
      } else {
        await createMyBlog(payload);
      }
      navigate('/community/my-blogs', { state: { created: true, type: contentType } });
    } catch (failure) {
      setError(failure.status === 401 ? 'Your session expired. Please sign in again.' : failure.message || `Could not save your ${isVideo ? 'video' : 'blog'}. Please try again.`);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  const EditorTag = modal ? 'div' : 'main';
  const editor = <EditorTag className="create-blog-main">
    {modal ? <button type="button" className="create-blog-close" onClick={onClose} aria-label="Close editor" disabled={busy}><X size={19}/></button> : <Link to="/community/my-blogs" className="my-blogs-back"><ArrowLeft size={15}/> Back to my blogs</Link>}
    <header className="create-blog-header">
      <div className="create-blog-hero-copy"><p className="my-blogs-eyebrow">YOUR PERSONAL JOURNAL</p><h1 id="create-blog-dialog-title">{isVideo ? 'Share a video' : 'Write a story'}<span>.</span></h1><p>{isVideo ? 'Post a cooking clip, demo, or useful video link for the community.' : 'Share a recipe, an idea, or a little note from your kitchen.'}</p></div>
    </header>
    <form className="create-blog-form" onSubmit={submit}>
      <div className="create-blog-panel">
        <div className="create-blog-type-toggle" role="group" aria-label="Choose content type">
          <button type="button" className={!isVideo ? 'is-active' : ''} onClick={() => setContentType(CONTENT_TYPES.BLOG)} disabled={busy}><ImagePlus size={16}/> Blog</button>
          <button type="button" className={isVideo ? 'is-active' : ''} onClick={() => setContentType(CONTENT_TYPES.VIDEO)} disabled={busy}><Video size={16}/> Video</button>
        </div>
        <div className="create-blog-section-heading"><span>01</span><div><h2>{isVideo ? 'Your video' : 'Your story'}</h2><p>{isVideo ? 'Add the video link, duration, and a short description.' : 'Give your post a clear title and write your content below.'}</p></div></div>
        <label htmlFor="create-blog-title">Title <small>{title.length}/255</small></label>
        <input id="create-blog-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={255} required placeholder={isVideo ? 'Give your video a clear title' : 'What would you like to share?'} disabled={busy}/>
        {isVideo && <div className="create-video-fields">
          <div className="create-video-field">
            <label htmlFor="create-video-url">Video URL <small>YouTube, MP4, WebM, or MOV</small></label>
            <span className="create-video-url-input"><Link2 size={16}/><input id="create-video-url" type="url" value={videoUrl} onChange={(event) => setVideoUrl(event.target.value)} required placeholder="https://youtube.com/watch?v=..." disabled={busy}/></span>
          </div>
          <div className="create-video-field">
            <label htmlFor="create-video-duration">Duration <small>optional, minutes</small></label>
            <input id="create-video-duration" type="number" min="1" max="600" step="0.5" value={durationMinutes} onChange={(event) => setDurationMinutes(event.target.value)} placeholder="8" disabled={busy}/>
          </div>
          {trimmedVideoUrl && !isSupportedVideoUrl(trimmedVideoUrl) && <p className="create-blog-error" role="alert">Use a YouTube link or a direct MP4/WebM/MOV URL.</p>}
        </div>}
        <label htmlFor="create-blog-body">{isVideo ? 'Video description' : 'Article'}</label>
        <div className="create-blog-editor">
          <div className="create-blog-toolbar" aria-label="Text formatting"><button type="button" onClick={() => format('heading')} disabled={busy}>Heading</button><button type="button" onClick={() => format('bold')} disabled={busy}><strong>B</strong> Bold</button><button type="button" onClick={() => format('list')} disabled={busy}>List</button></div>
          <textarea id="create-blog-body" ref={bodyRef} value={body} onChange={(event) => setBody(event.target.value)} rows={5} required placeholder={isVideo ? 'Describe what viewers will learn...' : 'Start writing your story...'} disabled={busy}/>
        </div>
      </div>
      <aside className="create-blog-settings">
        <div className="create-blog-panel"><div className="create-blog-section-heading"><span>02</span><div><h2>Cover image</h2><p>Help readers recognize your {isVideo ? 'video' : 'story'}.</p></div></div>
          <label className="create-blog-upload" htmlFor="create-blog-image">{imageUrl ? <img src={imageUrl} alt="Selected cover preview"/> : <><ImagePlus size={30}/><strong>Upload a cover image</strong><span>JPG, PNG, or WebP - max 5 MB</span></>}</label>
          <input id="create-blog-image" type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseImage} disabled={busy}/>
          {file && <button type="button" className="create-blog-remove" onClick={() => setFile(null)} disabled={busy}><X size={14}/> Remove image</button>}
        </div>
        <div className="create-blog-panel"><div className="create-blog-section-heading"><span>03</span><div><h2>Category</h2><p>Choose where your {isVideo ? 'video' : 'blog'} belongs.</p></div></div>
          <label htmlFor="create-blog-category">{isVideo ? 'Video' : 'Blog'} category <small>required</small></label>
          <select id="create-blog-category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)} disabled={busy || !categories.length}><option value="">Select category</option>{categories.map((item) => <option key={item.categoryId} value={item.categoryId}>{item.name ?? item.categoryName}</option>)}</select>
          {!categories.length && <p className="create-blog-hint">Categories will appear here when the backend provides them.</p>}
        </div>
        {error && <p className="create-blog-error" role="alert">{error} {error.includes('session') && <Link to="/login">Sign in</Link>}</p>}
        <button className="my-blog-button create-blog-submit" type="submit" disabled={preview || busy || !canSubmit}>{busy ? <><LoaderCircle className="my-blogs-spinner" size={16}/> Saving...</> : <><Send size={16}/> {preview ? 'Sign in to save' : `Save ${isVideo ? 'video' : 'blog'} draft`}</>}</button>
      </aside>
    </form>
  </EditorTag>;

  if (modal) return <div className="create-blog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose?.(); }}>
    <div ref={dialogRef} className="create-blog-dialog create-blog-page" role="dialog" aria-modal="true" aria-labelledby="create-blog-dialog-title">
      {editor}
    </div>
  </div>;

  return <div className="community-page create-blog-page">
    <CommunityTopBar hideSearch/>
    <div className="community-shell">
      <CommunitySideNav/><span className="community-sidenav-spacer" aria-hidden="true"/>
      {editor}
    </div>
    <ChatbotWidget/>
  </div>;
}
