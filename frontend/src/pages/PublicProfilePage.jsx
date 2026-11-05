import { UtensilsCrossed } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import MemberPageLayout from '../layouts/MemberPageLayout';
import ImageWithFallback from '../components/ImageWithFallback';
import DishDetailModal from '../components/community/DishDetailModal';
import { ProfileHeader, ProfileTabs } from '../components/profile/ProfilePresentation';
import { getPublicProfile, getPublicProfileContent, getPublicProfileRecipes } from '../services/publicProfileApi';
import '../styles/public-profile.css';
import '../styles/public-profile-recipe-button.css';

const profileViewCache = new Map();

function Skeleton() {
  return <div className="public-profile-skeleton" aria-busy="true" role="status"><span/><span/><span/></div>;
}

export default function PublicProfilePage() {
  const { userId } = useParams();
  const location = useLocation();
  const cachedView = profileViewCache.get(String(userId));
  const [profile, setProfile] = useState(() => cachedView?.profile ?? null);
  const [posts, setPosts] = useState(() => cachedView?.posts ?? []);
  const [recipes, setRecipes] = useState(() => cachedView?.recipes ?? []);
  const [postsUnavailable, setPostsUnavailable] = useState(() => cachedView?.postsUnavailable ?? false);
  const [recipesUnavailable, setRecipesUnavailable] = useState(() => cachedView?.recipesUnavailable ?? false);
  const [tab, setTab] = useState(() => location.state?.profileTab || cachedView?.tab || 'posts');
  const [state, setState] = useState(() => cachedView ? 'ready' : 'loading');
  const [selectedRecipe, setSelectedRecipe] = useState(null);

  useEffect(() => {
    if (cachedView) return undefined;
    const controller = new AbortController();
    setState('loading');
    Promise.allSettled([
      getPublicProfile(userId, controller.signal),
      getPublicProfileContent(userId, { signal: controller.signal }),
      getPublicProfileRecipes(userId, { signal: controller.signal })
    ]).then(([profileResult, contentResult, recipeResult]) => {
      if (controller.signal.aborted) return;

      if (profileResult.status === 'rejected') {
        setState(profileResult.reason?.status === 404 ? 'not-found' : 'error');
        return;
      }

      const nextProfile = profileResult.value;
      const content = contentResult.status === 'fulfilled' ? contentResult.value : null;
      const recipeData = recipeResult.status === 'fulfilled' ? recipeResult.value : null;
      setProfile(nextProfile);
      setPosts(content?.posts ?? []);
      setPostsUnavailable(contentResult.status === 'rejected');
      setRecipes(recipeData?.recipes ?? []);
      setRecipesUnavailable(recipeResult.status === 'rejected' || Boolean(recipeData?.unavailable));
      setState('ready');
    });
    return () => controller.abort();
  }, [cachedView, userId]);

  useEffect(() => {
    if (!profile || state !== 'ready') return undefined;
    profileViewCache.set(String(userId), { profile, posts, recipes, postsUnavailable, recipesUnavailable, tab, scrollY: window.scrollY });
    return () => {
      profileViewCache.set(String(userId), { profile, posts, recipes, postsUnavailable, recipesUnavailable, tab, scrollY: window.scrollY });
    };
  }, [profile, posts, recipes, postsUnavailable, recipesUnavailable, state, tab, userId]);

  useEffect(() => {
    if (state !== 'ready') return undefined;
    const scrollY = location.state?.profileScrollY ?? cachedView?.scrollY;
    if (scrollY == null) return undefined;
    const frame = window.requestAnimationFrame(() => window.scrollTo({ top: scrollY, left: 0, behavior: 'auto' }));
    return () => window.cancelAnimationFrame(frame);
  }, [cachedView?.scrollY, location.state?.profileScrollY, state]);

  const stats = useMemo(() => profile?.stats ?? {}, [profile]);
  const profileReturnTo = `${location.pathname}${location.search}${location.hash}`;
  if (state === 'loading') return <MemberPageLayout activePath="/home"><main className="public-profile-page"><Skeleton/></main></MemberPageLayout>;
  if (state !== 'ready') return <MemberPageLayout activePath="/home"><main className="public-profile-page public-profile-state"><h1>{state === 'not-found' ? 'Profile not found' : 'Public profile unavailable'}</h1><p>{state === 'not-found' ? 'This profile is no longer public or does not exist.' : 'The public profile service is not available yet. Please try again later.'}</p><Link to="/home">Back to community</Link></main></MemberPageLayout>;

  return <MemberPageLayout activePath="/home"><main className="public-profile-page">
    <ProfileHeader profile={profile} stats={stats}/>
    <ProfileTabs tab={tab} onChange={setTab}/>
    {tab === 'posts' && <>{postsUnavailable && <p className="public-profile-empty">Public posts are not available yet.</p>}<div className="public-profile-grid">{posts.map((post) => <Link key={`${post.type}-${post.id}`} to={`/community/posts/${post.id}`} state={{ returnTo: profileReturnTo, returnState: { profileTab: tab, profileScrollY: window.scrollY } }} className="public-profile-grid-item">{post.image ? <ImageWithFallback src={post.image} alt={post.title || 'Post'} loading="lazy"/> : <span>{post.title || post.caption || 'Shared post'}</span>}{post.images?.length > 1 && <small aria-label="Gallery">{post.images.length}</small>}</Link>)}</div>{!posts.length && !postsUnavailable && <p className="public-profile-empty">No public posts yet.</p>}</>}
    {tab === 'recipes' && <div className="public-profile-recipes">{recipes.map((recipe) => <button type="button" key={recipe.dishId ?? recipe.id} onClick={() => setSelectedRecipe(recipe)} className="public-profile-recipe">{(recipe.imageUrl || recipe.image) ? <ImageWithFallback src={recipe.imageUrl || recipe.image} alt={recipe.name || recipe.title || ''} loading="lazy"/> : <span className="public-profile-recipe-fallback"><UtensilsCrossed size={20}/></span>}<div><h2>{recipe.name || recipe.title}</h2>{recipe.description && <p>{recipe.description}</p>}<small>{recipe.preparationTime || recipe.prepTime || ''}{recipe.servings ? ` · Serves ${recipe.servings}` : ''}</small></div></button>)}{!recipes.length && <p className="public-profile-empty">{recipesUnavailable ? 'Public recipes are not available yet.' : 'No approved public recipes yet.'}</p>}</div>}
  </main>{selectedRecipe && <DishDetailModal meal={selectedRecipe} onClose={() => setSelectedRecipe(null)}/>}</MemberPageLayout>;
}
