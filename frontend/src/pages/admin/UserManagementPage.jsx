import { LockKeyhole, UnlockKeyhole } from 'lucide-react';
import { useEffect, useState } from 'react';
import { adminApi } from '../../services/adminApi';
import { ConfirmDialog, EmptyState, ErrorState, LoadingState, PageHeader, Pagination, SearchBox, StatusBadge, Toast } from '../../components/admin/AdminUi';

const size = 10;
const previewMembers = [
  { id: 101, username: 'anhnguyen', email: 'anh.nguyen@example.com', name: 'Nguyen Minh Anh', role: 'MEMBER', status: 'ACTIVE', joinedAt: '24 Sep 2026' },
  { id: 102, username: 'linhtran', email: 'linh.tran@example.com', name: 'Tran Gia Linh', role: 'MEMBER', status: 'BANNED', joinedAt: '21 Sep 2026' },
  { id: 103, username: 'hoangpham', email: 'hoang.pham@example.com', name: 'Pham Duc Hoang', role: 'MEMBER', status: 'ACTIVE', joinedAt: '17 Sep 2026' },
];

export default function UserManagementPage() {
  const preview = import.meta.env.DEV && new URLSearchParams(window.location.search).get('preview') === '1';
  const [previewItems, setPreviewItems] = useState(previewMembers);
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [toast, setToast] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (preview) {
      const keyword = query.trim().toLowerCase();
      setItems(previewItems.filter((user) =>
        (!status || user.status === status)
        && (!keyword || [user.name, user.username, user.email].some((value) => value.toLowerCase().includes(keyword)))
      ));
      setTotalPages(1);
      setLoading(false);
      setError(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    adminApi.getUsers({ keyword: query, status, page: page - 1, size }, controller.signal)
      .then((result) => {
        setItems(result.content ?? []);
        setTotalPages(result.totalPages || 1);
      })
      .catch((requestError) => {
        // React StrictMode aborts its first development-only request while it
        // checks effect cleanup. apiRequest deliberately wraps fetch errors,
        // so the signal is the reliable way to identify that cancellation.
        if (!controller.signal.aborted) setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [query, status, page, reloadKey, preview, previewItems]);

  const reload = () => setReloadKey((key) => key + 1);

  const updateStatus = async () => {
    if (!confirm) return;
    if (preview) {
      setPreviewItems((users) => users.map((user) => user.id === confirm.id ? { ...user, status: confirm.status } : user));
      setToast(`Member account ${confirm.status === 'BANNED' ? 'locked' : 'unlocked'} successfully.`);
      setConfirm(null);
      return;
    }
    try {
      await adminApi.updateUserStatus(confirm.id, confirm.status);
      setToast(`Member account ${confirm.status === 'BANNED' ? 'locked' : 'unlocked'} successfully.`);
      setConfirm(null);
      reload();
    } catch {
      setConfirm(null);
      setToast('Could not update this member. Please try again.');
    }
  };

  return <>
    <div className="members-admin-hero">
      <PageHeader title="Members" text="Review registered members and manage account access." />
    </div>
    <div className="admin-toolbar members-admin-toolbar">
      <SearchBox value={query} onChange={(value) => { setQuery(value); setPage(1); }} placeholder="Search name, email, or username..." />
      <label>Status<select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">All statuses</option><option value="ACTIVE">Active</option><option value="WARN">Warn</option><option value="BANNED">Banned</option><option value="PENDING_VERIFY">Pending verification</option></select></label>
    </div>
    <section className="admin-panel table-panel members-table-panel">
      {error ? <ErrorState onRetry={reload} /> : loading ? <LoadingState /> : items.length ? <table className="admin-table members-admin-table"><colgroup><col className="member-column" /><col className="id-column" /><col className="status-column" /><col className="role-column" /><col className="joined-column" /><col className="actions-column" /></colgroup><thead><tr><th>Member</th><th>User ID</th><th>Status</th><th>Role</th><th>Joined</th><th aria-label="Actions" /></tr></thead><tbody>{items.map((user) => {
        const locked = user.status === 'BANNED';
        return <tr key={user.id}><td className="member-cell"><span><b>{user.name}</b><small>{user.username ? `${user.username} / ${user.email}` : user.email}</small></span></td><td>{user.id}</td><td><StatusBadge status={user.status} /></td><td>{user.role}</td><td>{user.joinedAt}</td><td className="row-actions">{['ACTIVE', 'BANNED'].includes(user.status) && <button type="button" className={locked ? '' : 'delete-icon'} onClick={() => setConfirm({ id: user.id, status: locked ? 'ACTIVE' : 'BANNED', title: locked ? 'Unlock this user?' : 'Lock this user?', text: locked ? 'The user will be able to access authorized features again.' : 'The user will no longer be able to access authorized features.', confirm: locked ? 'Unlock Account' : 'Lock Account' })} aria-label={`${locked ? 'Unlock' : 'Lock'} ${user.name}`}>{locked ? <UnlockKeyhole size={16} /> : <LockKeyhole size={16} />}</button>}</td></tr>;
      })}</tbody></table> : <EmptyState title="No members found." text="Try changing your search or status filter." />}
      {!error && !loading && items.length > 0 && <Pagination page={page} total={totalPages} onPage={setPage} />}
    </section>
    <ConfirmDialog dialog={confirm} onClose={() => setConfirm(null)} onConfirm={updateStatus} />
    <Toast message={toast} onDismiss={() => setToast('')} />
  </>;
}
