import { Activity, Carrot, Image } from 'lucide-react';
import { useState } from 'react';
export default function CommunityComposer({ onPost, profile = {} }) {
  const [value, setValue] = useState('');
  const submit = (event) => { event.preventDefault(); if (!value.trim()) return; onPost?.(value.trim()); setValue(''); };
  return <form className="community-composer" onSubmit={submit}>
    <div className="community-composer-row">
      {profile.avatarUrl && <img src={profile.avatarUrl} alt=""/>}
      <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Share your veggie tip or video..." aria-label="Share an update"/>
    </div>
    <div className="community-composer-toolbar">
      <button type="button"><Image size={16}/>Photo</button>
      <button type="button"><Carrot size={16}/>Ingredients</button>
      <button type="button"><Activity size={16}/>Macros</button>
      <button type="submit" className="button button-small">Post</button>
    </div>
  </form>;
}
