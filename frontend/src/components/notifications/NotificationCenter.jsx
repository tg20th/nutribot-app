import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, Check, CheckCheck, ChevronDown, CircleAlert, Heart, Info, LoaderCircle, MessageCircle, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsAsRead,
  markNotificationAsRead
} from '../../services/notificationsApi';

const PAGE_SIZE = 10;

const buildInitials = (name) => String(name || 'NutriBot Member')
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map((part) => part.charAt(0).toUpperCase())
  .join('') || 'U';

const formatRelativeTime = (value) => {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return 'Recently';
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(timestamp);
};

const notificationDateGroup = (value) => {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return 'Earlier';
  const today = new Date();
  const date = new Date(timestamp);
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const day = 24 * 60 * 60 * 1000;
  if (dateStart === todayStart) return 'Today';
  if (dateStart === todayStart - day) return 'Yesterday';
  return 'Earlier';
};

const typeDetails = {
  CONTENT_VOTED: { Icon: Heart, className: 'is-voted' },
  CONTENT_COMMENTED: { Icon: MessageCircle, className: 'is-commented' },
  RECIPE_SUGGESTION_APPROVED: { Icon: Check, className: 'is-approved' },
  RECIPE_SUGGESTION_REJECTED: { Icon: Info, className: 'is-rejected' }
};

function notificationCopy(notification) {
  const actor = notification.actorFullName || 'Someone';
  const title = notification.contentTitle ? ` ${notification.contentTitle}` : '';
  switch (notification.type) {
    case 'CONTENT_VOTED': return `${actor} liked your post${title}.`;
    case 'CONTENT_COMMENTED': return `${actor} commented on your post${title}.`;
    case 'RECIPE_SUGGESTION_APPROVED': return 'Your recipe suggestion has been approved.';
    case 'RECIPE_SUGGESTION_REJECTED': return 'Your recipe suggestion was not approved.';
    default: return 'You have a new notification.';
  }
}

function NotificationAvatar({ notification }) {
  const [failed, setFailed] = useState(false);
  const name = notification.actorFullName || 'NutriBot Member';
  if (!notification.actorAvatarUrl || failed) return <span className="notification-avatar notification-avatar--fallback" aria-hidden="true">{buildInitials(name)}</span>;
  return <img className="notification-avatar" src={notification.actorAvatarUrl} alt="" onError={() => setFailed(true)} referrerPolicy="no-referrer" />;
}

function NotificationItem({ notification, onSelect, marking }) {
  const details = typeDetails[notification.type] || { Icon: CircleAlert, className: 'is-default' };
  const Icon = details.Icon;
  return <button
    type="button"
    className={`notification-item${notification.read ? '' : ' is-unread'}`}
    onClick={() => onSelect(notification)}
    disabled={marking}
  >
    <span className="notification-item__avatar-wrap">
      <NotificationAvatar notification={notification}/>
      <span className={`notification-item__interaction-icon ${details.className}`} aria-hidden="true"><Icon size={15}/></span>
    </span>
    <span className="notification-item__body">
      <span className="notification-item__message">{notificationCopy(notification)}</span>
      <span className="notification-item__meta"><time dateTime={notification.updatedAt || notification.createdAt}>{formatRelativeTime(notification.updatedAt || notification.createdAt)}</time></span>
    </span>
    {!notification.read && <i className="notification-item__unread-dot" aria-label="Unread"/>}
  </button>;
}

