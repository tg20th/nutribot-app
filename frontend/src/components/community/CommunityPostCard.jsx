import { ChevronLeft, ChevronRight, Flame, MessageCircle, MoreHorizontal, Play, Sprout } from 'lucide-react';
import { useState } from 'react';
import ImageWithFallback from '../ImageWithFallback';
import PostDiscussionModal from '../content/PostDiscussionModal';
import VoteButton from '../content/VoteButton';
import FeedContentDetail from '../content/FeedContentDetail';

export default function CommunityPostCard({ post, interactionApi = {}, loadPost, fullPageDetail = false }) {
  const [slide, setSlide] = useState(0);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [focusComments, setFocusComments] = useState(false);
  const [voteRevision, setVoteRevision] = useState(0);
  const images = post.type === 'gallery' ? post.images : [post.image];
  const openPost = (focus = false) => { setFocusComments(focus); setCommentsOpen(true); };
  const closePost = () => { setCommentsOpen(false); setVoteRevision((value) => value + 1); };

  return <article className="community-post">
    <header className="community-post-header">
      <ImageWithFallback src={post.avatar} alt=""/>
      <div><b>{post.author}</b><small>{post.username} &middot; {post.createdAt}</small></div>
      <button className="community-icon-btn" aria-label="Post options"><MoreHorizontal size={18}/></button>
    </header>

    <button className="community-post-title" type="button" onClick={() => openPost()}><h3>{post.title}</h3></button>

    {(post.calories || post.protein || post.fiber) > 0 && <div className="community-post-badges">
      {post.calories > 0 && <span className="badge badge-cal"><Flame size={13}/>{post.calories} kcal</span>}
      {post.protein > 0 && <span className="badge badge-protein"><Sprout size={13}/>{post.protein}g Protein</span>}
      {post.fiber > 0 && <span className="badge">{post.fiber}g Fiber</span>}
    </div>}

    {images[0] && <button className="community-post-media" type="button" aria-label={`View ${post.title}`} onClick={() => openPost()}>
      <ImageWithFallback src={images[slide]} alt="" />
      {post.type === 'video' && <span className="play-overlay"><Play fill="currentColor" size={20}/></span>}
      {images.length > 1 && <>
        <span role="button" tabIndex="0" className="community-media-nav prev" aria-label="Previous image" onClick={(event) => { event.stopPropagation(); setSlide((slide - 1 + images.length) % images.length); }}><ChevronLeft size={18}/></span>
        <span role="button" tabIndex="0" className="community-media-nav next" aria-label="Next image" onClick={(event) => { event.stopPropagation(); setSlide((slide + 1) % images.length); }}><ChevronRight size={18}/></span>
        <div className="community-media-dots">{images.map((_, i) => <span key={i} className={i === slide ? 'is-active' : ''}/>)}</div>
      </>}
    </button>}

    {post.pantryItems && <div className="community-pantry">
      <p>Featured pantry items</p>
      <ul>{post.pantryItems.map((item) => <li key={item}>{item}</li>)}</ul>
    </div>}

    {post.description && <p className="community-post-desc">{post.description} <button type="button" className="community-read-more" onClick={() => openPost()}>View full post</button></p>}

    <div className="community-post-footer">
      <VoteButton key={voteRevision} contentId={post.id} compact loadVote={interactionApi.loadVote} submitVote={interactionApi.submitVote}/>
      <button type="button" aria-haspopup="dialog" aria-expanded={commentsOpen} onClick={() => openPost(true)}>
        <MessageCircle size={17}/> Comments</button>
    </div>

    {commentsOpen && (fullPageDetail
      ? <FeedContentDetail post={post} onClose={closePost} focusComments={focusComments} interactionApi={interactionApi} loadPost={loadPost}/>
      : <PostDiscussionModal post={post} onClose={closePost} focusComments={focusComments} interactionApi={interactionApi} loadPost={loadPost}/>)}
  </article>;
}
