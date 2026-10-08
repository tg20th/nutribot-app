import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Clock3, FileVideo, ImagePlus, LoaderCircle, Plus, Save, Send, Sparkles, Trash2, X } from 'lucide-react';
import CommunityTopBar from '../components/community/CommunityTopBar';
import CommunitySideNav from '../components/community/CommunitySideNav';
import ChatbotWidget from '../components/chatbot/ChatbotWidget';
import { calculateRecipeNutrition, createMyBlog, createMyVideo, getBlogCategories, getMyBlog, getMyVideo, updateMyBlog, updateMyVideo, uploadBlogThumbnail } from '../services/authorBlogApi';
import { getAllergyIngredients } from '../services/profileApi';
import { stripHtmlToCleanText } from '../services/communityApi';
import { apiRequest } from '../services/apiClient';
import '../styles/my-blogs.css';
import '../styles/create-blog.css';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const CONTENT_TYPES = { BLOG: 'blog', VIDEO: 'video' };
const MAX_VIDEO_SIZE = 200 * 1024 * 1024;
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

const FALLBACK_INGREDIENTS = [
  'Đậu phụ (Tofu)', 'Cà chua', 'Hành tây', 'Cà rốt', 'Rau cải xanh', 'Bắp cải', 'Khoai tây',
  'Hành lá', 'Ớt chuông', 'Gừng', 'Tỏi', 'Nấm hương', 'Nấm đùi gà', 'Nấm rơm', 'Súp lơ (Bông cải xanh)',
  'Rau chân vịt (Bina)', 'Bí đỏ', 'Dưa leo', 'Trứng gà', 'Sữa chua Hy Lạp', 'Sữa tươi không đường',
  'Yến mạch', 'Gạo lứt', 'Quinoa (Hạt diêm mạch)', 'Bánh mì nguyên cám', 'Hạt chia', 'Hạt óc chó',
  'Hạnh nhân', 'Đậu đen', 'Đậu gà (Chickpeas)', 'Dầu ô-liu', 'Dầu mè', 'Mật ong', 'Chuối',
  'Bơ (Avocado)', 'Táo', 'Ức gà', 'Cá hồi', 'Tôm sú', 'Thịt bò nạc'
];

const MEASUREMENT_UNITS = [
  { value: 'g', label: 'g (Gram)' },
  { value: 'ml', label: 'ml (Mililit)' },
  { value: 'kg', label: 'kg' },
  { value: 'l', label: 'l (Lít)' },
  { value: 'tbsp', label: 'tbsp (Thìa canh)' },
  { value: 'tsp', label: 'tsp (Thìa cà phê)' },
  { value: 'quả', label: 'quả / trái' },
  { value: 'củ', label: 'củ' },
  { value: 'chén', label: 'chén / bát' },
  { value: 'cái', label: 'cái / lát' },
  { value: 'gói', label: 'gói / hộp' },
];

const emptyRecipeDetails = {
  prepMinutes: '', cookMinutes: '', servings: '', calories: '', proteinG: '', carbsG: '', fatG: '', fiberG: '', sodiumMg: '',
};

const numericDetailLabels = [
  ['prepMinutes', 'Prep time', 'min'], ['cookMinutes', 'Cook time', 'min'], ['servings', 'Servings', ''], ['calories', 'Calories', 'kcal'],
  ['proteinG', 'Protein', 'g'], ['carbsG', 'Carbohydrates', 'g'], ['fatG', 'Fat', 'g'], ['fiberG', 'Fiber', 'g'], ['sodiumMg', 'Sodium', 'mg'],
];

function makeContentBody(body, details, ingredientRows = [], stepRows = []) {
  const cleanBody = stripHtmlToCleanText(body);
  const facts = numericDetailLabels.filter(([key]) => String(details[key]).trim())
    .map(([key, label, unit]) => `${label}: ${String(details[key]).trim()}${unit ? ` ${unit}` : ''}`);
  
  const ingredients = ingredientRows
    .map((row) => {
      const name = (row.isCustom ? row.customName : row.name)?.trim();
      if (!name) return '';
      const qty = row.quantity ? `${row.quantity} ${row.unit || 'g'}` : '';
      return qty ? `${qty} ${name}` : name;
    })
    .filter(Boolean);

  const steps = stepRows.map((item) => item.trim()).filter(Boolean);
  const sections = [cleanBody || body];
  if (facts.length) sections.push(`## Recipe details\n${facts.map((item) => `- ${item}`).join('\n')}`);
  if (ingredients.length) sections.push(`## Ingredients\n${ingredients.map((item) => `- ${item}`).join('\n')}`);
  if (steps.length) sections.push(`## Steps\n${steps.map((item, index) => `- Step ${index + 1}: ${item}`).join('\n')}`);
  return sections.join('\n\n');
}