export default function NotificationCenter() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('all');
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [listState, setListState] = useState({ loading: false, loadingMore: false, error: '' });
  const [page, setPage] = useState({ current: 0, totalPages: 1, last: true });
  const [markingId, setMarkingId] = useState(null);
  const [popoverPosition, setPopoverPosition] = useState({ top: 12, left: 'auto', right: 12 });
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);
  const listController = useRef(null);
  const countController = useRef(null);
  const countRequest = useRef(false);
  const countRequestVersion = useRef(0);
  const listRequest = useRef(0);
  const readMutationIds = useRef(new Set());
  const readOverrides = useRef(new Map());
  const readMutationVersion = useRef(0);
  const markAllInFlight = useRef(false);

  const refreshUnreadCount = useCallback(async ({ force = false } = {}) => {
    if (!localStorage.getItem('nutribot-auth-token')) return;
    if (force) {
      countController.current?.abort();
      countRequest.current = false;
    }
    if (countRequest.current) return;
    countRequest.current = true;
    const requestVersion = ++countRequestVersion.current;
    const mutationVersionAtRequest = readMutationVersion.current;
    const controller = new AbortController();
    countController.current = controller;
    try {
      const count = await getUnreadNotificationCount(controller.signal);
      if (!controller.signal.aborted
        && requestVersion === countRequestVersion.current
        && mutationVersionAtRequest === readMutationVersion.current) setUnreadCount(count);
    } catch (error) {
      if (error.name !== 'AbortError') return;
    } finally {
      if (countController.current === controller) countRequest.current = false;
    }
  }, []);

  const loadNotifications = useCallback(async ({ reset = false } = {}) => {
    if (!reset && (listState.loading || listState.loadingMore || page.last)) return;
    if (reset) listController.current?.abort();
    const requestId = ++listRequest.current;
    const controller = new AbortController();
    listController.current = controller;
    const nextPage = reset ? 0 : page.current + 1;
    let requestFailed = false;
    setListState((state) => ({ ...state, loading: reset, loadingMore: !reset, error: reset ? '' : state.error }));
    try {
      const result = await getNotifications({ page: nextPage, size: PAGE_SIZE, signal: controller.signal });
      if (controller.signal.aborted || requestId !== listRequest.current) return;
      const applyReadOverride = (item) => readOverrides.current.has(item.notificationId)
        ? { ...item, read: readOverrides.current.get(item.notificationId) }
        : item;
      const incomingItems = result.items.map(applyReadOverride);
      setItems((current) => reset ? incomingItems : [...current, ...incomingItems.filter((item) => !current.some((existing) => existing.notificationId === item.notificationId))]);
      setPage({ current: result.page, totalPages: result.totalPages, last: result.last || result.page + 1 >= result.totalPages });
    } catch (error) {
      requestFailed = true;
      if (!controller.signal.aborted && requestId === listRequest.current) setListState((state) => ({ ...state, error: 'Notifications are unavailable right now.' }));
    } finally {
      if (!controller.signal.aborted && requestId === listRequest.current) setListState((state) => ({ ...state, loading: false, loadingMore: false, error: requestFailed ? state.error : '' }));
    }
  }, [listState.loading, listState.loadingMore, page.current, page.last]);

  useEffect(() => {
    refreshUnreadCount();
    const timer = window.setInterval(refreshUnreadCount, 30000);
    return () => { window.clearInterval(timer); countController.current?.abort(); listController.current?.abort(); };
  }, [refreshUnreadCount]);

  useEffect(() => {
    if (!open) return undefined;
    const handler = (event) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const updatePopoverPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const bounds = trigger.getBoundingClientRect();
    const mobile = window.innerWidth <= 640;
    const maxTop = Math.max(12, window.innerHeight - 160);
    setPopoverPosition({
      top: Math.min(bounds.bottom + 10, maxTop),
      left: mobile ? 12 : 'auto',
      right: mobile ? 12 : Math.max(12, window.innerWidth - bounds.right)
    });
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    updatePopoverPosition();
    const handleOutsidePointer = (event) => {
      if (!popoverRef.current?.contains(event.target) && !triggerRef.current?.contains(event.target)) setOpen(false);
    };
    const handleViewportChange = () => updatePopoverPosition();
    document.addEventListener('pointerdown', handleOutsidePointer);
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);
    return () => {
      document.removeEventListener('pointerdown', handleOutsidePointer);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [open, updatePopoverPosition]);

  const showDrawer = () => {
    setOpen(true);
    if (!listState.loading) loadNotifications({ reset: true });
    refreshUnreadCount();
  };

  const handleSelect = async (notification) => {
    setOpen(false);
    const notificationId = notification.notificationId;
    if (!notification.read && !readMutationIds.current.has(notificationId)) {
      readMutationIds.current.add(notificationId);
      readMutationVersion.current += 1;
      readOverrides.current.set(notificationId, true);
      setItems((current) => current.map((item) => item.notificationId === notification.notificationId ? { ...item, read: true } : item));
      setUnreadCount((count) => Math.max(0, count - 1));
      setMarkingId(notificationId);
      try {
        await markNotificationAsRead(notificationId);
        await refreshUnreadCount({ force: true });
      } catch {
        readOverrides.current.delete(notificationId);
        setItems((current) => current.map((item) => item.notificationId === notificationId ? { ...item, read: false } : item));
        setUnreadCount((count) => count + 1);
        refreshUnreadCount({ force: true });
      } finally {
        readMutationIds.current.delete(notificationId);
        setMarkingId(null);
      }
    }
    if (notification.referenceId && notification.referenceType === 'CONTENT' && ['BLOG', 'VIDEO'].includes(String(notification.contentType).toUpperCase())) {
      navigate(`/community/posts/${notification.referenceId}`, { state: { contentType: String(notification.contentType).toLowerCase(), returnTo: pathname } });
    }
  };

  const markAll = async () => {
    if (!unreadCount || markAllInFlight.current) return;
    markAllInFlight.current = true;
    readMutationVersion.current += 1;
    try {
      await markAllNotificationsAsRead();
      setItems((current) => {
        current.forEach((item) => readOverrides.current.set(item.notificationId, true));
        return current.map((item) => ({ ...item, read: true }));
      });
      setUnreadCount(0);
      await refreshUnreadCount({ force: true });
    } catch {
      refreshUnreadCount({ force: true });
    } finally {
      markAllInFlight.current = false;
    }
  };

  const visibleItems = tab === 'unread' ? items.filter((item) => !item.read) : items;
  const badge = unreadCount > 99 ? '99+' : unreadCount;
  const groupedItems = visibleItems.reduce((groups, notification) => {
    const label = notificationDateGroup(notification.updatedAt || notification.createdAt);
    groups[label] ??= [];
    groups[label].push(notification);
    return groups;
  }, {});

  const notificationOverlay = <>
    <aside ref={popoverRef} id="notification-popover" className={`notification-popover${open ? ' is-open' : ''}`} style={popoverPosition} aria-label="Notifications" aria-hidden={!open}>
      <header className="notification-popover__header"><h2>Notifications</h2><div className="notification-popover__header-actions"><button type="button" className="notification-mark-all" onClick={markAll} disabled={!unreadCount}><CheckCheck size={14}/> Mark all as read</button><button type="button" className="notification-popover__close" onClick={() => setOpen(false)} aria-label="Close notifications"><X size={17}/></button></div></header>
      <div className="notification-popover__tabs"><div className="notification-tabs" role="tablist" aria-label="Notification filter"><button type="button" className={tab === 'all' ? 'is-active' : ''} onClick={() => setTab('all')} role="tab" aria-selected={tab === 'all'}>All</button><button type="button" className={tab === 'unread' ? 'is-active' : ''} onClick={() => setTab('unread')} role="tab" aria-selected={tab === 'unread'}>Unread{unreadCount > 0 && <span>{badge}</span>}</button></div></div>
      <div className="notification-popover__content">
        {listState.loading ? <div className="notification-skeletons" aria-label="Loading notifications"><span/><span/><span/></div>
          : listState.error ? <div className="notification-state notification-state--error"><CircleAlert size={24}/><p>{listState.error}</p><button type="button" onClick={() => loadNotifications({ reset: true })}>Try again</button></div>
            : visibleItems.length === 0 ? <div className="notification-state"><Bell size={26}/><h3>{tab === 'unread' ? 'You are all caught up' : 'No notifications yet'}</h3><p>{tab === 'unread' ? 'New activity will appear here.' : 'Activity from your posts will appear here.'}</p></div>
              : <div className="notification-list">{['Today', 'Yesterday', 'Earlier'].map((group) => groupedItems[group]?.length ? <section className="notification-group" key={group}><h3>{group}</h3>{groupedItems[group].map((notification) => <NotificationItem key={notification.notificationId} notification={notification} onSelect={handleSelect} marking={markingId === notification.notificationId}/>)}</section> : null)}{!page.last && tab === 'all' && <button type="button" className="notification-load-more" onClick={() => loadNotifications()} disabled={listState.loadingMore}>{listState.loadingMore ? <LoaderCircle className="notification-spin" size={15}/> : <ChevronDown size={15}/>} {listState.loadingMore ? 'Loading...' : 'Load more'}</button>}</div>}
      </div>
    </aside>
  </>;

  return <>
    <button ref={triggerRef} type="button" className="community-icon-btn notification-trigger" onClick={showDrawer} aria-label={unreadCount ? `Open notifications, ${unreadCount} unread` : 'Open notifications'} aria-expanded={open} aria-controls="notification-popover">
      <Bell size={19}/>{unreadCount > 0 && <span className="notification-badge">{badge}</span>}
    </button>
    {typeof document !== 'undefined' ? createPortal(notificationOverlay, document.body) : null}
  </>;
}
