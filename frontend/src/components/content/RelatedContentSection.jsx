import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, BookOpen, ImageOff, PlayCircle } from 'lucide-react';
import { blogHref } from '../../services/publicBlogApi';
import { getResolvedRelatedContent } from '../../services/relatedContentApi';
import '../../styles/related-content.css';

const excerptOf = (item) => String(item.description ?? item.caption ?? item.body ?? item.cleanBody ?? '')
  .replace(/<[^>]*>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, 130);

const isVideo = (item) => String(item.contentType ?? item.type).toUpperCase() === 'VIDEO' || item.type === 'video';

function contentHref(item) {
  return isVideo(item) ? `/community/posts/${item.contentId ?? item.id}` : blogHref(item);
}

function RelatedCard({ item }) {
  const video = isVideo(item);
  const image = item.thumbnailUrl ?? item.image;
  const excerpt = excerptOf(item);
  return <Link className="related-content-card" to={contentHref(item)} aria-label={`Open ${item.title}`}>
    <div className="related-content-media">
      {image ? <img src={image} alt=""/> : <span aria-hidden="true"><ImageOff size={20}/></span>}
      <span className="related-content-kind">{video ? <><PlayCircle size={13}/> Video</> : <><BookOpen size={13}/> Article</>}</span>
    </div>
    <div className="related-content-copy">
      <h3>{item.title}</h3>
      {excerpt && <p>{excerpt}{excerpt.length === 130 ? '…' : ''}</p>}
      <span>{item.authorName ?? item.author ?? 'NutriBot community'} <ArrowUpRight size={15}/></span>
    </div>
  </Link>;
}

export default function RelatedContentSection({ contentId, contentType, loadRelated = getResolvedRelatedContent }) {
  const [state, setState] = useState({ status: 'loading', items: [] });

  useEffect(() => {
    if (contentId == null) return undefined;
    const controller = new AbortController();
    setState({ status: 'loading', items: [] });
    loadRelated(contentId, contentType, controller.signal)
      .then((items) => { if (!controller.signal.aborted) setState({ status: 'ready', items }); })
      .catch(() => { if (!controller.signal.aborted) setState({ status: 'error', items: [] }); });
    return () => controller.abort();
  }, [contentId, contentType, loadRelated]);

  return <section className="related-content" aria-labelledby="related-content-title">
    <header className="related-content-header">
      <span>KEEP EXPLORING</span>
      <h2 id="related-content-title">More to nourish your curiosity.</h2>
    </header>

    {state.status === 'loading' && <div className="related-content-grid" aria-label="Loading related content">
      {[0, 1, 2].map((item) => <div className="related-content-skeleton" key={item}/>) }
    </div>}

    {state.status === 'ready' && state.items.length > 0 && <div className="related-content-grid">
      {state.items.map((item) => <RelatedCard key={`${item.contentType}:${item.contentId ?? item.id}`} item={item}/>) }
    </div>}

    {state.status === 'ready' && state.items.length === 0 && <p className="related-content-message">There is nothing else to recommend just yet. Explore more stories as our library grows.</p>}
    {state.status === 'error' && <p className="related-content-message">Related stories are unavailable right now. Please check back soon.</p>}
  </section>;
}
