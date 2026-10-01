import { Activity, BarChart3, BookOpen, CalendarDays, History, MapPin, Rss, Search } from 'lucide-react';

export const userDashboardNav = [
  { label: 'Home', icon: Rss, to: '/home' },
  { label: 'Search', icon: Search, to: '/community/search' },
  { label: 'My blogs', icon: BookOpen, to: '/community/my-blogs' },
  { label: 'Weekly Meal Planner', icon: CalendarDays, to: '/community/planner' },
  { label: 'Health profile', icon: Activity, to: '/profile/health' },
  { label: 'Chat history', icon: History, to: '/chat-history' },
  { label: 'Nearby Vegan Map', icon: MapPin, to: '/restaurants/map' },
  { label: 'Analytics', icon: BarChart3 },
];
