import { ChevronLeft, ChevronRight, MessageCircle, MoreHorizontal, Play } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ImageWithFallback from '../ImageWithFallback';
import PostDiscussionModal from '../content/PostDiscussionModal';
import VoteButton from '../content/VoteButton';
import FeedContentDetail from '../content/FeedContentDetail';
import { formatPostDate, extractStoryText } from '../../utils/content';
import { getContentCommentCount } from '../../services/contentInteractionApi';

const firstPresent = (...values) => values.find((value) => value != null && value !== '');

export default function CommunityPostCard({ post: sourcePost, interactionApi = {}, loadPost, fullPageDetail = false, routeDetail = false }) {
  const navigate = useNavigate();
  const post = { ...sourcePost, createdAt: formatPostDate(sourcePost.createdAt) };
  const [slide, setSlide] = useState(0);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [focusComments, setFocusComments] = useState(false);
  const [focusCaption, setFocusCaption] = useState(false);
  const [voteRevision, setVoteRevision] = useState(0);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [commentCount, setCommentCount] = useState(post.comments);
  const images = post.type === 'gallery' ? post.images : [post.image];
  const rawCaption = firstPresent(post.caption, post.story, post.description, post.summary, typeof post.content === 'string' ? post.content : null, post.cleanBody);
  const caption = String(extractStoryText(rawCaption) ?? '').trim();
  const captionPreviewLength = 280;
  const captionIsLong = caption.length > captionPreviewLength;
  useEffect(() => {
    setCommentCount(post.comments);
    if (post.id == null || Number.isFinite(post.comments)) return undefined;
    const controller = new AbortController();
    getContentCommentCount(post.id, controller.signal)
      .then((count) => { if (!controller.signal.aborted) setCommentCount(count); })
      .catch(() => { if (!controller.signal.aborted) setCommentCount(0); });
    return () => controller.abort();
  }, [post.id, post.comments]);
  const visibleCaption = captionExpanded || !captionIsLong ? caption : `${caption.slice(0, captionPreviewLength).trimEnd()}…`;
  const openPost = useCallback((focus = 'top') => {
    if (routeDetail && post.id != null) {
      navigate(`/community/posts/${post.id}`, { state: { returnTo: '/home' } });
      return;
    }
    setFocusComments(focus === 'comments'); setFocusCaption(focus === 'caption'); setCommentsOpen(true);
  }, [navigate, post.id, routeDetail]);
  const closePost = useCallback(() => { setCommentsOpen(false); setFocusComments(false); setFocusCaption(false); setVoteRevision((value) => value + 1); }, []);
  const openFromCard = (event) => {
    if (event.target.closest('button, a, input, textarea, select')) return;
    openPost();
  };

  return <article className="community-post community-post--social" onClick={openFromCard}>
    <header className="community-post-header">
      {post.avatar ? (
        <ImageWithFallback src={post.avatar} alt={post.author || 'Author avatar'} />
      ) : (
        <span className="avatar-fallback" aria-hidden="true">
          {(post.author || 'N').charAt(0).toUpperCase()}
        </span>
      )}
      <div><b>{post.author}</b><small>{[post.username, post.createdAt].filter(Boolean).join(' · ')}</small></div>
      <button className="community-icon-btn" aria-label="Post options" onClick={(event) => event.stopPropagation()}><MoreHorizontal size={18}/></button>
    </header>

    {post.title && <button className="community-post-title" type="button" onClick={(event) => { event.stopPropagation(); openPost(); }}><h3>{post.title}</h3></button>}

    {caption && <div className="community-post-caption"><p className={!captionExpanded && captionIsLong ? 'is-collapsed' : ''}>{captionExpanded ? caption : visibleCaption}</p>{captionIsLong && !captionExpanded && <button type="button" onClick={(event) => { event.stopPropagation(); openPost('caption'); }}>See more</button>}</div>}

    {images[0] && <div className="community-post-media" role="button" tabIndex="0" aria-label={`Open ${post.title || 'post'}`} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openPost(); } }}>
      <ImageWithFallback src={images[slide]} alt="" />
      {post.type === 'video' && <span className="play-overlay"><Play fill="currentColor" size={20}/></span>}
      {images.length > 1 && <>
        <span role="button" tabIndex="0" className="community-media-nav prev" aria-label="Previous image" onClick={(event) => { event.stopPropagation(); setSlide((slide - 1 + images.length) % images.length); }}><ChevronLeft size={18}/></span>
        <span role="button" tabIndex="0" className="community-media-nav next" aria-label="Next image" onClick={(event) => { event.stopPropagation(); setSlide((slide + 1) % images.length); }}><ChevronRight size={18}/></span>
        <div className="community-media-dots">{images.map((_, i) => <span key={i} className={i === slide ? 'is-active' : ''}/>)}</div>
      </>}
    </div>}

    <div className="community-post-footer" onClick={(event) => event.stopPropagation()}>
      <VoteButton key={voteRevision} contentId={post.id} compact loadVote={interactionApi.loadVote} submitVote={interactionApi.submitVote}/>
      <button type="button" aria-label="Comments" aria-haspopup="dialog" aria-expanded={commentsOpen} onClick={() => openPost('comments')}>
        <MessageCircle size={18}/><small aria-hidden="true">{commentCount ?? 0}</small></button>
    </div>

    {commentsOpen && (fullPageDetail
      ? <FeedContentDetail post={post} onClose={closePost} focusComments={focusComments} focusCaption={focusCaption} interactionApi={interactionApi} loadPost={loadPost}/>
      : <PostDiscussionModal post={post} onClose={closePost} focusComments={focusComments} interactionApi={interactionApi} loadPost={loadPost}/>)}
  </article>;
}
