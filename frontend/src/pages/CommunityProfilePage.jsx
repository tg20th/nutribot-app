import { Bookmark, CalendarDays, Edit3, MapPin, Settings } from 'lucide-react';
import { useEffect, useState } from 'react';
import CommunityTopBar from '../components/community/CommunityTopBar';
import CommunitySideNav from '../components/community/CommunitySideNav';
import ChatbotWidget from '../components/chatbot/ChatbotWidget';
import { getPosts } from '../services/communityApi';
import { getMyProfile } from '../services/profileApi';

export default function CommunityProfilePage() {
  const [communityUser, setCommunityUser] = useState({}); const [communityPosts, setCommunityPosts] = useState([]); const [error, setError] = useState('');
  useEffect(() => { const controller = new AbortController(); Promise.all([getMyProfile(controller.signal), getPosts(controller.signal)]).then(([profile, posts]) => { setCommunityUser(profile); setCommunityPosts(posts); }).catch(() => setError('Unable to load profile.')); return () => controller.abort(); }, []);
  if (error) return <main className="detail-not-found"><h1>{error}</h1></main>;
  return <div className="community-page profile-page">
    <CommunityTopBar query="" onQueryChange={() => {}}/>
    <div className="community-shell">
      <CommunitySideNav/>
      <span className="community-sidenav-spacer" aria-hidden="true"/>
      <main className="community-profile-main">
        <section className="profile-hero">
          <div className="profile-cover"/>
          <div className="profile-identity">
            {communityUser.avatarUrl && <img src={communityUser.avatarUrl} alt={communityUser.fullName}/>} 
            <div>
              <p>Plant-forward home cook</p>
              <h1>{communityUser.fullName ?? communityUser.name}</h1>
              <span>{communityUser.username} <i/> <MapPin size={13}/> Ho Chi Minh City</span>
            </div>
            <div className="profile-actions"><button type="button"><Edit3 size={15}/> Edit profile</button><button type="button" aria-label="Profile settings"><Settings size={17}/></button></div>
          </div>
          <p className="profile-bio">Cooking bright, seasonal meals and collecting recipes that make a nourishing routine feel effortless.</p>
          <div className="profile-stats"><div><b>{communityUser.followers ?? 0}</b><span>Followers</span></div><div><b>{communityUser.following ?? 0}</b><span>Following</span></div><div><b>{communityUser.streakDays ?? 0}</b><span>Day streak</span></div></div>
        </section>

        <section className="profile-summary">
          <div><CalendarDays size={18}/><span>This week</span><b>{(communityUser.targetCalories ?? 0).toLocaleString()} kcal/day</b><small>{communityUser.targetProtein ?? 0}g protein target</small></div>
          <div><Bookmark size={18}/><span>Saved for later</span><b>24 recipes</b><small>Ready for your next plan</small></div>
        </section>

        <section className="profile-posts">
          <div className="profile-section-head"><div><span>From your kitchen</span><h2>Recent saves &amp; ideas</h2></div><button type="button">View all</button></div>
          <div className="profile-post-grid">
            {communityPosts.map((post) => <article key={post.id}>
              <img src={post.image || post.images?.[0]} alt=""/>
              <div><span>{post.type}</span><b>{post.title}</b><small>{post.calories} kcal <i/> {post.protein}g protein</small></div>
            </article>)}
          </div>
        </section>
      </main>
    </div>
    <ChatbotWidget/>
  </div>;
}
