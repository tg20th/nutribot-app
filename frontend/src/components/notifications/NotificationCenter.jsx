import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, Check, CheckCheck, ChevronDown, CircleAlert, Heart, Info, LoaderCircle, MessageCircle, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  getNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead
} from '../../services/notificationsApi';
import { useNotificationUnreadCount } from './NotificationProvider';
import NutriBotSystemAvatar from './NutriBotSystemAvatar';

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
  CONTENT_COMMENT_REPLIED: { Icon: MessageCircle, className: 'is-commented' },
  CONTENT_MODERATION_REJECTED: { Icon: CircleAlert, className: 'is-rejected' },
  CONTENT_MODERATION_APPROVED: { Icon: Check, className: 'is-approved' },
  RECIPE_SUGGESTION_APPROVED: { Icon: Check, className: 'is-approved' },
  RECIPE_SUGGESTION_REJECTED: { Icon: Info, className: 'is-rejected' }
};

const isAvailableContentNotification = (notification) => ['BLOG', 'VIDEO'].includes(String(notification.contentType || '').toUpperCase());

const getVoteActors = (notification) => {
  const fallbackActor = notification.actorFullName || notification.actorAvatarUrl
    ? { userId: notification.actorId, fullName: notification.actorFullName, avatarUrl: notification.actorAvatarUrl }
    : null;
  const source = Array.isArray(notification.actors) && notification.actors.length
    ? notification.actors
    : (fallbackActor ? [fallbackActor] : []);
  return source
    .filter((actor) => actor && (actor.userId != null || actor.fullName || actor.avatarUrl))
    .filter((actor, index, list) => {
      const key = actor.userId != null ? `id:${actor.userId}` : `name:${String(actor.fullName || '').trim().toLowerCase()}`;
      return list.findIndex((candidate) => {
        const candidateKey = candidate.userId != null ? `id:${candidate.userId}` : `name:${String(candidate.fullName || '').trim().toLowerCase()}`;
        return candidateKey === key;
      }) === index;
    });
};

const getVoteActorCount = (notification, actors) => {
  const count = Number(notification.actorCount);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : Math.max(actors.length, 1);
};

function notificationCopy(notification) {
  if (['CONTENT_MODERATION_REJECTED', 'CONTENT_MODERATION_APPROVED', 'RECIPE_SUGGESTION_APPROVED', 'RECIPE_SUGGESTION_REJECTED', 'CONTENT_COMMENT_REPLIED'].includes(notification.type)) {
    return notification.message || 'You have a new notification.';
  }
  const title = notification.contentTitle ? ` ${notification.contentTitle}` : '';
  switch (notification.type) {
    case 'CONTENT_VOTED': {
      const actors = getVoteActors(notification);
      const names = actors.map((actor) => String(actor.fullName || '').trim()).filter(Boolean).slice(0, 2);
      const count = getVoteActorCount(notification, actors);
      if (count === 1) return `${names[0] || 'Someone'} liked your post.`;
      if (count === 2) return `${names[0] || 'Someone'} and ${names[1] || 'another person'} liked your post.`;
      const otherCount = Math.max(1, count - names.length);
      return `${names.length > 1 ? `${names[0]} and ${names[1]}` : (names[0] || 'Someone')} and ${otherCount} ${otherCount === 1 ? 'other' : 'others'} liked your post.`;
    }
    case 'CONTENT_COMMENTED': return isAvailableContentNotification(notification)
      ? `${notification.actorFullName || 'Someone'} commented on your post${title}.`
      : `${notification.actorFullName || 'Someone'} commented on a post that is no longer available.`;
    case 'RECIPE_SUGGESTION_APPROVED': return 'Your recipe suggestion has been approved.';
    case 'RECIPE_SUGGESTION_REJECTED': return 'Your recipe suggestion was not approved.';
    default: return 'You have a new notification.';
  }
}

function NotificationAvatar({ notification }) {
  const [failed, setFailed] = useState(false);
  if (notification.type === 'CONTENT_MODERATION_REJECTED') return <NutriBotSystemAvatar moderation/>;
  if (notification.type === 'CONTENT_MODERATION_APPROVED') return <NutriBotSystemAvatar approved/>;
  const representative = Array.isArray(notification.actors) ? notification.actors[0] : null;
  const name = representative?.fullName || notification.actorFullName || 'NutriBot Member';
  const avatarUrl = representative?.avatarUrl || notification.actorAvatarUrl;
  if (!avatarUrl || failed) return <span className="notification-avatar notification-avatar--fallback" aria-hidden="true">{buildInitials(name)}</span>;
  return <img className="notification-avatar" src={avatarUrl} alt="" onError={() => setFailed(true)} referrerPolicy="no-referrer" />;
}