function parseRecipeDetails(body = '', availableOptions = []) {
  const details = { ...emptyRecipeDetails };
  const setFacts = (facts) => facts.forEach((fact) => {
    const [key, label] = numericDetailLabels.find(([, detailLabel]) => fact.startsWith(`${detailLabel}:`)) ?? [];
    if (key) details[key] = fact.replace(`${label}:`, '').trim().replace(/\s*(min|kcal|mg|g)$/, '');
  });
  const section = (title) => new RegExp(`## ${title}\\n([\\s\\S]*?)(?=\\n\\n## |$)`).exec(body)?.[1] ?? '';

  let rawIngredients = '';
  let rawSteps = '';
  let cleanBody = body;

  if (!/<[a-z][\s\S]*>/i.test(body)) {
    const detailsSection = section('Recipe details');
    setFacts(detailsSection.split('\n').map((item) => item.replace(/^-\s*/, '').trim()).filter(Boolean));
    rawIngredients = section('Ingredients').split('\n').map((item) => item.replace(/^-\s*/, '').trim()).filter(Boolean).join('\n');
    rawSteps = section('Steps').split('\n').map((item) => item.replace(/^-\s*(?:Step \d+:\s*)?/, '').trim()).filter(Boolean).join('\n');
    cleanBody = body.split(/\n\n## (?:Recipe details|Ingredients|Steps)\n/)[0].trim();
  } else {
    const root = document.createElement('div');
    root.innerHTML = body;
    const headings = [...root.querySelectorAll('h2')];
    const findHeading = (title) => headings.find((heading) => heading.textContent.trim().toLowerCase() === title.toLowerCase());
    const recipeHeading = findHeading('Recipe details');
    const values = (title) => {
      const el = findHeading(title)?.nextElementSibling;
      return el?.tagName === 'UL' ? [...el.querySelectorAll('li')].map((item) => item.textContent.trim()).filter(Boolean) : [];
    };
    setFacts(values('Recipe details'));
    rawIngredients = values('Ingredients').join('\n');
    rawSteps = values('Steps').map((item) => item.replace(/^Step \d+:\s*/, '')).join('\n');
    if (recipeHeading) {
      const main = [];
      for (const node of [...root.childNodes]) {
        if (node === recipeHeading) break;
        main.push(node.outerHTML ?? node.textContent ?? '');
      }
      cleanBody = main.join('').trim();
    }
  }

  const ingredientLines = rawIngredients.split('\n').map((l) => l.trim()).filter(Boolean);
  const parsedIngredientRows = ingredientLines.map((line) => {
    const match = line.match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z\u00C0-\u024F\u1EA0-\u1EF9]+)?\s*(.*)$/);
    if (match) {
      const qty = match[1] || '';
      const unitCand = (match[2] || '').toLowerCase();
      const isKnownUnit = MEASUREMENT_UNITS.some((u) => u.value === unitCand);
      const unit = isKnownUnit ? unitCand : 'g';
      const name = (isKnownUnit ? match[3] : `${match[2] || ''} ${match[3]}`).trim();
      const matched = availableOptions.find((ing) => (ing.name || ing).toLowerCase() === name.toLowerCase());
      if (matched) {
        return { name: matched.name || matched, quantity: qty, unit, isCustom: false, customName: '' };
      }
      return { name: '__custom__', quantity: qty, unit, isCustom: true, customName: name || line };
    }
    return { name: '__custom__', quantity: '', unit: 'g', isCustom: true, customName: line };
  });

  const parsedStepRows = rawSteps.split('\n').map((l) => l.trim()).filter(Boolean);

  return {
    body: cleanBody,
    details,
    ingredientRows: parsedIngredientRows.length ? parsedIngredientRows : [{ name: '', quantity: '', unit: 'g', isCustom: false, customName: '' }],
    stepRows: parsedStepRows.length ? parsedStepRows : [''],
  };
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
  const [availableIngredients, setAvailableIngredients] = useState([]);
  const [ingredientRows, setIngredientRows] = useState([{ name: '', quantity: '', unit: 'g', isCustom: false, customName: '' }]);
  const [stepRows, setStepRows] = useState(['']);
  const [isCalculatingNutrition, setIsCalculatingNutrition] = useState(false);
  const [aiCalcSuccess, setAiCalcSuccess] = useState('');
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

  const combinedIngredients = useMemo(() => {
    const names = new Set();
    const list = [];
    (availableIngredients || []).forEach((item) => {
      const name = item?.name || item;
      if (name && !names.has(name.toLowerCase())) {
        names.add(name.toLowerCase());
        list.push(name);
      }
    });
    FALLBACK_INGREDIENTS.forEach((name) => {
      if (!names.has(name.toLowerCase())) {
        names.add(name.toLowerCase());
        list.push(name);
      }
    });
    return list.sort((a, b) => a.localeCompare(b, 'vi'));
  }, [availableIngredients]);

  function missingRequiredFields() {
    const missing = [];
    if (!trimmedTitle) missing.push('tiêu đề (title)');
    if (!trimmedBody) missing.push(isVideo ? 'mô tả video' : 'nội dung bài viết');
    if (isVideo && !hasVideo) missing.push('video tải lên');
    if (!hasThumbnail) missing.push(isVideo ? 'ảnh đại diện video' : 'ảnh bìa bài viết');
    const validIngredients = ingredientRows.map((r) => (r.isCustom ? r.customName : r.name)?.trim()).filter(Boolean);
    const validSteps = stepRows.map((s) => s.trim()).filter(Boolean);
    if (!validIngredients.length) missing.push('thành phần nguyên liệu (ingredients)');
    if (!validSteps.length) missing.push('các bước chế biến (steps)');
    if (!categoryId) missing.push('danh mục (category)');
    return missing;
  }

  function addIngredientRow() {
    setIngredientRows((prev) => [...prev, { name: '', quantity: '', unit: 'g', isCustom: false, customName: '' }]);
  }

  function updateIngredientRow(index, field, value) {
    setIngredientRows((prev) => prev.map((row, i) => {
      if (i !== index) return row;
      if (field === 'name') {
        if (value === '__custom__') {
          return { ...row, name: '__custom__', isCustom: true };
        }
        return { ...row, name: value, isCustom: false, customName: '' };
      }
      return { ...row, [field]: value };
    }));
  }

  function removeIngredientRow(index) {
    setIngredientRows((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : [{ name: '', quantity: '', unit: 'g', isCustom: false, customName: '' }]));
  }

  function addStepRow() {
    setStepRows((prev) => [...prev, '']);
  }

  function updateStepRow(index, value) {
    setStepRows((prev) => prev.map((step, i) => (i === index ? value : step)));
  }

  function removeStepRow(index) {
    setStepRows((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : ['']));
  }

  async function handleCalculateNutrition() {
    const validIngredients = ingredientRows
      .map((row) => ({
        name: (row.isCustom ? row.customName : row.name)?.trim(),
        quantity: Number(row.quantity) || 0,
        unit: row.unit || 'g',
      }))
      .filter((row) => Boolean(row.name));

    if (!validIngredients.length) {
      setError('Vui lòng chọn hoặc nhập ít nhất một nguyên liệu trước khi tính dinh dưỡng.');
      return;
    }

    setIsCalculatingNutrition(true);
    setError('');
    setAiCalcSuccess('');

    try {
      const servings = Number(recipeDetails.servings) || 1;
      const res = await calculateRecipeNutrition({
        servings,
        dishName: trimmedTitle || 'Món ăn dinh dưỡng',
        ingredients: validIngredients,
      });
      const facts = res?.nutritionFacts || res || {};
      setRecipeDetails((prev) => ({
        ...prev,
        calories: facts.calories != null ? String(facts.calories) : prev.calories,
        proteinG: facts.proteinG != null ? String(facts.proteinG) : prev.proteinG,
        carbsG: facts.carbsG != null ? String(facts.carbsG) : prev.carbsG,
        fatG: facts.fatG != null ? String(facts.fatG) : prev.fatG,
        fiberG: facts.fiberG != null ? String(facts.fiberG) : prev.fiberG,
        sodiumMg: facts.sodiumMg != null ? String(facts.sodiumMg) : prev.sodiumMg,
      }));
      setAiCalcSuccess('AI đã tự động tính toán dinh dưỡng thành công dựa trên nguyên liệu của bạn!');
    } catch (err) {
      setError('Không thể tính toán dinh dưỡng tự động lúc này. Bạn có thể tự nhập thủ công.');
    } finally {
      setIsCalculatingNutrition(false);
    }
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
    const controller = new AbortController();
    getAllergyIngredients(controller.signal)
      .then((items) => {
        if (!controller.signal.aborted && Array.isArray(items) && items.length) {
          setAvailableIngredients(items);
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!editing) return undefined;
    const controller = new AbortController();
    const getContent = editType === 'video' ? getMyVideo : getMyBlog;
    getContent(editId, controller.signal).then((item) => {
      if (controller.signal.aborted) return;
      const parsed = parseRecipeDetails(item.body ?? '', availableIngredients);
      setTitle(item.title ?? '');
      setBody(parsed.body);
      setRecipeDetails(parsed.details);
      setIngredientRows(parsed.ingredientRows);
      setStepRows(parsed.stepRows);
      setCategoryId(item.categoryId ? String(item.categoryId) : '');
      setExistingThumbnailUrl(item.thumbnailUrl ?? '');
      setExistingMediaUrl(item.mediaUrl ?? '');
    }).catch((failure) => {
      if (!controller.signal.aborted) setError(failure.status === 404 ? 'This post is no longer available.' : 'Could not load this post for editing.');
    }).finally(() => { if (!controller.signal.aborted) setLoadingContent(false); });
    return () => controller.abort();
  }, [editId, editType, editing, availableIngredients]);

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
      setError(`Vui lòng điền đủ các trường bắt buộc: ${missing.join(', ')}.`);
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      const thumbnailUrl = file ? await uploadBlogThumbnail(file) : existingThumbnailUrl || null;
      const payload = {
        title: trimmedTitle,
        body: makeContentBody(bodyHtml, recipeDetails, ingredientRows, stepRows),
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

      const canPrioritizeOnFeed = !editing
        && intent === 'submit'
        && String(finalStatus).toLowerCase() === 'published'
        && created?.contentId != null;
      if (canPrioritizeOnFeed) {
        navigate('/home', { state: { prioritizeContentId: created.contentId } });
        return;
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
      setError(failure.status === 401 ? 'Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.' : failure.message || `Không thể lưu bài viết. Vui lòng thử lại.`);
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
          <div className="create-recipe-toggle">
            <div className="create-blog-section-heading">
              <span><Clock3 size={16}/></span>
              <div>
                <h2>Thông tin công thức (Recipe details)</h2>
                <p>Thành phần nguyên liệu, tính toán dinh dưỡng và các bước thực hiện.</p>
              </div>
            </div>
            <button
              type="button"
              className={showRecipeDetails ? 'is-active' : ''}
              aria-expanded={showRecipeDetails}
              onClick={() => setShowRecipeDetails((visible) => !visible)}
              disabled={busy}
            >
              {showRecipeDetails ? 'Ẩn chi tiết' : 'Hiện chi tiết'}
            </button>
          </div>

          {showRecipeDetails && (
            <>
              {/* PHẦN 1: NGUYÊN LIỆU (SELECT + KHỐI LƯỢNG) */}
              <div className="recipe-subhead">
                <label>
                  <span>Thành phần nguyên liệu (Ingredients) <small>chọn nguyên liệu và nhập định lượng</small></span>
                </label>
              </div>

              <div className="recipe-ingredient-rows" role="group" aria-label="Danh sách nguyên liệu">
                {ingredientRows.map((row, index) => (
                  <div key={index} className="recipe-ingredient-row">
                    {!row.isCustom ? (
                      <select
                        className="recipe-ingredient-select"
                        value={row.name}
                        onChange={(e) => updateIngredientRow(index, 'name', e.target.value)}
                        disabled={busy}
                        aria-label={`Chọn nguyên liệu ${index + 1}`}
                      >
                        <option value="">-- Chọn nguyên liệu --</option>
                        {combinedIngredients.map((name) => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                        <option value="__custom__">➕ Khác (tự gõ tên)...</option>
                      </select>
                    ) : (
                      <div className="recipe-custom-input-wrap">
                        <input
                          type="text"
                          className="recipe-ingredient-custom-input"
                          placeholder="Tên nguyên liệu..."
                          value={row.customName}
                          onChange={(e) => updateIngredientRow(index, 'customName', e.target.value)}
                          disabled={busy}
                          aria-label={`Nhập tên nguyên liệu ${index + 1}`}
                        />
                        <button
                          type="button"
                          className="recipe-back-to-select-btn"
                          title="Chọn từ danh sách có sẵn"
                          onClick={() => updateIngredientRow(index, 'name', '')}
                          disabled={busy}
                        >
                          Danh sách
                        </button>
                      </div>
                    )}

                    <input
                      type="number"
                      min="0"
                      step="any"
                      className="recipe-ingredient-qty"
                      placeholder="Khối lượng"
                      value={row.quantity}
                      onChange={(e) => updateIngredientRow(index, 'quantity', e.target.value)}
                      disabled={busy}
                      aria-label={`Khối lượng nguyên liệu ${index + 1}`}
                    />

                    <select
                      className="recipe-ingredient-unit"
                      value={row.unit}
                      onChange={(e) => updateIngredientRow(index, 'unit', e.target.value)}
                      disabled={busy}
                      aria-label={`Đơn vị nguyên liệu ${index + 1}`}
                    >
                      {MEASUREMENT_UNITS.map((u) => (
                        <option key={u.value} value={u.value}>{u.label}</option>
                      ))}
                    </select>

                    <button
                      type="button"
                      className="recipe-row-remove-btn"
                      title="Xóa nguyên liệu này"
                      aria-label={`Xóa nguyên liệu ${index + 1}`}
                      onClick={() => removeIngredientRow(index)}
                      disabled={busy}
                    >
                      <Trash2 size={15}/>
                    </button>
                  </div>
                ))}
              </div>

              <div className="recipe-row-actions">
                <button
                  type="button"
                  className="recipe-add-row-btn"
                  onClick={addIngredientRow}
                  disabled={busy}
                >
                  <Plus size={15}/> Thêm nguyên liệu
                </button>

                <button
                  type="button"
                  className="recipe-ai-calc-btn"
                  onClick={handleCalculateNutrition}
                  disabled={busy || isCalculatingNutrition}
                >
                  {isCalculatingNutrition ? (
                    <>
                      <LoaderCircle className="my-blogs-spinner" size={15}/>
                      <span>AI đang tính toán...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={15}/>
                      <span>Tự động tính dinh dưỡng bằng AI</span>
                    </>
                  )}
                </button>
              </div>

              {aiCalcSuccess && (
                <div className="recipe-ai-feedback-banner">
                  <CheckCircle2 size={16}/>
                  <span>{aiCalcSuccess}</span>
                </div>
              )}

              {/* PHẦN 2: THÔNG SỐ DINH DƯỠNG & THỜI GIAN */}
              <div className="recipe-subhead" style={{ marginTop: '18px' }}>
                <label>
                  <span>Chỉ số dinh dưỡng & Thời gian <small>AI tự động điền hoặc nhập thủ công</small></span>
                </label>
              </div>

              <div className="create-blog-detail-grid">
                {numericDetailLabels.map(([key, label, unit]) => (
                  <label key={key} htmlFor={`recipe-${key}`}>
                    {label}{unit && <small>{unit}</small>}
                    <input
                      id={`recipe-${key}`}
                      type="number"
                      min="0"
                      step={key === 'servings' ? '1' : '0.1'}
                      value={recipeDetails[key]}
                      onChange={(event) => setRecipeDetails({ ...recipeDetails, [key]: event.target.value })}
                      disabled={busy}
                    />
                  </label>
                ))}
              </div>

              {/* PHẦN 3: CÁC BƯỚC THỰC HIỆN (METHOD / STEPS) */}
              <div className="recipe-subhead" style={{ marginTop: '20px' }}>
                <label>
                  <span>Các bước thực hiện (Method / Steps) <small>hướng dẫn từng bước cách làm</small></span>
                </label>
              </div>

              <div className="recipe-steps-list" role="group" aria-label="Các bước thực hiện">
                {stepRows.map((step, index) => (
                  <div key={index} className="recipe-step-item">
                    <span className="recipe-step-badge">Bước {index + 1}</span>
                    <textarea
                      rows={2}
                      className="recipe-step-textarea"
                      placeholder={`Mô tả chi tiết bước ${index + 1}...`}
                      value={step}
                      onChange={(e) => updateStepRow(index, e.target.value)}
                      disabled={busy}
                      aria-label={`Mô tả bước ${index + 1}`}
                    />
                    <button
                      type="button"
                      className="recipe-step-remove-btn"
                      title="Xóa bước này"
                      aria-label={`Xóa bước ${index + 1}`}
                      onClick={() => removeStepRow(index)}
                      disabled={busy}
                    >
                      <Trash2 size={15}/>
                    </button>
                  </div>
                ))}
              </div>

              <div className="recipe-row-actions">
                <button
                  type="button"
                  className="recipe-add-row-btn"
                  onClick={addStepRow}
                  disabled={busy}
                >
                  <Plus size={15}/> Thêm bước tiếp theo
                </button>
              </div>
            </>
          )}
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
        {error && <p className="create-blog-error" role="alert">{error} {error.includes('đăng nhập') && <Link to="/login">Sign in</Link>}</p>}
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
