import { Bookmark, FileText, Heart, ImageOff, MessageCircle, Play } from 'lucide-react';
import { useState } from 'react';

export default function ContentCard({ post, onPlay }) {
  const [liked, setLiked] = useState(false); const [saved, setSaved] = useState(false);
  const isVideo = post.type.toLowerCase() === 'video';
  return <article className={`content-card ${post.image ? '' : 'content-card--text'}`}><button className="card-image" onClick={() => isVideo && onPlay(post)} aria-label={`Open ${post.title}`}>{post.image ? <img src={post.image} alt=""/> : <span className="no-media"><FileText size={30}/><span>NutriBot Journal</span><ImageOff size={16}/></span>}{isVideo && <span className="play-overlay"><Play fill="currentColor" size={20}/></span>}</button><div className="card-body"><span className="content-type">{post.type}</span><h3>{post.title}</h3><div className="author">{post.avatar ? <img src={post.avatar} alt=""/> : <span className="avatar-fallback">{post.author?.slice(0, 1)}</span>}<span><b>{post.author}</b><small>{[post.username, post.createdAt].filter(Boolean).join(' · ')}</small></span></div><p>{post.description}</p><div className="card-footer"><button onClick={() => setLiked(!liked)} className={liked ? 'is-active' : ''}><Heart size={17} fill={liked ? 'currentColor' : 'none'}/>{post.likes}</button><span><MessageCircle size={17}/>{post.comments}</span><button onClick={() => setSaved(!saved)} className={saved ? 'is-active save' : 'save'} aria-label="Save post"><Bookmark size={17} fill={saved ? 'currentColor' : 'none'}/></button></div></div></article>;
}
