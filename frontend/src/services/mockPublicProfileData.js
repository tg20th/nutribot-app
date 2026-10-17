import heroBowl from '../assets/hero-bowl.jpg';
import freshProduce from '../assets/fresh-produce.jpg';
import colorfulPlate from '../assets/colorful-plate.jpg';
import communityMember from '../assets/community-member.jpg';

const delay = (value, signal, ms = 420) => new Promise((resolve, reject) => {
  const timer = window.setTimeout(() => resolve(structuredClone(value)), ms);
  const abort = () => { window.clearTimeout(timer); reject(Object.assign(new Error('Request aborted'), { name: 'AbortError' })); };
  if (signal?.aborted) return abort();
  signal?.addEventListener('abort', abort, { once: true });
});

const users = [
  { userId: 'mock-user-lan', displayName: 'Tuyết Lan', username: 'tuyetlan', avatarUrl: communityMember, bio: 'Small, bright meals for busy days. Plant-forward, practical, and always worth sharing.', joinedAt: '2024-04-18T00:00:00Z', stats: { posts: 12, approvedRecipeContributions: 4, totalLikes: 286 } },
  { userId: 'mock-user-minh', displayName: 'Minh Anh', username: 'minhanh', avatarUrl: colorfulPlate, bio: 'Collecting gentle recipes and turning weeknight leftovers into something new.', joinedAt: '2024-09-02T00:00:00Z', stats: { posts: 8, approvedRecipeContributions: 2, totalLikes: 174 } },
  { userId: 'mock-user-bao', displayName: 'Bảo Trâm', username: 'baotram', avatarUrl: freshProduce, bio: 'Seasonal cooking, simple prep, and a little more colour on every plate.', joinedAt: '2025-01-11T00:00:00Z', stats: { posts: 5, approvedRecipeContributions: 1, totalLikes: 93 } }
];

const post = (id, userId, title, caption, image, createdAt, likes, comments) => ({
  id, contentId: id, contentType: 'BLOG', type: 'blog', authorId: userId, author: users.find((user) => user.userId === userId)?.displayName, username: users.find((user) => user.userId === userId)?.username, avatar: users.find((user) => user.userId === userId)?.avatarUrl, title, caption, description: caption, image, images: [], createdAt, likes, comments, body: caption, cleanBody: caption, pantryItems: [], steps: []
});

const recipes = [
  { dishId: 'mock-dish-green-bowl', name: 'Green crunch bowl', description: 'A bright, balanced bowl with herbs, greens, and toasted seeds.', imageUrl: freshProduce, calories: 420, proteinG: 18, carbsG: 48, healthyFatsG: 16, servings: 2, prepTimeMinutes: 15, cookTimeMinutes: 10, ingredients: [{ quantity: '2', unit: 'cups', name: 'mixed greens' }, { quantity: '1', unit: 'cup', name: 'brown rice' }, { quantity: '1', unit: 'tbsp', name: 'pumpkin seeds' }], steps: [{ description: 'Warm the rice and prepare the greens.' }, { description: 'Layer everything in a bowl and finish with seeds.' }] },
  { dishId: 'mock-dish-tofu-toast', name: 'Silky tofu toast', description: 'Creamy tofu, lemon, and herbs on crisp wholegrain toast.', imageUrl: heroBowl, calories: 365, proteinG: 19, carbsG: 42, healthyFatsG: 12, servings: 2, prepTimeMinutes: 10, cookTimeMinutes: 8, ingredients: [{ quantity: '200', unit: 'g', name: 'silken tofu' }, { quantity: '4', unit: 'slices', name: 'wholegrain bread' }, { quantity: '1', unit: 'tsp', name: 'lemon zest' }], steps: [{ description: 'Blend tofu with lemon and herbs until smooth.' }, { description: 'Toast the bread and spread generously.' }] },
  { dishId: 'mock-dish-oat-pot', name: 'Cinnamon oat pot', description: 'An easy make-ahead breakfast with banana and toasted oats.', imageUrl: colorfulPlate, calories: 310, proteinG: 11, carbsG: 52, healthyFatsG: 8, servings: 1, prepTimeMinutes: 5, cookTimeMinutes: 5, ingredients: [{ quantity: '½', unit: 'cup', name: 'rolled oats' }, { quantity: '1', unit: 'piece', name: 'banana' }, { quantity: '½', unit: 'tsp', name: 'cinnamon' }], steps: [{ description: 'Combine oats, banana, cinnamon, and milk.' }, { description: 'Cook until creamy and serve warm.' }] }
];

const content = [
  post('mock-post-101', 'mock-user-lan', 'A bowl for the in-between days', 'Bright greens, warm rice, and enough crunch to make lunch feel like a reset.', freshProduce, '2026-10-08T09:20:00Z', 48, 6),
  post('mock-post-102', 'mock-user-lan', 'The ten-minute tofu toast', 'A soft, lemony spread for the days when dinner needs to happen quickly.', heroBowl, '2026-10-02T07:15:00Z', 32, 4),
  post('mock-post-201', 'mock-user-minh', 'Leftovers, with a little intention', 'One pan, three vegetables, and a dressing that pulls the whole plate together.', colorfulPlate, '2026-09-28T18:10:00Z', 29, 3),
  post('mock-post-202', 'mock-user-minh', 'A slower breakfast', 'Cinnamon, banana, and oats for a quiet start to the weekend.', null, '2026-09-16T06:40:00Z', 21, 2),
  post('mock-post-301', 'mock-user-bao', 'Colour is a useful ingredient', 'A market walk became this simple plate of herbs, citrus, and warm grains.', communityMember, '2026-09-11T11:05:00Z', 18, 1)
];

