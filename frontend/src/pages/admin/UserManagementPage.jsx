import { Flag, LockKeyhole, UnlockKeyhole } from 'lucide-react';
import { useEffect, useState } from 'react';
import { adminApi } from '../../services/adminApi';
import { AdminToolbar, ConfirmDialog, EmptyState, ErrorState, LoadingState, PageHeader, Pagination, SearchBox, StatusBadge, Toast } from '../../components/admin/AdminUi';

const size = 10;
const previewMembers = [
  { id: 101, username: 'anhnguyen', email: 'anh.nguyen@example.com', name: 'Nguyen Minh Anh', role: 'MEMBER', status: 'ACTIVE', strikeCount: 0, joinedAt: '24 Sep 2026' },
  { id: 102, username: 'linhtran', email: 'linh.tran@example.com', name: 'Tran Gia Linh', role: 'MEMBER', status: 'BANNED', strikeCount: 3, joinedAt: '21 Sep 2026', violationReasons: ['Đăng liên kết quảng cáo lặp lại trong bài viết cộng đồng', 'Đưa ra khẳng định dinh dưỡng nhưng không có nguồn tham chiếu', 'Dùng ngôn ngữ công kích trong chuỗi bình luận'] },
  { id: 103, username: 'hoangpham', email: 'hoang.pham@example.com', name: 'Pham Duc Hoang', role: 'MEMBER', status: 'ACTIVE', strikeCount: 1, joinedAt: '17 Sep 2026', violationReasons: ['Đưa ra khẳng định sức khỏe chưa được xác minh trong mô tả công thức'] },
];

