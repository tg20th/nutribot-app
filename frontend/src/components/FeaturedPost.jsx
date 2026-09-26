import { ArrowRight, Clock3, Heart, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { blogHref } from '../services/publicBlogApi';

export default function FeaturedPost({ post }) {
  if (!post?.id) return null;
  const isBlog = post.type.toLowerCase() !== 'video';
  return <section className="section featured" id="recipes">
    <div className="section-heading"><p>FEATURED FROM THE COMMUNITY</p><Link to="/blogs">View all <ArrowRight size={17}/></Link></div>
    <article className="featured-story">
      <div className="featured-image">{post.image && <img src={post.image} alt=""/>}</div>
      <div className="featured-copy"><span className="content-type">{post.type}</span><div className="author">{post.avatar && <img src={post.avatar} alt=""/>}<span><b>{post.author}</b><small>{post.username}, {post.createdAt}</small></span></div><h2>{post.title}</h2><p>{post.description}</p><div className="tags">{(post.tags ?? []).map((tag) => <span key={tag}>{tag}</span>)}</div><div className="feature-meta"><span><Heart size={17}/> {post.likes}</span><span><MessageCircle size={17}/> {post.comments}</span><span><Clock3 size={17}/> {post.duration}</span></div>{isBlog && <Link className="text-link" to={blogHref(post)}>Read more <ArrowRight size={17}/></Link>}</div>
    </article>
  </section>;
}
