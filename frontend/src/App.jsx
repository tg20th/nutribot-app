import { Navigate, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import CommunityFeedPage from './pages/CommunityFeedPage';
import CommunityContentDetailPage from './pages/CommunityContentDetailPage';
import WeeklyMenuPage from './pages/WeeklyMenuPage';
import ProfilePage from './pages/ProfilePage';
import HealthProfilePage from './pages/HealthProfilePage';
import SearchPage from './pages/SearchPage';
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
import MemberRoute from './components/MemberRoute';
import MyBlogsPage from './pages/MyBlogsPage';
import CreateBlogPage from './pages/CreateBlogPage';
import BlogListPage from './pages/BlogListPage';
import BlogDetailPage from './pages/BlogDetailPage';

export default function App() {
  return <Routes>
    <Route path="/" element={<HomePage />} />
    <Route path="/home" element={<MemberRoute><CommunityFeedPage /></MemberRoute>} />
    <Route path="/register" element={<RegisterPage />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/community" element={<Navigate to="/home" replace />} />
    <Route path="/blogs" element={<BlogListPage />} />
    <Route path="/blogs/id/:id" element={<BlogDetailPage byId />} />
    <Route path="/blogs/:slug" element={<BlogDetailPage />} />
    <Route path="/community/planner" element={<MemberRoute><WeeklyMenuPage /></MemberRoute>} />
    <Route path="/profile" element={<MemberRoute><ProfilePage /></MemberRoute>} />
    <Route path="/profile/health" element={<MemberRoute><HealthProfilePage /></MemberRoute>} />
    <Route path="/community/profile" element={<Navigate to="/profile" replace />} />
    <Route path="/community/my-blogs" element={<MemberRoute><MyBlogsPage /></MemberRoute>} />
    <Route path="/community/search" element={<MemberRoute><SearchPage member /></MemberRoute>} />
    <Route path="/community/blogs/new" element={<MemberRoute><CreateBlogPage /></MemberRoute>} />
    <Route path="/community/posts/:postId" element={<MemberRoute><CommunityContentDetailPage /></MemberRoute>} />
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
    <Route path="/search" element={<SearchPage />} />
    <Route path="*" element={<HomePage />} />
  </Routes>;
}
