import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock3, FileVideo, ImagePlus, LoaderCircle, Save, Send, X } from 'lucide-react';
import CommunityTopBar from '../components/community/CommunityTopBar';
import CommunitySideNav from '../components/community/CommunitySideNav';
import ChatbotWidget from '../components/chatbot/ChatbotWidget';
import { createMyBlog, createMyVideo, getBlogCategories, getMyBlog, getMyVideo, updateMyBlog, updateMyVideo, uploadBlogThumbnail } from '../services/authorBlogApi';
import { apiRequest } from '../services/apiClient';
import '../styles/my-blogs.css';
import '../styles/create-blog.css';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const CONTENT_TYPES = { BLOG: 'blog', VIDEO: 'video' };
const MAX_VIDEO_SIZE = 200 * 1024 * 1024;
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

const emptyRecipeDetails = {
  prepMinutes: '', cookMinutes: '', servings: '', calories: '', proteinG: '', carbsG: '', fatG: '', fiberG: '', sodiumMg: '', ingredients: '', steps: '',
};

const numericDetailLabels = [
  ['prepMinutes', 'Prep time', 'min'], ['cookMinutes', 'Cook time', 'min'], ['servings', 'Servings', ''], ['calories', 'Calories', 'kcal'],
  ['proteinG', 'Protein', 'g'], ['carbsG', 'Carbohydrates', 'g'], ['fatG', 'Fat', 'g'], ['fiberG', 'Fiber', 'g'], ['sodiumMg', 'Sodium', 'mg'],
];

function makeContentBody(body, details) {
  const facts = numericDetailLabels.filter(([key]) => String(details[key]).trim())
    .map(([key, label, unit]) => `${label}: ${String(details[key]).trim()}${unit ? ` ${unit}` : ''}`);
  const ingredients = details.ingredients.split('\n').map((item) => item.trim()).filter(Boolean);
  const steps = details.steps.split('\n').map((item) => item.trim()).filter(Boolean);
  const isHtml = /<[a-z][\s\S]*>/i.test(body);
  const escapeHtml = (value) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const list = (items) => `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
  const sections = [body];
  if (isHtml) {
    if (facts.length) sections.push(`<h2>Recipe details</h2>${list(facts)}`);
    sections.push(`<h2>Ingredients</h2>${list(ingredients)}`);
    sections.push(`<h2>Steps</h2>${list(steps.map((item, index) => `Step ${index + 1}: ${item}`))}`);
  } else {
    if (facts.length) sections.push(`## Recipe details\n${facts.map((item) => `- ${item}`).join('\n')}`);
    sections.push(`## Ingredients\n${ingredients.map((item) => `- ${item}`).join('\n')}`);
    sections.push(`## Steps\n${steps.map((item, index) => `- Step ${index + 1}: ${item}`).join('\n')}`);
  }
  return sections.join('\n\n');
}

