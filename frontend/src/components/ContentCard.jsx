import { Bookmark, FileText, Heart, ImageOff, MessageCircle, Play } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { blogHref } from '../services/publicBlogApi';
import ImageWithFallback from './ImageWithFallback';

export default function ContentCard({ post, onPlay }) {
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const isVideo = post.type.toLowerCase() === 'video';
  const media = <>{post.image ? <ImageWithFallback src={post.image} alt=""/> : <span className="no-media"><FileText size={30}/><span>NutriBot Journal</span><ImageOff size={16}/></span>}{isVideo && <span className="play-overlay"><Play fill="currentColor" size={20}/></span>}</>;

  return <article className={`content-card ${post.image ? '' : 'content-card--text'}`}>
    {isVideo
      ? <button className="card-image" type="button" onClick={() => onPlay(post)} aria-label={`Open ${post.title}`}>{media}</button>
      : <Link className="card-image" to={blogHref(post)} aria-label={`Read ${post.title}`}>{media}</Link>}
    <div className="card-body">
      <span className="content-type">{post.type}</span>
      <h3>{isVideo ? post.title : <Link to={blogHref(post)}>{post.title}</Link>}</h3>
      <div className="author">{post.avatar ? <ImageWithFallback src={post.avatar} alt=""/> : <span className="avatar-fallback">{post.author?.slice(0, 1)}</span>}<span><b>{post.author}</b><small>{[post.username, post.createdAt].filter(Boolean).join(' · ')}</small></span></div>
      <p>{post.description}</p>
      <div className="card-footer"><button type="button" onClick={() => setLiked(!liked)} className={liked ? 'is-active' : ''}><Heart size={17} fill={liked ? 'currentColor' : 'none'}/>{post.likes}</button><span><MessageCircle size={17}/>{post.comments}</span><button type="button" onClick={() => setSaved(!saved)} className={saved ? 'is-active save' : 'save'} aria-label="Save post"><Bookmark size={17} fill={saved ? 'currentColor' : 'none'}/></button></div>
    </div>
  </article>;
}
