import { Image, Video } from 'lucide-react';

export default function CommunityComposer({ onOpen, profile = {} }) {
  return <div className="community-composer">
    <div className="community-composer-row">
      {profile.avatarUrl && <img src={profile.avatarUrl} alt=""/>}
      <button type="button" className="community-composer-prompt" onClick={onOpen} aria-haspopup="dialog">What would you like to share with the community?</button>
    </div>
    <div className="community-composer-toolbar">
      <button type="button" onClick={onOpen}><Image size={16}/>Photo</button>
      <button type="button" onClick={onOpen}><Video size={16}/>Video</button>
      <button type="button" className="button button-small" onClick={onOpen}>Create post</button>
    </div>
  </div>;
}