function parseRecipeDetails(body = '') {
  const details = { ...emptyRecipeDetails };
  const setFacts = (facts) => facts.forEach((fact) => {
    const [key, label] = numericDetailLabels.find(([, detailLabel]) => fact.startsWith(`${detailLabel}:`)) ?? [];
    if (key) details[key] = fact.replace(`${label}:`, '').trim().replace(/\s*(min|kcal|mg|g)$/, '');
  });
  const section = (title) => new RegExp(`## ${title}\\n([\\s\\S]*?)(?=\\n\\n## |$)`).exec(body)?.[1] ?? '';

  if (!/<[a-z][\s\S]*>/i.test(body)) {
    const detailsSection = section('Recipe details');
    setFacts(detailsSection.split('\n').map((item) => item.replace(/^-\s*/, '').trim()).filter(Boolean));
    details.ingredients = section('Ingredients').split('\n').map((item) => item.replace(/^-\s*/, '').trim()).filter(Boolean).join('\n');
    details.steps = section('Steps').split('\n').map((item) => item.replace(/^-\s*(?:Step \d+:\s*)?/, '').trim()).filter(Boolean).join('\n');
    return { body: body.split(/\n\n## (?:Recipe details|Ingredients|Steps)\n/)[0].trim(), details };
  }

  const root = document.createElement('div');
  root.innerHTML = body;
  const headings = [...root.querySelectorAll('h2')];
  const findHeading = (title) => headings.find((heading) => heading.textContent.trim().toLowerCase() === title.toLowerCase());
  const recipeHeading = findHeading('Recipe details');
  const values = (title) => {
    const list = findHeading(title)?.nextElementSibling;
    return list?.tagName === 'UL' ? [...list.querySelectorAll('li')].map((item) => item.textContent.trim()).filter(Boolean) : [];
  };
  setFacts(values('Recipe details'));
  details.ingredients = values('Ingredients').join('\n');
  details.steps = values('Steps').map((item) => item.replace(/^Step \d+:\s*/, '')).join('\n');
  if (!recipeHeading) return { body, details };

  const main = [];
  for (const node of [...root.childNodes]) {
    if (node === recipeHeading) break;
    main.push(node.outerHTML ?? node.textContent ?? '');
  }
  return { body: main.join('').trim(), details };
}

async function uploadVideoFile(file) {
  const body = new FormData();
  body.append('file', file);
  const payload = await apiRequest('/api/v1/author/videos/upload', { method: 'POST', body });
  const data = payload?.data ?? payload ?? {};
  if (!data.mediaUrl) throw new Error('The video upload did not return a media URL.');
  return data;
}

function submitForReview(contentType, contentId) {
  const resource = contentType === CONTENT_TYPES.VIDEO ? 'videos' : 'blogs';
  return apiRequest(`/api/v1/author/${resource}/${contentId}/submit`, { method: 'POST' });
}

export default function CreateBlogPage({ modal = false, onClose, defaultType = 'blog' } = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const editing = location.pathname.match(/^\/community\/my-content\/(blog|video)\/([^/]+)\/edit$/);
  const editType = editing?.[1];
  const editId = editing?.[2];
  const preview = import.meta.env.DEV && new URLSearchParams(location.search).get('preview') === '1';
  const [contentType, setContentType] = useState(defaultType === 'video' ? CONTENT_TYPES.VIDEO : CONTENT_TYPES.BLOG);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [videoFile, setVideoFile] = useState(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState('');
  const [videoDuration, setVideoDuration] = useState(null);
  const [categoryId, setCategoryId] = useState('');
  const [categories, setCategories] = useState([]);
  const [file, setFile] = useState(null);
  const [imageUrl, setImageUrl] = useState('');
  const [recipeDetails, setRecipeDetails] = useState(emptyRecipeDetails);
  const [showRecipeDetails, setShowRecipeDetails] = useState(true);
  const [existingThumbnailUrl, setExistingThumbnailUrl] = useState('');
  const [existingMediaUrl, setExistingMediaUrl] = useState('');
  const [loadingContent, setLoadingContent] = useState(Boolean(editing));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const bodyRef = useRef(null);
  const dialogRef = useRef(null);
  const submitting = useRef(false);

  const isVideo = editing ? editType === CONTENT_TYPES.VIDEO : contentType === CONTENT_TYPES.VIDEO;
  const trimmedTitle = title.trim();
  const bodyHtml = body.trim();
  const trimmedBody = body.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').trim();
  const hasVideo = Boolean(videoFile || (editing && existingMediaUrl));
  const hasThumbnail = Boolean(file || existingThumbnailUrl);
  const hasRecipeDetails = Boolean(recipeDetails.ingredients.trim() && recipeDetails.steps.trim());

  function missingRequiredFields() {
    const missing = [];
    if (!trimmedTitle) missing.push('title');
    if (!trimmedBody) missing.push(isVideo ? 'video description' : 'post content');
    if (isVideo && !hasVideo) missing.push('video file');
    if (!hasThumbnail) missing.push(isVideo ? 'video thumbnail' : 'cover image');
    if (!recipeDetails.ingredients.trim()) missing.push('ingredients');
    if (!recipeDetails.steps.trim()) missing.push('preparation steps');
    if (!categoryId) missing.push('category');
    return missing;
  }

  useEffect(() => {
    if (!modal) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focus = requestAnimationFrame(() => dialogRef.current?.querySelector('#create-blog-title')?.focus());
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !submitting.current) onClose?.();
      if (event.key === 'Tab') {
        const controls = [...dialogRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [contenteditable=true], a[href]')]
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
    if (!editing) return undefined;
    const controller = new AbortController();
    const getContent = editType === 'video' ? getMyVideo : getMyBlog;
    getContent(editId, controller.signal).then((item) => {
      if (controller.signal.aborted) return;
      const parsed = parseRecipeDetails(item.body ?? '');
      setTitle(item.title ?? '');
      setBody(parsed.body);
      setRecipeDetails(parsed.details);
      setCategoryId(item.categoryId ? String(item.categoryId) : '');
      setExistingThumbnailUrl(item.thumbnailUrl ?? '');
      setExistingMediaUrl(item.mediaUrl ?? '');
    }).catch((failure) => {
      if (!controller.signal.aborted) setError(failure.status === 404 ? 'This post is no longer available.' : 'Could not load this post for editing.');
    }).finally(() => { if (!controller.signal.aborted) setLoadingContent(false); });
    return () => controller.abort();
  }, [editId, editType, editing]);

  useEffect(() => {
    if (!file) { setImageUrl(''); return undefined; }
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (!videoFile) { setVideoPreviewUrl(''); setVideoDuration(null); return undefined; }
    const url = URL.createObjectURL(videoFile);
    setVideoPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [videoFile]);

  useEffect(() => {
    if (!loadingContent && bodyRef.current && bodyRef.current.innerHTML !== body) bodyRef.current.innerHTML = body;
  }, [body, loadingContent]);

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

  function chooseVideo(event) {
    const selected = event.target.files?.[0];
    if (!selected) return;
    if (!VIDEO_TYPES.includes(selected.type) || selected.size > MAX_VIDEO_SIZE) {
      setError('Choose an MP4, WebM, or MOV video no larger than 200 MB.');
      event.target.value = '';
      return;
    }
    setError('');
    setVideoFile(selected);
  }

  async function submit(event, intent) {
    event.preventDefault();
    if (preview || submitting.current) return;
    const missing = missingRequiredFields();
    if (missing.length) {
      setError(`Please complete the required fields: ${missing.join(', ')}.`);
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      const thumbnailUrl = file ? await uploadBlogThumbnail(file) : existingThumbnailUrl || null;
      const payload = {
        title: trimmedTitle,
        body: makeContentBody(bodyHtml, recipeDetails),
        thumbnailUrl,
        categoryId: Number(categoryId),
      };
      let created;
      if (isVideo) {
        const uploadedVideo = videoFile ? await uploadVideoFile(videoFile) : null;
        const videoPayload = { ...payload, mediaUrl: uploadedVideo?.mediaUrl ?? existingMediaUrl };
        if (!videoPayload.mediaUrl) throw new Error('Upload a video file before saving.');
        const durationSec = videoDuration;
        if (Number.isFinite(durationSec) && durationSec > 0) videoPayload.durationSec = Math.round(durationSec);
        created = editing ? await updateMyVideo(editId, videoPayload) : await createMyVideo(videoPayload);
      } else {
        created = editing ? await updateMyBlog(editId, payload) : await createMyBlog(payload);
      }
      let finalStatus = created?.status || 'draft';
      if (intent === 'submit') {
        const targetId = editing ? editId : created?.contentId;
        const reviewRes = await submitForReview(isVideo ? CONTENT_TYPES.VIDEO : CONTENT_TYPES.BLOG, targetId);
        const reviewData = reviewRes?.data ?? reviewRes ?? {};
        finalStatus = reviewData.status || 'under_review';
      }
      navigate('/community/my-blogs', {
        state: {
          edited: editing,
          created: !editing,
          type: isVideo ? CONTENT_TYPES.VIDEO : CONTENT_TYPES.BLOG,
          submitted: intent === 'submit',
          status: finalStatus,
        },
      });
    } catch (failure) {
      setError(failure.status === 401 ? 'Your session expired. Please sign in again.' : failure.message || `Could not save your ${isVideo ? 'video' : 'blog'}. Please try again.`);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  const EditorTag = modal ? 'div' : 'main';
  const editor = <EditorTag className="create-blog-main">
    {modal ? <button type="button" className="create-blog-close" onClick={onClose} aria-label="Close editor" disabled={busy}><X size={19}/></button> : <Link to="/community/my-blogs" className="my-blogs-back"><ArrowLeft size={15}/> Back to my content</Link>}
    <header className="create-blog-header">
      <div className="create-blog-hero-copy"><p className="my-blogs-eyebrow">YOUR PERSONAL CONTENT</p><h1 id="create-blog-dialog-title">{editing ? 'Edit your post' : 'Create a post'}<span>.</span></h1><p>{editing ? 'Update the content, media, recipe details, and category, then save your changes.' : 'Choose Blog post or Video clip below, then add the information your community needs.'}</p></div>
    </header>
    <form className="create-blog-form" onSubmit={(event) => submit(event, 'draft')}>
      <div className="create-blog-panel">
        {!editing && <div className="create-blog-type-picker"><span>Post type</span><div className="create-blog-type-toggle" role="group" aria-label="Content type">
          <button type="button" className={!isVideo ? 'is-active' : ''} aria-pressed={!isVideo} onClick={() => { setContentType(CONTENT_TYPES.BLOG); setError(''); }} disabled={busy}>Blog post</button>
          <button type="button" className={isVideo ? 'is-active' : ''} aria-pressed={isVideo} onClick={() => { setContentType(CONTENT_TYPES.VIDEO); setError(''); }} disabled={busy}>Video clip</button>
        </div></div>}
        <div className="create-blog-section-heading"><span>01</span><div><h2>{isVideo ? 'Your video' : 'Your blog'}</h2><p>{isVideo ? 'Upload the clip and explain what viewers will learn.' : 'Give it a clear title and share the details your readers need.'}</p></div></div>
        <label htmlFor="create-blog-title">Title <small>{title.length}/255</small></label>
        <input id="create-blog-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={255} placeholder="What would you like to share?" disabled={busy}/>
        {isVideo && <div className="create-video-upload">
          <label htmlFor="create-video-file"><FileVideo size={20}/><span><b>{videoFile ? videoFile.name : 'Upload a video file'}</b><small>MP4, WebM, or MOV · max 200 MB</small></span></label>
          <input id="create-video-file" type="file" accept="video/mp4,video/webm,video/quicktime" onChange={chooseVideo} disabled={busy}/>
          {videoFile && <button type="button" className="create-blog-remove" onClick={() => setVideoFile(null)} disabled={busy}><X size={14}/> Remove replacement</button>}
          {videoPreviewUrl && <video className="create-video-preview" src={videoPreviewUrl} controls preload="metadata" onLoadedMetadata={(event) => setVideoDuration(event.currentTarget.duration)} aria-label="Video file preview"/>}
        </div>}
        <label htmlFor="create-blog-body">{isVideo ? 'Video description' : 'Post content'}</label>
        <div className="create-blog-editor"><div id="create-blog-body" ref={bodyRef} className="create-blog-rich-editor" contentEditable={!busy} role="textbox" aria-multiline="true" aria-label={isVideo ? 'Video description' : 'Article'} data-placeholder={isVideo ? 'Describe what viewers will learn...' : 'Start writing your story...'} onInput={(event) => setBody(event.currentTarget.innerHTML)} /></div>
        <section className="create-blog-detail-fields">
          <div className="create-recipe-toggle"><div className="create-blog-section-heading"><span><Clock3 size={16}/></span><div><h2>Recipe details</h2><p>Required ingredients and preparation steps for this {isVideo ? 'video' : 'blog'}.</p></div></div><button type="button" className={showRecipeDetails ? 'is-active' : ''} aria-expanded={showRecipeDetails} onClick={() => setShowRecipeDetails((visible) => !visible)} disabled={busy}>{showRecipeDetails ? 'Hide details' : 'Show details'}</button></div>
          {showRecipeDetails && <><div className="create-blog-detail-grid">
            {numericDetailLabels.map(([key, label, unit]) => <label key={key} htmlFor={`recipe-${key}`}>{label}{unit && <small>{unit}</small>}<input id={`recipe-${key}`} type="number" min="0" step={key === 'servings' ? '1' : '0.1'} value={recipeDetails[key]} onChange={(event) => setRecipeDetails({ ...recipeDetails, [key]: event.target.value })} disabled={busy}/></label>)}
          </div>
          <label htmlFor="recipe-ingredients">Ingredients <small>required · one item per line</small></label>
          <textarea id="recipe-ingredients" rows={4} value={recipeDetails.ingredients} onChange={(event) => setRecipeDetails({ ...recipeDetails, ingredients: event.target.value })} placeholder={'200 g tofu\n1 tbsp olive oil'} disabled={busy}/>
          <label htmlFor="recipe-steps">Preparation steps <small>required · one step per line</small></label>
          <textarea id="recipe-steps" rows={4} value={recipeDetails.steps} onChange={(event) => setRecipeDetails({ ...recipeDetails, steps: event.target.value })} placeholder={'Press the tofu dry\nPan-fry until crisp'} disabled={busy}/></>}
        </section>
      </div>
      <aside className="create-blog-settings">
        <div className="create-blog-panel"><div className="create-blog-section-heading"><span>02</span><div><h2>{isVideo ? 'Video thumbnail' : 'Cover image'}</h2><p>{isVideo ? 'Required preview image for the uploaded video.' : 'Required cover image for this blog.'}</p></div></div>
          <label className="create-blog-upload" htmlFor="create-blog-image">{imageUrl || existingThumbnailUrl ? <img src={imageUrl || existingThumbnailUrl} alt={isVideo ? 'Selected video thumbnail preview' : 'Selected cover preview'}/> : <><ImagePlus size={30}/><strong>{isVideo ? 'Upload a video thumbnail' : 'Upload a cover image'}</strong><span>Required · JPG, PNG, or WebP - max 5 MB</span></>}</label>
          <input id="create-blog-image" type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseImage} disabled={busy}/>
          {(file || existingThumbnailUrl) && <button type="button" className="create-blog-remove" onClick={() => { setFile(null); setExistingThumbnailUrl(''); }} disabled={busy}><X size={14}/> Remove image</button>}
        </div>
        <div className="create-blog-panel"><div className="create-blog-section-heading"><span>03</span><div><h2>Category</h2><p>Choose where your {isVideo ? 'video' : 'blog'} belongs.</p></div></div>
          <label htmlFor="create-blog-category">Post category <small>required</small></label>
          <select id="create-blog-category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)} disabled={busy || !categories.length}><option value="">Select category</option>{categories.map((item) => <option key={item.categoryId} value={item.categoryId}>{item.name ?? item.categoryName}</option>)}</select>
          {!categories.length && <p className="create-blog-hint">Categories will appear here when the backend provides them.</p>}
        </div>
        {error && <p className="create-blog-error" role="alert">{error} {error.includes('session') && <Link to="/login">Sign in</Link>}</p>}
        <div className="create-blog-submit-actions">
          <button className="my-blog-button create-blog-submit create-blog-submit--secondary" type="submit" disabled={preview || loadingContent || busy}>{busy ? <><LoaderCircle className="my-blogs-spinner" size={16}/> Saving...</> : <><Save size={16}/>{editing ? ' Save changes' : ' Save draft'}</>}</button>
          <button className="my-blog-button create-blog-submit" type="button" onClick={(event) => submit(event, 'submit')} disabled={preview || loadingContent || busy}>{busy ? <><LoaderCircle className="my-blogs-spinner" size={16}/> Submitting...</> : <><Send size={16}/> Submit for review</>}</button>
        </div>
      </aside>
    </form>
  </EditorTag>;

  if (modal) return <div className="create-blog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose?.(); }}>
    <div ref={dialogRef} className="create-blog-dialog create-blog-page" role="dialog" aria-modal="true" aria-labelledby="create-blog-dialog-title">
      {editor}
    </div>
  </div>;

  return <div className="community-page create-blog-page">
    <CommunityTopBar/>
    <div className="community-shell">
      <CommunitySideNav/><span className="community-sidenav-spacer" aria-hidden="true"/>
      {editor}
    </div>
    <ChatbotWidget/>
  </div>;
}