const recipesByUser = {
  'mock-user-lan': [recipes[0], recipes[1]],
  'mock-user-minh': [recipes[2]],
  'mock-user-bao': [recipes[1]]
};

const postsByUser = users.reduce((result, user) => ({ ...result, [user.userId]: content.filter((item) => item.authorId === user.userId) }), {});

const stableHash = (value) => [...String(value)].reduce((hash, character) => ((hash * 31) + character.charCodeAt(0)) >>> 0, 7);
const generatedImages = [freshProduce, heroBowl, colorfulPlate, communityMember];
const generatedNames = ['Demo Kitchen', 'Preview Cook', 'Community Table', 'Sample Member'];

function generatedProfile(userId) {
  const hash = stableHash(userId);
  const name = generatedNames[hash % generatedNames.length];
  return {
    userId: String(userId),
    displayName: `${name} ${String(userId)}`,
    username: `preview_${String(userId).replace(/[^a-z0-9]/gi, '').toLowerCase() || 'user'}`,
    avatarUrl: generatedImages[hash % generatedImages.length],
    bio: `Preview-only public profile generated for user ID ${userId}. This demo data is not the real account.`,
    joinedAt: '2025-06-15T00:00:00Z',
    stats: { posts: 4, approvedRecipeContributions: 2, totalLikes: 64 },
    isGeneratedDemo: true
  };
}

function generatedPosts(userId) {
  const profile = generatedProfile(userId);
  return [0, 1, 2, 3].map((index) => ({
    ...post(`mock-post-${userId}-${index + 1}`, String(userId), ['A bright plate for a busy day', 'Three ingredients, one good habit', 'Notes from the community table', 'A simple dinner worth repeating'][index], ['Fresh, practical, and easy to bring into the week.', 'A small recipe idea with a little room to make it yours.', 'Keeping the useful parts and sharing the rest.', 'Good food does not need a complicated plan.'][index], generatedImages[(stableHash(userId) + index) % generatedImages.length], `2026-09-${String(10 + index).padStart(2, '0')}T08:00:00Z`, 12 + index * 7, index),
    author: profile.displayName,
    username: profile.username,
    avatar: profile.avatarUrl
  }));
}

function generatedRecipes(userId) {
  const hash = stableHash(userId);
  return [0, 1].map((index) => ({
    dishId: `mock-dish-${userId}-${index + 1}`,
    name: ['Preview grain bowl', 'Demo lemon oats'][index],
    description: 'Preview-only approved recipe data for the public profile UI.',
    imageUrl: generatedImages[(hash + index + 1) % generatedImages.length],
    calories: 340 + index * 55,
    proteinG: 14 + index * 3,
    carbsG: 44 + index * 4,
    healthyFatsG: 11 + index,
    servings: 2,
    prepTimeMinutes: 10,
    cookTimeMinutes: 12,
    ingredients: [{ quantity: '1', unit: 'cup', name: 'seasonal produce' }, { quantity: '1', unit: 'serving', name: 'whole grain' }],
    steps: [{ description: 'Prepare the ingredients.' }, { description: 'Combine, season, and serve.' }],
    isGeneratedDemo: true
  }));
}

export const MOCK_PUBLIC_PROFILE_USERS = users;
export const MOCK_PUBLIC_PROFILE_POSTS = content;
export const MOCK_PUBLIC_PROFILE_RECIPES = recipes;
export const isMockPublicProfileUser = (userId) => String(userId).startsWith('mock-user-');
export const isMockPublicProfilePost = (postId) => String(postId).startsWith('mock-post-');
export const isMockPublicProfileRecipe = (dishId) => String(dishId).startsWith('mock-dish-');

export async function getMockPublicProfile(userId, signal) {
  return delay(users.find((user) => String(user.userId) === String(userId)) ?? generatedProfile(userId), signal);
}

export async function getMockPublicProfileContent(userId, { signal } = {}) {
  return delay({ posts: postsByUser[userId] ?? generatedPosts(userId), last: true }, signal);
}

export async function getMockPublicProfileRecipes(userId, { signal } = {}) {
  return delay({ recipes: recipesByUser[userId] ?? generatedRecipes(userId), last: true }, signal);
}

export async function getMockPost(postId, signal) {
  const item = content.find((candidate) => String(candidate.id) === String(postId))
    ?? (String(postId).startsWith('mock-post-') ? generatedPosts(String(postId).replace(/^mock-post-/, '').replace(/-\d+$/, ''))
      .find((candidate) => candidate.id === postId) : null);
  if (!item) { const error = new Error('Mock post not found'); error.status = 404; throw error; }
  return delay(item, signal);
}

export const getMockRecipe = (dishId) => recipes.find((recipe) => String(recipe.dishId) === String(dishId))
  ?? (String(dishId).startsWith('mock-dish-') ? generatedRecipes(String(dishId).replace(/^mock-dish-/, '').replace(/-\d+$/, ''))
    .find((recipe) => recipe.dishId === dishId) : null);
