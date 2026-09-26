// Development-only data for reviewing the two public blog screens without MySQL.
import bowl from '../assets/hero-bowl.jpg';
import plate from '../assets/colorful-plate.jpg';
import produce from '../assets/fresh-produce.jpg';

const titles = [
  'A colorful bowl for busy mornings', 'Simple greens for lunch', 'Making weeknight dinners easier',
  'A gentler way to plan your meals', 'Five small habits for a brighter kitchen',
  'Fresh produce, less food waste', 'Finding balance on a busy day',
  'The joy of a shared table', 'Pantry notes for plant-based meals',
  'A simple Sunday meal plan', 'Lunch ideas worth repeating', 'A fresh start for tomorrow',
];

export const reviewBlogs = titles.map((title, index) => ({
  contentId: index + 1,
  slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
  title,
  thumbnailUrl: [bowl, plate, produce][index % 3],
  authorName: ['Minh Anh', 'Tuyet Lan', 'NutriBot Team'][index % 3],
  viewCount: 42 + index * 19,
  voteCount: 0,
  createdAt: new Date(Date.UTC(2026, 8, 26 - index, 9, 0)).toISOString(),
  body: `A good meal can be simple, colorful, and easy to come back to. ${title} is a small note from our kitchen to yours.\n\n## Start with what you have\n\nChoose a few fresh ingredients and build a plate that fits your day. There is room to make it your own.\n\n- Add something fresh and colorful\n- Make room for protein and whole grains\n- Keep the preparation practical\n\n**Good food should feel good to keep.**`,
}));

export function reviewBlogPage(page, size) {
  return {
    content: reviewBlogs.slice(page * size, (page + 1) * size),
    totalElements: reviewBlogs.length,
    totalPages: Math.ceil(reviewBlogs.length / size),
    currentPage: page,
  };
}
