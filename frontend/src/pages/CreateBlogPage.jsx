import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileVideo, ImagePlus, LoaderCircle, Send, X } from 'lucide-react';
import CommunityTopBar from '../components/community/CommunityTopBar';
import CommunitySideNav from '../components/community/CommunitySideNav';
import ChatbotWidget from '../components/chatbot/ChatbotWidget';
import { createMyContent, getBlogCategories, uploadBlogThumbnail, uploadVideoFile } from '../services/authorBlogApi';
import '../styles/my-blogs.css';
import '../styles/create-blog.css';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_VIDEO_SIZE = 100 * 1024 * 1024;

export default function CreateBlogPage({ modal = false, onClose } = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const preview = import.meta.env.DEV && new URLSearchParams(location.search).get('preview') === '1';
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [videoFile, setVideoFile] = useState(null);
  const [durationMinutes, setDurationMinutes] = useState('');
  const [prepTimeMin, setPrepTimeMin] = useState('');
  const [cookTimeMin, setCookTimeMin] = useState('');
  const [servings, setServings] = useState('');
  const [calories, setCalories] = useState('');
  const [proteinG, setProteinG] = useState('');
  const [carbsG, setCarbsG] = useState('');
  const [fatG, setFatG] = useState('');
  const [fiberG, setFiberG] = useState('');
  const [sodiumMg, setSodiumMg] = useState('');
  const [ingredientsText, setIngredientsText] = useState('');
  const [stepsText, setStepsText] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [categories, setCategories] = useState([]);
  const [file, setFile] = useState(null);
  const [imageUrl, setImageUrl] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const bodyRef = useRef(null);
  const dialogRef = useRef(null);
  const submitting = useRef(false);

  const trimmedTitle = title.trim();
  const trimmedBody = body.trim();
  const parsedDuration = Number(durationMinutes);
  const ingredients = ingredientsText.split('\n').map((value) => value.trim()).filter(Boolean);
  const steps = stepsText.split('\n').map((value) => value.trim()).filter(Boolean);
  const numericValues = [prepTimeMin, cookTimeMin, servings, calories, proteinG, carbsG, fatG, fiberG, sodiumMg];
  const canSubmit = trimmedTitle && trimmedBody && categoryId && file && ingredients.length && steps.length
    && numericValues.every((value) => value !== '' && Number(value) >= 0) && Number(servings) > 0;

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

  function chooseVideo(event) {
    const selected = event.target.files?.[0];
    if (!selected) return;
    if (selected.type !== 'video/mp4' || selected.size > MAX_VIDEO_SIZE) {
      setError('Choose an MP4 video smaller than 100 MB.');
      event.target.value = '';
      return;
    }
    setError('');
    setVideoFile(selected);
  }

  async function submit(event) {
    event.preventDefault();
    if (preview || submitting.current || !canSubmit) return;
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      const thumbnailUrl = await uploadBlogThumbnail(file);
      const payload = {
        contentType: videoFile ? 'VIDEO' : 'BLOG', title: trimmedTitle, body: trimmedBody, thumbnailUrl, categoryId: Number(categoryId),
        prepTimeMin: Number(prepTimeMin), cookTimeMin: Number(cookTimeMin), servings: Number(servings), calories: Number(calories),
        proteinG: Number(proteinG), carbsG: Number(carbsG), fatG: Number(fatG), fiberG: Number(fiberG), sodiumMg: Number(sodiumMg), ingredients, steps,
      };
      if (videoFile) {
        const videoPayload = { ...payload, mediaUrl: await uploadVideoFile(videoFile) };
        if (Number.isFinite(parsedDuration) && parsedDuration > 0) videoPayload.durationSec = Math.round(parsedDuration * 60);
        await createMyContent(videoPayload);
      } else {
        await createMyContent(payload);
      }
      navigate('/community/my-blogs', { state: { created: true, type: videoFile ? 'video' : 'blog' } });
    } catch (failure) {
      setError(failure.status === 401 ? 'Your session expired. Please sign in again.' : failure.message || 'Could not save your post. Please try again.');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  const EditorTag = modal ? 'div' : 'main';
  const editor = <EditorTag className="create-blog-main">
    {modal ? <button type="button" className="create-blog-close" onClick={onClose} aria-label="Close editor" disabled={busy}><X size={19}/></button> : <Link to="/community/my-blogs" className="my-blogs-back"><ArrowLeft size={15}/> Back to my blogs</Link>}
    <header className="create-blog-header">
      <div className="create-blog-hero-copy"><p className="my-blogs-eyebrow">YOUR PERSONAL JOURNAL</p><h1 id="create-blog-dialog-title">Create a post<span>.</span></h1><p>Write the recipe once, then add a cover image and an MP4 clip if you have one.</p></div>
    </header>
    <form className="create-blog-form" onSubmit={submit}>
      <div className="create-blog-content-column">
      <div className="create-blog-panel">
        <div className="create-blog-section-heading"><span>01</span><div><h2>Your recipe</h2><p>Add the information readers will see on the detail page.</p></div></div>
        <label htmlFor="create-blog-title">Title <small>{title.length}/255</small></label>
        <input id="create-blog-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={255} required placeholder="What would you like to share?" disabled={busy}/>
        <label htmlFor="create-blog-body">Description</label>
        <div className="create-blog-editor"><textarea id="create-blog-body" ref={bodyRef} value={body} onChange={(event) => setBody(event.target.value)} rows={5} required placeholder="Describe the recipe, tips, and anything readers should know..." disabled={busy}/></div>
      </div>
        <section className="create-blog-recipe-fields">
          <div className="create-blog-section-heading"><span>02</span><div><h2>Recipe details</h2><p>These required fields are shown when readers open your post.</p></div></div>
          <div className="create-blog-number-grid">
            <label>Prep time (min)<input type="number" min="0" value={prepTimeMin} onChange={(event) => setPrepTimeMin(event.target.value)} required disabled={busy}/></label>
            <label>Cook time (min)<input type="number" min="0" value={cookTimeMin} onChange={(event) => setCookTimeMin(event.target.value)} required disabled={busy}/></label>
            <label>Servings<input type="number" min="1" value={servings} onChange={(event) => setServings(event.target.value)} required disabled={busy}/></label>
            <label>Calories (kcal)<input type="number" min="0" value={calories} onChange={(event) => setCalories(event.target.value)} required disabled={busy}/></label>
            <label>Protein (g)<input type="number" min="0" step="0.1" value={proteinG} onChange={(event) => setProteinG(event.target.value)} required disabled={busy}/></label>
            <label>Carbs (g)<input type="number" min="0" step="0.1" value={carbsG} onChange={(event) => setCarbsG(event.target.value)} required disabled={busy}/></label>
            <label>Healthy fats (g)<input type="number" min="0" step="0.1" value={fatG} onChange={(event) => setFatG(event.target.value)} required disabled={busy}/></label>
            <label>Fiber (g)<input type="number" min="0" step="0.1" value={fiberG} onChange={(event) => setFiberG(event.target.value)} required disabled={busy}/></label>
            <label>Sodium (mg)<input type="number" min="0" step="0.1" value={sodiumMg} onChange={(event) => setSodiumMg(event.target.value)} required disabled={busy}/></label>
          </div>
          <label htmlFor="create-ingredients">Ingredients <small>one ingredient per line</small></label>
          <textarea id="create-ingredients" value={ingredientsText} onChange={(event) => setIngredientsText(event.target.value)} required placeholder={'150g tofu\n1 cup mushrooms'} disabled={busy}/>
          <label htmlFor="create-steps">Method <small>one step per line</small></label>
          <textarea id="create-steps" value={stepsText} onChange={(event) => setStepsText(event.target.value)} required placeholder={'Press the tofu.\nCook until golden.'} disabled={busy}/>
        </section>
      </div>
      <aside className="create-blog-settings">
        <div className="create-blog-panel"><div className="create-blog-section-heading"><span>03</span><div><h2>Media</h2><p>Cover image is required. MP4 clip is optional.</p></div></div>
          <label className="create-blog-upload" htmlFor="create-blog-image">{imageUrl ? <img src={imageUrl} alt="Selected cover preview"/> : <><ImagePlus size={30}/><strong>Upload a cover image</strong><span>Required · JPG, PNG, or WebP · max 5 MB</span></>}</label>
          <input id="create-blog-image" type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseImage} disabled={busy}/>
          {file && <button type="button" className="create-blog-remove" onClick={() => setFile(null)} disabled={busy}><X size={14}/> Remove image</button>}
          <div className="create-video-field">
            <label htmlFor="create-video-file">MP4 video <small>optional, max 100 MB</small></label>
            <label className="create-video-file-input" htmlFor="create-video-file"><FileVideo size={17}/><span>{videoFile ? videoFile.name : 'Choose MP4 file'}</span></label>
            <input id="create-video-file" type="file" accept="video/mp4,.mp4" onChange={chooseVideo} disabled={busy}/>
            {videoFile && <button type="button" className="create-blog-remove" onClick={() => setVideoFile(null)} disabled={busy}><X size={14}/> Remove video</button>}
          </div>
          <div className="create-video-field">
            <label htmlFor="create-video-duration">Video duration <small>only if MP4 is attached</small></label>
            <input id="create-video-duration" type="number" min="1" max="600" step="0.5" value={durationMinutes} onChange={(event) => setDurationMinutes(event.target.value)} placeholder="8" disabled={busy || !videoFile}/>
          </div>
        </div>
        <div className="create-blog-panel"><div className="create-blog-section-heading"><span>04</span><div><h2>Category</h2><p>Choose where your post belongs.</p></div></div>
          <label htmlFor="create-blog-category">Category <small>required</small></label>
          <select id="create-blog-category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)} disabled={busy || !categories.length}><option value="">Select category</option>{categories.map((item) => <option key={item.categoryId} value={item.categoryId}>{item.name ?? item.categoryName}</option>)}</select>
          {!categories.length && <p className="create-blog-hint">Categories will appear here when the backend provides them.</p>}
        </div>
        {error && <p className="create-blog-error" role="alert">{error} {error.includes('session') && <Link to="/login">Sign in</Link>}</p>}
        <button className="my-blog-button create-blog-submit" type="submit" disabled={preview || busy || !canSubmit}>{busy ? <><LoaderCircle className="my-blogs-spinner" size={16}/> Uploading & saving...</> : <><Send size={16}/> {preview ? 'Sign in to save' : 'Save post draft'}</>}</button>
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
