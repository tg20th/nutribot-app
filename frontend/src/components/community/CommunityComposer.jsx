import { Activity, Carrot, Image } from 'lucide-react';
export default function CommunityComposer({ onOpen, profile = {} }) {
  return <div className="community-composer">
    <div className="community-composer-row">
      {profile.avatarUrl && <img src={profile.avatarUrl} alt=""/>}
      <button type="button" className="community-composer-prompt" onClick={onOpen} aria-haspopup="dialog">Share your veggie tip or video...</button>
    </div>
    <div className="community-composer-toolbar">
      <button type="button" onClick={onOpen}><Image size={16}/>Photo</button>
      <button type="button" onClick={onOpen}><Carrot size={16}/>Ingredients</button>
      <button type="button" onClick={onOpen}><Activity size={16}/>Macros</button>
      <button type="button" className="button button-small" onClick={onOpen}>Post</button>
    </div>
  </div>;
}
