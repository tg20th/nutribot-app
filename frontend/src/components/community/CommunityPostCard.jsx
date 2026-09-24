import { Bookmark, ChevronLeft, ChevronRight, Flame, Heart, MessageCircle, MoreHorizontal, Play, Send, Sprout } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPostComment, removeVote, votePost } from '../../services/communityApi';

export default function CommunityPostCard({ post, profile = {} }) {
  const navigate = useNavigate();
  const [liked, setLiked] = useState(post.userVoted);
  const [saved, setSaved] = useState(false);
  const [slide, setSlide] = useState(0);
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState(post.commentList ?? []);
  const images = post.type === 'gallery' ? post.images : [post.image];

  const addComment = (event) => {
    event.preventDefault();
    if (!comment.trim()) return;
    createPostComment(post.id, { content: comment.trim() }).then((created) => { setComments([...comments, created]); setComment(''); });
  };

  return <article className="community-post">
    <header className="community-post-header">
      <img src={post.avatar} alt=""/>
      <div><b>{post.author}</b><small>{post.username} &middot; {post.createdAt}</small></div>
      <button className="community-icon-btn" aria-label="Post options"><MoreHorizontal size={18}/></button>
    </header>

    <button className="community-post-title" type="button" onClick={() => navigate(`/community/posts/${post.id}`)}><h3>{post.title}</h3></button>

    {(post.calories || post.protein || post.fiber) > 0 && <div className="community-post-badges">
      {post.calories > 0 && <span className="badge badge-cal"><Flame size={13}/>{post.calories} kcal</span>}
      {post.protein > 0 && <span className="badge badge-protein"><Sprout size={13}/>{post.protein}g Protein</span>}
      {post.fiber > 0 && <span className="badge">{post.fiber}g Fiber</span>}
    </div>}

    {images[0] && <button className="community-post-media" type="button" aria-label={`View ${post.title}`} onClick={() => navigate(`/community/posts/${post.id}`)}>
      <img src={images[slide]} alt=""/>
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

    {post.description && <p className="community-post-desc">{post.description} <button type="button" className="community-read-more" onClick={() => navigate(`/community/posts/${post.id}`)}>View full details</button></p>}

    <div className="community-post-footer">
      <button onClick={() => { (liked ? removeVote : votePost)(post.id).then(() => setLiked(!liked)); }} className={liked ? 'is-active' : ''}><Heart size={17} fill={liked ? 'currentColor' : 'none'}/>{post.likes}</button>
      <span><MessageCircle size={17}/>{comments.length || post.comments}</span>
      <span className="community-shares">{post.shares} shares</span>
      <button onClick={() => setSaved(!saved)} className={saved ? 'is-active save' : 'save'} aria-label="Save post"><Bookmark size={17} fill={saved ? 'currentColor' : 'none'}/></button>
    </div>

    {comments.length > 0 && <div className="community-comments">
      {comments.map((c) => <div className="community-comment" key={c.id}>
        <img src={c.avatar} alt=""/>
        <div><b>{c.author}</b> <span>{c.text}</span><small>{c.time} &middot; {c.likes} likes &middot; Reply</small></div>
      </div>)}
    </div>}

    <form className="community-comment-form" onSubmit={addComment}>
      {profile.avatarUrl && <img src={profile.avatarUrl} alt=""/>}
      <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a comment for this food match..." aria-label="Add a comment"/>
      <button type="submit" aria-label="Send comment"><Send size={15}/></button>
    </form>
  </article>;
}
