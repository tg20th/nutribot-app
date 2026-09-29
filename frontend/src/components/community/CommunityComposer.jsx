import { ImagePlus, ListChecks, Video } from 'lucide-react';
export default function CommunityComposer({ onOpen, profile = {} }) {
  return <div className="community-composer">
    <div className="community-composer-row">
      {profile.avatarUrl && <img src={profile.avatarUrl} alt=""/>}
      <button type="button" className="community-composer-prompt" onClick={() => onOpen('blog')} aria-haspopup="dialog">Chia sẻ công thức hoặc video của bạn...</button>
    </div>
    <div className="community-composer-toolbar">
      <button type="button" onClick={() => onOpen('blog')}><ImagePlus size={16}/>Ảnh & bài viết</button>
      <button type="button" onClick={() => onOpen('video')}><Video size={16}/>Video MP4</button>
      <span className="community-composer-note"><ListChecks size={15}/>Nhập thông tin công thức trong bài đăng</span>
      <button type="button" className="button button-small" onClick={() => onOpen('blog')}>Tạo bài đăng</button>
    </div>
  </div>;
}
