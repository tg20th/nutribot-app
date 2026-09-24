import { useEffect, useMemo, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowUpRight, Play, Sparkles } from 'lucide-react';
import CommunityTopBar from '../components/community/CommunityTopBar';
import CommunitySideNav from '../components/community/CommunitySideNav';
import CommunityComposer from '../components/community/CommunityComposer';
import CommunityFilters from '../components/community/CommunityFilters';
import CommunityPostCard from '../components/community/CommunityPostCard';
import CommunityRightRail from '../components/community/CommunityRightRail';
import Chatbot from '../components/Chatbot';
import { createPost, getCommunityFilters, getPosts } from '../services/communityApi';
import { getMyProfile } from '../services/profileApi';
import colorfulPlate from '../assets/colorful-plate.jpg';
import heroBowl from '../assets/hero-bowl.jpg';

gsap.registerPlugin(ScrollTrigger);

const fallbackDiscoverPosts = [
  {
    id: 'featured-reset',
    title: 'Make dinner feel like a reset.',
    description: "Chef Julien's crisp tofu, in under 20 minutes.",
    image: colorfulPlate
  },
  {
    id: 'featured-color',
    title: 'A bowl with every color.',
    description: 'A bright mix of vegetables for an uncomplicated meal.',
    image: heroBowl
  }
];

export default function CommunityFeedPage() {
  const page = useRef(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [posts, setPosts] = useState([]); const [profile, setProfile] = useState({}); const [filters, setFilters] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    Promise.allSettled([getPosts(controller.signal), getMyProfile(controller.signal), getCommunityFilters(controller.signal)]).then(([postsResult, profileResult, filtersResult]) => {
      if (controller.signal.aborted) return;
      if (postsResult.status === 'fulfilled') setPosts(postsResult.value);
      else setError('Unable to load the community feed.');
      if (profileResult.status === 'fulfilled') setProfile(profileResult.value);
      if (filtersResult.status === 'fulfilled') setFilters(filtersResult.value);
      setLoading(false);
    });
    return () => controller.abort();
  }, []);

  const visible = useMemo(() => posts.filter((post) => {
    const matchesFilter = filter === 'All' || post.title.toLowerCase().includes(filter.replace('#', '').toLowerCase());
    const matchesQuery = `${post.title} ${post.author} ${post.description ?? ''}`.toLowerCase().includes(query.toLowerCase());
    return matchesFilter && matchesQuery;
  }), [posts, filter, query]);
  const discoverPosts = fallbackDiscoverPosts.map((fallback, index) => posts[index]?.image ? posts[index] : fallback);

  const addPost = async (text) => { try { const post = await createPost({ title: text }); setPosts((items) => [post, ...items]); } catch { setError('Unable to publish your post.'); } };

  useGSAP(() => {
    gsap.from('.feed-intro > *', { y: 28, opacity: 0, duration: .85, stagger: .11, ease: 'power3.out' });
    gsap.utils.toArray('.community-post').forEach((card) => {
      gsap.fromTo(card, { scale: .94, opacity: .25 }, { scale: 1, opacity: 1, ease: 'none', scrollTrigger: { trigger: card, start: 'top 92%', end: 'top 43%', scrub: .45 } });
    });
    gsap.utils.toArray('.community-post-media img').forEach((image) => {
      gsap.fromTo(image, { scale: .88 }, { scale: 1.05, ease: 'none', scrollTrigger: { trigger: image, start: 'top bottom', end: 'bottom top', scrub: .8 } });
    });
  }, { scope: page });

  return <div className="community-page" ref={page}>
    <CommunityTopBar query={query} onQueryChange={setQuery}/>
    <div className="community-shell">
      <CommunitySideNav/>
      <span className="community-sidenav-spacer" aria-hidden="true"/>
      <div className="community-layout">
        <main className="community-feed">
          <section className="feed-intro" aria-labelledby="feed-title">
            <div className="feed-intro-copy"><p>YOUR DAILY TABLE</p><h1 id="feed-title">Good food, <span className="feed-inline-image"/> shared well.</h1><span>Recipes, practical videos, and small ideas worth bringing to your next meal.</span></div>
            <div className="feed-intro-actions"><button type="button" onClick={() => document.querySelector('.community-composer input')?.focus()}>Share a bite <ArrowUpRight size={17}/></button><a href="#discover">Explore picks <Sparkles size={16}/></a></div>
          </section>
          <section className="feed-discover" id="discover" aria-label="Featured food stories">
            <article className="discover-feature group"><img src={discoverPosts[0].image} alt={discoverPosts[0].title}/><div><span><Play size={13} fill="currentColor"/> Watch now</span><h2>Make dinner feel like a reset.</h2><p>{discoverPosts[0].description}</p></div></article>
            <article className="discover-note"><span>Today&apos;s mood</span><b>Bright,<br/>fresh,<br/>uncomplicated.</b><small>Curated for your table</small></article>
            <article className="discover-feature discover-feature--small group"><img src={discoverPosts[1].image} alt={discoverPosts[1].title}/><div><span>READ &amp; SAVE</span><h2>{discoverPosts[1].title}</h2></div></article>
          </section>
          <div className="feed-stream-heading"><div><span>The community stream</span><h2>What&apos;s nourishing people now</h2></div><p>Stories and videos, all in one thoughtful place.</p></div>
          <CommunityComposer onPost={addPost} profile={profile}/>
          <CommunityFilters filters={filters} active={filter} onChange={setFilter}/>
          {loading ? <p className="content-status">Loading community posts...</p> : error ? <p className="content-status content-status--error">{error}</p> : visible.length ? visible.map((post) => <CommunityPostCard key={post.id} post={post} profile={profile}/>) : <div className="empty-results">No posts match that filter yet.</div>}
        </main>
        <CommunityRightRail/>
      </div>
    </div>
    <Chatbot/>
  </div>;
}
