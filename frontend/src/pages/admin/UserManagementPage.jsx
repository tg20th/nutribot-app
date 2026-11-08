import { Flag, History, LockKeyhole, UnlockKeyhole } from 'lucide-react';
import { useEffect, useState } from 'react';
import { adminApi } from '../../services/adminApi';
import { AdminToolbar, ConfirmDialog, EmptyState, ErrorState, LoadingState, PageHeader, Pagination, SearchBox, StatusBadge, Toast } from '../../components/admin/AdminUi';

const size = 10;
const formatViolationDate = (value) => {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).format(date).replace(',', ' ·');
};
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
  const [violationView, setViolationView] = useState(null);
  const [violationState, setViolationState] = useState({ loading: false, error: '', data: null });
  const [banHistoryView, setBanHistoryView] = useState(null);
  const [banHistoryFilter, setBanHistoryFilter] = useState('');
  const [banHistoryState, setBanHistoryState] = useState({ loading: false, error: '', data: null });

  useEffect(() => {
    if (!violationView) return undefined;
    const handleKeyDown = (event) => { if (event.key === 'Escape') setViolationView(null); };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [violationView]);

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
  const openViolationHistory = async (user) => {
    setViolationView(user);
    setViolationState({ loading: true, error: '', data: null });
    try {
      const data = preview ? { content: (user.violationReasons ?? []).map((reason, index) => ({ id: index, type: 'BLOG', title: 'Preview violation', reason: typeof reason === 'string' ? reason : reason.reason, reviewedAt: null, admin: 'Unavailable' })), totalElements: user.strikeCount ?? 0 } : await adminApi.getUserViolationHistory(user.id, { page: 0, size: 50 });
      setViolationState({ loading: false, error: '', data });
    } catch {
      setViolationState({ loading: false, error: 'Could not load violation history.', data: null });
    }
  };
  const handleViolationClick = (event) => {
    if (!event.target.closest('.violation-flags')) return;
    const row = event.target.closest('tr');
    const rows = row ? [...row.parentElement.children] : [];
    const user = items[rows.indexOf(row)];
    if (user) openViolationHistory(user);
  };
  const openBanHistory = async (user, filter = '') => {
    setBanHistoryView(user); setBanHistoryFilter(filter); setBanHistoryState({ loading: true, error: '', data: null });
    try { const data = await adminApi.getUserStatusHistory(user.id, { page: 0, size: 50, action: filter }); setBanHistoryState({ loading: false, error: '', data }); }
    catch { setBanHistoryState({ loading: false, error: 'Could not load ban history.', data: null }); }
  };
  const handleBanHistoryClick = (event) => {
    if (!event.target.closest('.member-ban-history-trigger')) return;
    const row = event.target.closest('tr'); const rows = row ? [...row.parentElement.children] : []; const user = items[rows.indexOf(row)];
    if (user) openBanHistory(user);
  };

  const updateStatus = async (reason = '') => {
    if (!confirm) return;
    if (preview) {
      setPreviewItems((users) => users.map((user) => user.id === confirm.id ? { ...user, status: confirm.status } : user));
      setToast({ message: `Member account ${confirm.status === 'BANNED' ? 'locked' : 'unlocked'} successfully.`, variant: 'success' });
      setConfirm(null);
      return;
    }
    try {
      await adminApi.updateUserStatus(confirm.id, confirm.status, reason);
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
    <section className="admin-panel table-panel members-table-panel" onClick={handleViolationClick}>
      {error ? <ErrorState onRetry={reload} /> : loading ? <LoadingState /> : items.length ? <table className="admin-table members-admin-table"><colgroup><col className="member-column" /><col className="content-column" /><col className="violations-column" /><col className="status-column" /><col className="role-column" /><col className="joined-column" /><col className="actions-column" /></colgroup><thead><tr><th>Member</th><th>Content</th><th>Violations</th><th>Status</th><th>Role</th><th>Joined</th><th aria-label="Actions" /></tr></thead><tbody>{items.map((user) => {
        const locked = user.status === 'BANNED';
        const canChangeStatus = ['ACTIVE', 'WARN', 'BANNED'].includes(user.status);
        return <tr key={user.id}><td className="member-cell"><div className="member-profile"><MemberAvatar member={user}/><span><b>{user.name}</b><small className="member-identity">{user.username && <span><em>{user.username}</em></span>}<span><em>{user.email}</em></span></small></span></div></td><td className="content-count">{contentCounts[user.id] ?? 0}</td><td><ViolationFlags memberId={user.id} count={user.strikeCount} reasons={user.violationReasons} /></td><td><StatusBadge status={user.status} /></td><td>{user.role}</td><td>{user.joinedAt}</td><td className="row-actions"><button type="button" className="member-ban-history-trigger" onClick={() => openBanHistory(user)} aria-label={`Ban History for ${user.name}`} title="Ban History"><History size={20} /></button>{canChangeStatus && <button type="button" className={`member-account-action ${locked ? 'is-lock' : 'is-unlock'}`} onClick={() => setConfirm({ id: user.id, status: locked ? 'ACTIVE' : 'BANNED', title: locked ? 'Unlock this user?' : 'Lock this user?', text: locked ? 'The user will be able to access authorized features again.' : 'The user will no longer be able to access authorized features.', confirm: locked ? 'Unlock Account' : 'Lock Account' })} aria-label={`${locked ? 'Unlock' : 'Lock'} ${user.name}`} title={`${locked ? 'Unlock' : 'Lock'} account`}>{locked ? <LockKeyhole size={24} /> : <UnlockKeyhole size={24} />}</button>}</td></tr>;
      })}</tbody></table> : <EmptyState title="No members found." text="Try changing your search or status filter." />}
      {!error && !loading && items.length > 0 && <Pagination page={page} total={totalPages} onPage={setPage} />}
    </section>
    <ConfirmDialog dialog={confirm} onClose={() => setConfirm(null)} onConfirm={updateStatus} />
    {violationView && <div className="admin-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setViolationView(null); }}><section className="admin-dialog member-violation-dialog" role="dialog" aria-modal="true" aria-labelledby="violation-history-title" onMouseDown={(event) => event.stopPropagation()}><header><div><h2 id="violation-history-title">Violation history</h2><span>{violationView.username || violationView.name} · {violationState.data?.totalElements ?? 0} records</span></div><button type="button" onClick={() => setViolationView(null)} aria-label="Close violation history"><span aria-hidden="true">×</span></button></header>{violationState.loading ? <LoadingState label="Loading violation history..."/> : violationState.error ? <ErrorState message={violationState.error}/> : violationState.data?.content?.length ? <div className="member-violation-list">{violationState.data.content.map((item, index) => <article key={item.id ?? index}><div className="member-violation-record-head"><strong><Flag size={14} fill="currentColor"/>Violation {violationState.data.totalElements - index}</strong><time dateTime={item.reviewedAt || undefined}>{formatViolationDate(item.reviewedAt)}</time></div><h3>{item.type || 'Content'} · {item.title || 'Unavailable content'}</h3><p>{item.reason || 'Reason unavailable'}</p><small>Reviewed by {item.admin || 'Unavailable administrator'}</small></article>)}</div> : <EmptyState title="No recorded violations" text="This user has no available rejection history."/>}</section></div>}
    {banHistoryView && <BanHistoryModal user={banHistoryView} filter={banHistoryFilter} state={banHistoryState} onFilter={(value) => openBanHistory(banHistoryView, value)} onClose={() => setBanHistoryView(null)} />}
  </>;
}

function BanHistoryModal({ user, filter, state, onFilter, onClose }) {
  useEffect(() => { const close = (event) => event.key === 'Escape' && onClose(); document.addEventListener('keydown', close); return () => document.removeEventListener('keydown', close); }, [onClose]);
  const content = state.data?.content ?? [];
  return <div className="admin-modal-backdrop ban-history-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="ban-history-modal" role="dialog" aria-modal="true" aria-labelledby="ban-history-title" onMouseDown={(event) => event.stopPropagation()}><header className="ban-history-header"><div><h2 id="ban-history-title">Ban History</h2><p>{user.username || user.name}</p></div><button type="button" className="ban-history-close" onClick={onClose} aria-label="Close ban history">×</button></header><div className="ban-history-filter"><label htmlFor="ban-history-filter">Account actions</label><select id="ban-history-filter" value={filter} onChange={(event) => onFilter(event.target.value)}><option value="">All actions</option><option value="BAN">Ban only</option><option value="UNBAN">Unban only</option></select></div><div className="ban-history-content">{state.loading ? <div className="ban-history-state"><span className="ban-history-spinner" aria-hidden="true"/><p>Loading history...</p></div> : state.error ? <div className="ban-history-state"><span className="ban-history-state-icon">!</span><h3>Unable to load history</h3><p>{state.error}</p><button type="button" className="admin-btn secondary" onClick={() => onFilter(filter)}>Retry</button></div> : content.length ? <div className="ban-history-list">{content.map((item) => <article key={item.actionId}><div className="ban-history-record-head"><strong><span className={`ban-history-action-icon ${item.action === 'BAN' ? 'is-ban' : 'is-unban'}`}>{item.action === 'BAN' ? <LockKeyhole size={14}/> : <UnlockKeyhole size={14}/>}</span>{item.action === 'BAN' ? 'Account banned' : 'Account unbanned'}</strong><time>{formatViolationDate(item.createdAt)}</time></div><p className="ban-history-meta">{item.source || 'MANUAL'} · {item.adminId ? `Admin #${item.adminId}` : 'Automatic'} · {item.previousStatus || 'Unavailable'} → {item.newStatus || 'Unavailable'}</p><p className="ban-history-reason"><b>Reason</b>{item.reason || 'Reason unavailable'}</p>{item.additionalExplanation && item.additionalExplanation !== item.reason && <p className="ban-history-detail"><b>Additional explanation</b>{item.additionalExplanation}</p>}</article>)}</div> : <div className="ban-history-state"><History size={22} aria-hidden="true"/><h3>No ban history</h3><p>No account actions have been recorded.</p></div>}</div></section></div>;
}

function MemberAvatar({ member }) {
  const [failed, setFailed] = useState(!member.avatarUrl);
  const initials = String(member.name || member.username || '?').trim().split(/\s+/).slice(0, 2).map((value) => value[0]).join('').toUpperCase();
  return <span className="member-avatar" aria-hidden="true">{!failed && <img src={member.avatarUrl} alt="" onError={() => setFailed(true)}/>} {failed && initials}</span>;
}

function ViolationFlags({ memberId, count, reasons = [], onOpen }) {
  const total = Math.max(0, Number(count) || 0);
  const visibleFlags = Math.min(total, 3);
  if (!visibleFlags) return <span className="violation-flags is-clear" aria-label="No recorded violations">-</span>;
  return <button type="button" className={`violation-flags has-${visibleFlags}`} aria-label={`Open ${total} recorded violation${total === 1 ? '' : 's'}`} onClick={onOpen}>{Array.from({ length: visibleFlags }, (_, index) => <Flag key={index} size={17} fill="currentColor" />)}</button>;
  /* Kept below only as historical context; the clickable history view is the source of truth. */
  return <span className={`violation-flags has-${visibleFlags}`} aria-label={`${total} recorded violation${total === 1 ? '' : 's'}`}>{Array.from({ length: visibleFlags }, (_, index) => { const violation = reasons[index]; const reason = typeof violation === 'string' ? violation : violation?.reason || 'Lý do đang chờ API quản lý thành viên đồng bộ.'; const title = typeof violation === 'string' ? '' : violation?.contentTitle; const tooltipId = `violation-${memberId}-${index}`; return <span className="violation-flag" key={index} tabIndex="0" aria-describedby={tooltipId}><Flag size={17} fill="currentColor" /><span id={tooltipId} role="tooltip" className="violation-tooltip"><b>Violation {index + 1}</b>{title && <small>{title}</small>}<span>{reason}</span></span></span>; })}</span>;
}
