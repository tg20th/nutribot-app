import { BookOpen, Download, FileText, ShieldCheck, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { adminApi } from '../../services/adminApi';
import { ErrorState, LoadingState, Toast } from '../../components/admin/AdminUi';

const formatDate = (value) => {
  if (!value) return 'Recently submitted';
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
};

export default function AdminDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState(false);
  const [toast, setToast] = useState('');

  const loadDashboard = () => {
    const controller = new AbortController();
    setError(false);
    adminApi.getDashboard(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setDashboard(result);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  };

  useEffect(loadDashboard, []);

  if (!dashboard && !error) return <LoadingState label="Loading platform overview..." />;
  if (error) return <ErrorState onRetry={loadDashboard} />;

  const { metrics, moderationQueue, categories } = dashboard;

  return (
    <main className="dashboard-ledger">
      <header className="dashboard-ledger-heading">
        <div>
          <p className="admin-eyebrow">Administration</p>
          <h1>Platform overview</h1>
          <p className="dashboard-ledger-intro">A focused snapshot of the community and the decisions currently waiting for an admin.</p>
        </div>
        <div className="dashboard-heading-actions">
          <button type="button" className="admin-btn dashboard-export-button" onClick={() => setToast('Report export will be available when its API is connected.')}>
            <Download size={17} aria-hidden="true" /> Export report
          </button>
        </div>
      </header>

      <section className="dashboard-ledger-summary" aria-label="Platform summary">
        <Link to="/admin/users" className="dashboard-summary-item">
          <span className="dashboard-summary-icon"><Users size={20} aria-hidden="true" /></span>
          <span><small>Members</small><strong>{metrics.totalUsers}</strong><em>registered accounts</em></span>
        </Link>
        <Link to="/admin/moderation" className="dashboard-summary-item dashboard-summary-item--priority">
          <span className="dashboard-summary-icon"><ShieldCheck size={20} aria-hidden="true" /></span>
          <span><small>Needs review</small><strong>{metrics.pendingModeration}</strong><em>pending submissions</em></span>
        </Link>
        <Link to="/admin/moderation" className="dashboard-summary-item">
          <span className="dashboard-summary-icon"><BookOpen size={20} aria-hidden="true" /></span>
          <span><small>Published</small><strong>{metrics.publishedContent}</strong><em>blogs and videos</em></span>
        </Link>
      </section>

      <section className="dashboard-ledger-grid">
        <article className="dashboard-panel dashboard-review-panel">
          <div className="dashboard-panel-heading">
            <div><p className="admin-eyebrow">Review desk</p><h2>Latest submissions</h2></div>
            <Link to="/admin/moderation" className="dashboard-text-link">Open moderation</Link>
          </div>
          {moderationQueue.length ? (
            <ol className="dashboard-review-list">
              {moderationQueue.map((item) => (
                <li key={`${item.type}-${item.id}`}>
                  <span className="dashboard-content-icon"><FileText size={18} aria-hidden="true" /></span>
                  <div><strong>{item.title}</strong><span>{item.author} - {formatDate(item.submittedAt)}</span></div>
                  <span className="dashboard-status">Awaiting review</span>
                </li>
              ))}
            </ol>
          ) : <div className="dashboard-empty-copy">Nothing is waiting for review right now.</div>}
        </article>

        <aside className="dashboard-panel dashboard-category-panel">
          <div className="dashboard-panel-heading">
            <div><p className="admin-eyebrow">Content catalogue</p><h2>Categories</h2></div>
            <Link to="/admin/categories" className="dashboard-text-link">Manage categories</Link>
          </div>
          <p className="dashboard-category-note">Configured categories only. The current API does not provide reliable category activity totals.</p>
          {categories.length ? (
            <ul className="dashboard-category-list">
              {categories.map((category) => <li key={category.id}><span>{category.name}</span><small className={category.active ? 'is-active' : 'is-hidden'}>{category.active ? 'Active' : 'Hidden'}</small></li>)}
            </ul>
          ) : <div className="dashboard-empty-copy">No categories have been configured.</div>}
        </aside>
      </section>

      <Toast message={toast} onDismiss={() => setToast('')} />
    </main>
  );
}