function VoteNotificationMessage({ notification }) {
  const actors = getVoteActors(notification);
  const names = actors.map((actor) => String(actor.fullName || '').trim()).filter(Boolean).slice(0, 2);
  const count = getVoteActorCount(notification, actors);
  const unavailable = !isAvailableContentNotification(notification);
  let lead;
  if (count === 1) lead = names[0] || 'Someone';
  else if (count === 2) lead = <><strong>{names[0] || 'Someone'}</strong> and <strong>{names[1] || 'another person'}</strong></>;
  else {
    const otherCount = Math.max(1, count - names.length);
    lead = <>{names.length > 1 ? <><strong>{names[0]}</strong>, <strong>{names[1]}</strong></> : <strong>{names[0] || 'Someone'}</strong>} and {otherCount} {otherCount === 1 ? 'other' : 'others'}</>;
  }
  if (count === 1) lead = <strong>{lead}</strong>;
  return <>
    <span className="notification-item__primary">{lead} <span>{unavailable ? 'liked a post that is no longer available.' : 'liked your post.'}</span></span>
    {!unavailable && notification.contentTitle && <span className="notification-item__content-title" title={notification.contentTitle}>{notification.contentTitle}</span>}
  </>;
}

function NotificationAvatarGroup({ notification }) {
  const actors = getVoteActors(notification).slice(0, 3);
  const renderedActors = actors.length ? actors : [{ fullName: 'NutriBot Member' }];
  const [failedActors, setFailedActors] = useState(() => new Set());

  const groupWidth = `${Math.max(36, (renderedActors.length * 25) + 11)}px`;
  return <span className="notification-avatar-group" style={{ width: groupWidth }} aria-hidden="true">
    <span className="notification-avatar-group__faces">
      {renderedActors.map((actor, index) => {
        const key = actor.userId != null ? String(actor.userId) : `${actor.fullName || 'member'}-${index}`;
        const name = actor.fullName || 'NutriBot Member';
        return failedActors.has(key) || !actor.avatarUrl
          ? <span className="notification-avatar notification-avatar--fallback notification-avatar-group__face" key={key}>{buildInitials(name)}</span>
          : <img className="notification-avatar notification-avatar-group__face" key={key} src={actor.avatarUrl} alt="" onError={() => setFailedActors((current) => new Set(current).add(key))} referrerPolicy="no-referrer" />;
      })}
    </span>
    <span className="notification-voted-heart" aria-hidden="true"><Heart size={12} fill="currentColor"/></span>
  </span>;
}

