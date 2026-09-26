import { BarChart3, BookOpen, CalendarDays, MapPin, Rss } from 'lucide-react';

export const userDashboardNav = [
  { label: 'Home', icon: Rss, to: '/home' },
  { label: 'My blogs', icon: BookOpen, to: '/community/my-blogs' },
  { label: 'Weekly Meal Planner', icon: CalendarDays, to: '/community/planner' },
  { label: 'Nearby Vegan Map', icon: MapPin },
  { label: 'Analytics', icon: BarChart3 },
];
