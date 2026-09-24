import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import CommunityFeedPage from './pages/CommunityFeedPage';
import CommunityContentDetailPage from './pages/CommunityContentDetailPage';
import WeeklyMealPlannerPage from './pages/WeeklyMealPlannerPage';
import CommunityProfilePage from './pages/CommunityProfilePage';
import AdminLayout from './layouts/AdminLayout';
import AdminRoute from './components/admin/AdminRoute';
import AdminDashboard from './pages/admin/AdminDashboard';
import UserManagementPage from './pages/admin/UserManagementPage';
import UserDetailPage from './pages/admin/UserDetailPage';
import CategoryManagementPage from './pages/admin/CategoryManagementPage';
import CommentManagementPage from './pages/admin/CommentManagementPage';
import { ContentDetailPage, ContentManagementPage } from './pages/admin/ContentPages';
import RegisterPage from './pages/RegisterPage';
import LoginPage from './pages/LoginPage';

export default function App() {
  return <Routes>
    <Route path="/" element={<HomePage />} />
    <Route path="/register" element={<RegisterPage />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/community" element={<CommunityFeedPage />} />
    <Route path="/community/planner" element={<WeeklyMealPlannerPage />} />
    <Route path="/community/profile" element={<CommunityProfilePage />} />
    <Route path="/community/posts/:postId" element={<CommunityContentDetailPage />} />
    <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
      <Route index element={<AdminDashboard />} />
      <Route path="users" element={<UserManagementPage />} />
      <Route path="users/:id" element={<UserDetailPage />} />
      <Route path="categories" element={<CategoryManagementPage />} />
      <Route path="content" element={<ContentManagementPage kind="Blog" />} />
      <Route path="content/blogs" element={<ContentManagementPage kind="Blog" />} />
      <Route path="content/blogs/:id" element={<ContentDetailPage kind="Blog" />} />
      <Route path="content/videos" element={<ContentManagementPage kind="Video" />} />
      <Route path="content/videos/:id" element={<ContentDetailPage kind="Video" />} />
      <Route path="comments" element={<CommentManagementPage />} />
    </Route>
    <Route path="*" element={<HomePage />} />
  </Routes>;
}