function NotificationItem({ notification, onSelect, marking }) {
  const details = typeDetails[notification.type] || { Icon: CircleAlert, className: 'is-default' };
  const Icon = details.Icon;
  return <button
    type="button"
    className={`notification-item${notification.type === 'CONTENT_VOTED' ? ' notification-item--voted' : ''}${notification.read ? '' : ' is-unread'}`}
    onClick={() => onSelect(notification)}
    disabled={marking}
  >
    <span className="notification-item__avatar-wrap">
      {notification.type === 'CONTENT_VOTED'
        ? <NotificationAvatarGroup notification={notification}/>
        : <NotificationAvatar notification={notification}/>} 
      {notification.type !== 'CONTENT_VOTED' && !['CONTENT_MODERATION_REJECTED', 'CONTENT_MODERATION_APPROVED'].includes(notification.type) && <span className={`notification-item__interaction-icon ${details.className}`} aria-hidden="true"><Icon size={15}/></span>}
    </span>
    <span className="notification-item__body">
      <span className="notification-item__message">{notification.type === 'CONTENT_VOTED' ? <VoteNotificationMessage notification={notification}/> : notification.title ? <strong className={`notification-item__title${notification.type === 'CONTENT_MODERATION_REJECTED' ? ' is-rejected' : ''}`}>{notification.title}</strong> : null}{notification.type === 'CONTENT_VOTED' ? null : notificationCopy(notification)}</span>
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
  const { unreadCount, refreshUnreadCount, changeUnreadCount } = useNotificationUnreadCount();
  const [listState, setListState] = useState({ loading: false, loadingMore: false, error: '' });
  const [page, setPage] = useState({ current: 0, totalPages: 1, last: true });
  const [markingId, setMarkingId] = useState(null);
  const [unavailableNotification, setUnavailableNotification] = useState(null);
  const [popoverPosition, setPopoverPosition] = useState({ top: 12, left: 'auto', right: 12 });
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);
  const listController = useRef(null);
  const listRequest = useRef(0);
  const readMutationIds = useRef(new Set());
  const readOverrides = useRef(new Map());
  const markAllInFlight = useRef(false);

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

  useEffect(() => () => { listController.current?.abort(); }, []);

  useEffect(() => {
    if (!open && !unavailableNotification) return undefined;
    const handler = (event) => {
      if (event.key !== 'Escape') return;
      if (unavailableNotification) setUnavailableNotification(null);
      else setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, unavailableNotification]);

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
  };

  const handleSelect = async (notification) => {
    setOpen(false);
    const notificationId = notification.notificationId;
    if (!notification.read && !readMutationIds.current.has(notificationId)) {
      readMutationIds.current.add(notificationId);
      readOverrides.current.set(notificationId, true);
      setItems((current) => current.map((item) => item.notificationId === notification.notificationId ? { ...item, read: true } : item));
      changeUnreadCount((count) => Math.max(0, count - 1));
      setMarkingId(notificationId);
      try {
        await markNotificationAsRead(notificationId);
        await refreshUnreadCount({ force: true });
      } catch {
        readOverrides.current.delete(notificationId);
        setItems((current) => current.map((item) => item.notificationId === notificationId ? { ...item, read: false } : item));
        changeUnreadCount((count) => count + 1);
        refreshUnreadCount({ force: true });
      } finally {
        readMutationIds.current.delete(notificationId);
        setMarkingId(null);
      }
    }
    const isContentInteraction = ['CONTENT_VOTED', 'CONTENT_COMMENTED', 'CONTENT_COMMENT_REPLIED'].includes(notification.type);
    if (notification.referenceId && notification.referenceType === 'CONTENT' && isContentInteraction && !isAvailableContentNotification(notification)) {
      setUnavailableNotification(notification);
      return;
    }
    if (notification.referenceId && notification.referenceType === 'CONTENT' && ['BLOG', 'VIDEO'].includes(String(notification.contentType).toUpperCase())) {
      const contentType = String(notification.contentType).toLowerCase();
      navigate(`/community/posts/${notification.referenceId}`, { state: notification.type === 'CONTENT_MODERATION_REJECTED'
        ? { contentType, source: 'my-content', returnTo: pathname, moderationNotification: notification }
        : { contentType, returnTo: pathname } });
    }
  };

  const markAll = async () => {
    if (!unreadCount || markAllInFlight.current) return;
    markAllInFlight.current = true;
    try {
      await markAllNotificationsAsRead();
      setItems((current) => {
        current.forEach((item) => readOverrides.current.set(item.notificationId, true));
        return current.map((item) => ({ ...item, read: true }));
      });
      changeUnreadCount(0);
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
    {unavailableNotification && <div className="notification-unavailable-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setUnavailableNotification(null); }}>
      <section className="notification-unavailable-modal" role="dialog" aria-modal="true" aria-labelledby="notification-unavailable-title">
        <button type="button" className="notification-unavailable-modal__close" onClick={() => setUnavailableNotification(null)} aria-label="Close"><X size={17}/></button>
        <h2 id="notification-unavailable-title">This post is no longer available</h2>
        <p>This post may have been deleted or is no longer accessible.</p>
        <button type="button" className="notification-unavailable-modal__action" onClick={() => setUnavailableNotification(null)}>Close</button>
      </section>
    </div>}
  </>;

  return <>
    <button ref={triggerRef} type="button" className="community-icon-btn notification-trigger" onClick={showDrawer} aria-label={unreadCount ? `Open notifications, ${unreadCount} unread` : 'Open notifications'} aria-expanded={open} aria-controls="notification-popover">
      <Bell size={19}/>{unreadCount > 0 && <span className="notification-badge">{badge}</span>}
    </button>
    {typeof document !== 'undefined' ? createPortal(notificationOverlay, document.body) : null}
  </>;
}