export default function UserManagementPage() {
  const preview = import.meta.env.DEV && new URLSearchParams(window.location.search).get('preview') === '1';
  const [previewItems, setPreviewItems] = useState(previewMembers);
  const [items, setItems] = useState([]);
  const [contentCounts, setContentCounts] = useState({});
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [toast, setToast] = useState(null);
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
    const loadUsers = async () => {
      try {
        const result = await adminApi.getUsers({ keyword: query, status, page: page - 1, size }, controller.signal);
        if (!controller.signal.aborted) {
          setItems(result.content ?? []);
          setTotalPages(result.totalPages || 1);
        }
      } catch {
        if (controller.signal.aborted) return;
        if (!status) {
          setError(true);
          return;
        }
        try {
          // Some deployed API versions reject the status parameter. Keep the
          // filter usable while the backend is being synchronized.
          const result = await adminApi.getUsers({ keyword: query, status: '', page: 0, size: 50 }, controller.signal);
          if (!controller.signal.aborted) {
            setItems((result.content ?? []).filter((user) => user.status === status));
            setTotalPages(1);
          }
        } catch {
          if (!controller.signal.aborted) setError(true);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    loadUsers();
    return () => controller.abort();
  }, [query, status, page, reloadKey, preview, previewItems]);

  useEffect(() => {
    if (preview || !items.length) {
      setContentCounts({});
      return undefined;
    }
    const controller = new AbortController();
    adminApi.getMemberContentCounts(controller.signal)
      .then((counts) => { if (!controller.signal.aborted) setContentCounts(counts); })
      .catch(() => { if (!controller.signal.aborted) setContentCounts({}); });
    return () => controller.abort();
  }, [items, preview]);

  const reload = () => setReloadKey((key) => key + 1);

  const updateStatus = async () => {
    if (!confirm) return;
    if (preview) {
      setPreviewItems((users) => users.map((user) => user.id === confirm.id ? { ...user, status: confirm.status } : user));
      setToast({ message: `Member account ${confirm.status === 'BANNED' ? 'locked' : 'unlocked'} successfully.`, variant: 'success' });
      setConfirm(null);
      return;
    }
    try {
      await adminApi.updateUserStatus(confirm.id, confirm.status);
      setToast({ message: `Member account ${confirm.status === 'BANNED' ? 'locked' : 'unlocked'} successfully.`, variant: 'success' });
      setConfirm(null);
      reload();
    } catch {
      setConfirm(null);
      setToast({ message: 'Could not update this member. Please try again.', variant: 'error' });
    }
  };

  return <>
    <PageHeader title="Members" text="Review registered members and manage account access." />
    <AdminToolbar className="members-admin-toolbar" label="Member filters">
      <SearchBox value={query} onChange={(value) => { setQuery(value); setPage(1); }} placeholder="Search name, email, or username..." />
      <select className="admin-filter-select members-status-filter" aria-label="Filter members by status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">All statuses</option><option value="ACTIVE">Active</option><option value="WARN">Warn</option><option value="BANNED">Banned</option></select>
      <Toast message={toast?.message} variant={toast?.variant} className="members-admin-toast" onDismiss={() => setToast(null)} />
    </AdminToolbar>
    <section className="admin-panel table-panel members-table-panel">
      {error ? <ErrorState onRetry={reload} /> : loading ? <LoadingState /> : items.length ? <table className="admin-table members-admin-table"><colgroup><col className="member-column" /><col className="content-column" /><col className="violations-column" /><col className="status-column" /><col className="role-column" /><col className="joined-column" /><col className="actions-column" /></colgroup><thead><tr><th>Member</th><th>Content</th><th>Violations</th><th>Status</th><th>Role</th><th>Joined</th><th aria-label="Actions" /></tr></thead><tbody>{items.map((user) => {
        const locked = user.status === 'BANNED';
        const canChangeStatus = ['ACTIVE', 'WARN', 'BANNED'].includes(user.status);
        return <tr key={user.id}><td className="member-cell"><div className="member-profile"><MemberAvatar member={user}/><span><b>{user.name}</b><small className="member-identity">{user.username && <span><em>{user.username}</em></span>}<span><em>{user.email}</em></span></small></span></div></td><td className="content-count">{contentCounts[user.id] ?? 0}</td><td><ViolationFlags memberId={user.id} count={user.strikeCount} reasons={user.violationReasons} /></td><td><StatusBadge status={user.status} /></td><td>{user.role}</td><td>{user.joinedAt}</td><td className="row-actions">{canChangeStatus && <button type="button" className={`member-account-action ${locked ? 'is-lock' : 'is-unlock'}`} onClick={() => setConfirm({ id: user.id, status: locked ? 'ACTIVE' : 'BANNED', title: locked ? 'Unlock this user?' : 'Lock this user?', text: locked ? 'The user will be able to access authorized features again.' : 'The user will no longer be able to access authorized features.', confirm: locked ? 'Unlock Account' : 'Lock Account' })} aria-label={`${locked ? 'Unlock' : 'Lock'} ${user.name}`} title={`${locked ? 'Unlock' : 'Lock'} account`}>{locked ? <LockKeyhole size={24} /> : <UnlockKeyhole size={24} />}</button>}</td></tr>;
      })}</tbody></table> : <EmptyState title="No members found." text="Try changing your search or status filter." />}
      {!error && !loading && items.length > 0 && <Pagination page={page} total={totalPages} onPage={setPage} />}
    </section>
    <ConfirmDialog dialog={confirm} onClose={() => setConfirm(null)} onConfirm={updateStatus} />
  </>;
}

function MemberAvatar({ member }) {
  const [failed, setFailed] = useState(!member.avatarUrl);
  const initials = String(member.name || member.username || '?').trim().split(/\s+/).slice(0, 2).map((value) => value[0]).join('').toUpperCase();
  return <span className="member-avatar" aria-hidden="true">{!failed && <img src={member.avatarUrl} alt="" onError={() => setFailed(true)}/>} {failed && initials}</span>;
}

function ViolationFlags({ memberId, count, reasons = [] }) {
  const total = Math.max(0, Number(count) || 0);
  const visibleFlags = Math.min(total, 3);
  if (!visibleFlags) return <span className="violation-flags is-clear" aria-label="No recorded violations">-</span>;
  return <span className={`violation-flags has-${visibleFlags}`} aria-label={`${total} recorded violation${total === 1 ? '' : 's'}`}>{Array.from({ length: visibleFlags }, (_, index) => { const violation = reasons[index]; const reason = typeof violation === 'string' ? violation : violation?.reason || 'Lý do đang chờ API quản lý thành viên đồng bộ.'; const title = typeof violation === 'string' ? '' : violation?.contentTitle; const tooltipId = `violation-${memberId}-${index}`; return <span className="violation-flag" key={index} tabIndex="0" aria-describedby={tooltipId}><Flag size={17} fill="currentColor" /><span id={tooltipId} role="tooltip" className="violation-tooltip"><b>Violation {index + 1}</b>{title && <small>{title}</small>}<span>{reason}</span></span></span>; })}</span>;
}
