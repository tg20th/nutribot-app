const CACHE_TTL_MS = 30 * 60 * 1000;
const MAX_SNAPSHOTS = 8;

const memoryCache = new Map();
const activeSnapshotKeys = new Map();
let pageLoadPrepared = false;
let pageLoadWasReload = false;

function cacheIdentity() {
  try {
    const token = localStorage.getItem('nutribot-auth-token');
    if (!token) return 'guest';
    const encodedPayload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(encodedPayload.padEnd(Math.ceil(encodedPayload.length / 4) * 4, '=')));
    return String(payload.userId ?? payload.id ?? payload.sub ?? payload.username ?? 'authenticated');
  } catch {
    return localStorage.getItem('nutribot-auth-token') ? 'authenticated' : 'guest';
  }
}

function browserNavigationType() {
  try {
    const entry = performance.getEntriesByType('navigation')[0];
    if (entry?.type) return entry.type;
    return performance.navigation?.type === 1 ? 'reload' : 'navigate';
  } catch {
    return 'navigate';
  }
}

/**
 * Must run before the Feed reads its snapshot. Internal React Router
 * navigation reports `navigate`/`back_forward`; a real F5/Ctrl+R reports
 * `reload`, which starts a genuinely fresh Feed session.
 */
export function prepareFeedCacheForPageLoad() {
  if (pageLoadPrepared) return pageLoadWasReload;
  pageLoadPrepared = true;
  pageLoadWasReload = browserNavigationType() === 'reload';
  if (pageLoadWasReload) clearFeedSnapshots();
  return pageLoadWasReload;
}

function isFresh(snapshot) {
  return snapshot && Date.now() - snapshot.savedAt < CACHE_TTL_MS;
}

export const feedSnapshotKey = (feed, filter = 'All', search = '', sort = '') =>
  `${cacheIdentity()}:${feed}:${filter}:${search}:${sort}`;

export function getFeedSnapshot(key) {
  const inMemory = memoryCache.get(key);
  if (isFresh(inMemory)) return inMemory;
  if (inMemory) memoryCache.delete(key);

  return null;
}

function activeFeedKey(feed) {
  return `${cacheIdentity()}:${feed}`;
}

export function getActiveFeedSnapshot(feed) {
  const key = activeSnapshotKeys.get(activeFeedKey(feed));
  return key ? getFeedSnapshot(key) : null;
}

export function saveFeedSnapshot(key, snapshot) {
  const next = {
    ...snapshot,
    posts: Array.isArray(snapshot.posts) ? [...snapshot.posts] : [],
    savedAt: Date.now()
  };
  memoryCache.set(key, next);
  while (memoryCache.size > MAX_SNAPSHOTS) {
    const oldestKey = [...memoryCache.entries()]
      .sort(([, left], [, right]) => left.savedAt - right.savedAt)[0]?.[0];
    if (!oldestKey) break;
    memoryCache.delete(oldestKey);
  }
  return next;
}

export function saveActiveFeedSnapshot(feed, key, snapshot) {
  activeSnapshotKeys.set(activeFeedKey(feed), key);
  return saveFeedSnapshot(key, snapshot);
}

export function updateCachedFeedPost(postId, patch) {
  for (const [key, snapshot] of memoryCache.entries()) {
    if (!isFresh(snapshot) || !Array.isArray(snapshot.posts)) continue;
    let changed = false;
    const posts = snapshot.posts.map((post) => {
      if (String(post.id ?? post.contentId) !== String(postId)) return post;
      changed = true;
      return { ...post, ...patch };
    });
    if (changed) {
      const next = { ...snapshot, posts, savedAt: Date.now() };
      memoryCache.set(key, next);
    }
  }
}

export function removeCachedFeedPost(postId) {
  for (const [key, snapshot] of memoryCache.entries()) {
    if (!isFresh(snapshot) || !Array.isArray(snapshot.posts)) continue;
    const posts = snapshot.posts.filter((post) => String(post.id ?? post.contentId) !== String(postId));
    if (posts.length !== snapshot.posts.length) {
      const next = { ...snapshot, posts, savedAt: Date.now() };
      memoryCache.set(key, next);
    }
  }
}

export function clearFeedSnapshots() {
  memoryCache.clear();
  activeSnapshotKeys.clear();
}

export function refreshFeedSnapshot(key) {
  memoryCache.delete(key);
  for (const [feed, activeKey] of activeSnapshotKeys.entries()) {
    if (activeKey === key) activeSnapshotKeys.delete(feed);
  }
}

export function getFeedScrollContainer(root) {
  let element = root;
  while (element && element !== document.body) {
    const style = window.getComputedStyle(element);
    if (/(auto|scroll|overlay)/.test(`${style.overflowY} ${style.overflow}`)) return element;
    element = element.parentElement;
  }
  return document.scrollingElement || document.documentElement;
}

function scrollTopOf(container) {
  return container === document.scrollingElement || container === document.documentElement
    ? window.scrollY
    : container.scrollTop;
}

export function captureFeedAnchor(postId, root) {
  const container = getFeedScrollContainer(root);
  const elements = Array.from((root || document).querySelectorAll('[data-feed-post-id]'));
  const element = postId == null
    ? elements.find((candidate) => candidate.getBoundingClientRect().bottom > 0) ?? elements.at(-1)
    : elements.find((candidate) => candidate.dataset.feedPostId === String(postId));
  return {
    postId: element?.dataset.feedPostId ?? (postId == null ? null : String(postId)),
    scrollTop: scrollTopOf(container),
    anchorTop: element ? element.getBoundingClientRect().top : null
  };
}

export function restoreFeedAnchor(anchor, root) {
  const container = getFeedScrollContainer(root);
  const elements = Array.from((root || document).querySelectorAll('[data-feed-post-id]'));
  const target = anchor?.postId
    ? elements.find((element) => element.dataset.feedPostId === String(anchor.postId))
    : null;
  const currentTop = scrollTopOf(container);
  const nextTop = target && anchor.anchorTop != null
    ? Math.max(0, currentTop + target.getBoundingClientRect().top - anchor.anchorTop)
    : Math.max(0, anchor?.scrollTop ?? 0);
  if (container === document.scrollingElement || container === document.documentElement) {
    window.scrollTo({ top: nextTop, left: 0, behavior: 'auto' });
  } else {
    container.scrollTop = nextTop;
  }
}
