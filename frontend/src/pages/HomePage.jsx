import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Header from '../components/Header'; import Hero from '../components/Hero'; import FeaturedPost from '../components/FeaturedPost'; import ContentCard from '../components/ContentCard'; import VideoSection from '../components/VideoSection'; import ChatbotWidget from '../components/chatbot/ChatbotWidget'; import Footer from '../components/Footer'; import EditorialGallery from '../components/EditorialGallery'; import { TopicAccordion, ReaderNotes } from '../components/EditorialExtras'; import AuthModal from '../components/AuthModal';
import { getBlogs, getTopics, getVideos, googleAuthUrl } from '../services/contentApi'; import { Play, X } from 'lucide-react';
import ImageWithFallback from '../components/ImageWithFallback';

export default function HomePage({ onAuthenticate }) {
  const navigate = useNavigate();
  const location = useLocation();
  const blogData = null; const videoData = null;
  const [video, setVideo] = useState(null); const [authMode, setAuthMode] = useState(location.state?.authRequired ? 'login' : null); const [remoteContent, setRemoteContent] = useState({ blogs: [], videos: [], featured: null, topics: [], loading: true, error: '' });
  useEffect(() => {
    if (blogData || videoData) return undefined;
    const controller = new AbortController();
    Promise.allSettled([getBlogs(controller.signal), getVideos(controller.signal), getTopics(controller.signal)]).then(([blogsResult, videosResult, topicsResult]) => {
      if (controller.signal.aborted) return;
      const blogs = blogsResult.status === 'fulfilled' ? blogsResult.value : [];
      const videos = videosResult.status === 'fulfilled' ? videosResult.value : [];
      const topics = topicsResult.status === 'fulfilled' ? topicsResult.value : [];
      const contentUnavailable = blogsResult.status === 'rejected' && videosResult.status === 'rejected';
      setRemoteContent({ blogs, videos, topics, featured: blogs[0] ?? videos[0] ?? null, loading: false, error: contentUnavailable ? 'Không thể tải dữ liệu mới. Vui lòng thử lại sau.' : '' });
    });
    return () => controller.abort();
  }, [blogData, videoData]);
  const blogItems = remoteContent.blogs; const videoItems = remoteContent.videos;
  const authenticate = (form, mode) => form ? onAuthenticate?.(form, mode) : setAuthMode(mode);
  const closeAuth = () => { setAuthMode(null); if (location.state?.authRequired && !localStorage.getItem('nutribot-auth-token')) navigate('/', { replace: true, state: null }); };
  return <><Header onAuth={setAuthMode}/><main className="site-main"><Hero/><FeaturedPost post={remoteContent.featured}/><section className="section latest" id="community"><div className="section-heading"><div><p>THE LATEST</p><h2>Fresh, useful ideas for the way you really eat.</h2></div><Link to="/blogs">View all</Link></div>{remoteContent.loading && <p className="content-status">Đang tải blog từ hệ thống...</p>}{remoteContent.error && <p className="content-status content-status--error">{remoteContent.error}</p>}{blogItems.length ? <div className="post-grid">{blogItems.map((post) => <ContentCard key={post.id} post={post} onPlay={setVideo}/>)}</div> : !remoteContent.loading && <div className="empty-results">Chưa có bài viết nào được xuất bản.</div>}</section><EditorialGallery posts={blogItems}/><TopicAccordion topics={remoteContent.topics}/><VideoSection videos={videoItems} onPlay={setVideo}/><ReaderNotes/></main><Footer onAuth={setAuthMode}/><ChatbotWidget/>{video && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Video preview"><div className="video-modal"><button className="modal-close" onClick={() => setVideo(null)} aria-label="Close video"><X/></button>{video.image ? <ImageWithFallback src={video.image} alt=""/> : <div className="video-modal-placeholder"/>}<div className="modal-play"><Play fill="currentColor"/></div><div><span className="content-type">VIDEO PREVIEW</span><h2>{video.title}</h2><p>{video.description || 'Preview ready for guests. Create a free account for saved playlists and personalized picks.'}</p></div></div></div>}{authMode && <AuthModal mode={authMode} onClose={closeAuth} onSubmit={authenticate} onAuthenticated={() => navigate(location.state?.returnTo || '/home', { replace: true })} onGoogle={() => window.location.assign(googleAuthUrl())}/>}</>;
}
