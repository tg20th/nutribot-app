import { apiRequest, unwrapData } from './apiClient';
import { getPublishedBlog } from './publicBlogApi';
import { normalizePost } from './communityApi';

const toId = (item) => item?.contentId ?? item?.id;

function unavailableContentError() {
  const error = new Error('Related content is no longer available.');
  error.status = 404;
  return error;
}

async function resolvePublicVideo(contentId, signal) {
  const data = unwrapData(await apiRequest(`/api/v1/videos/id/${encodeURIComponent(contentId)}`, { signal }), {});
  if (toId(data) == null || !data.title || String(toId(data)) !== String(contentId)) throw unavailableContentError();
  return { ...normalizePost(data, 'VIDEO'), contentType: 'VIDEO' };
}

async function resolvePublicContent(contentId, contentType, signal) {
  if (String(contentType).toUpperCase() === 'VIDEO') return resolvePublicVideo(contentId, signal);
  const blog = await getPublishedBlog(contentId, { byId: true, signal });
  if (String(toId(blog)) !== String(contentId)) throw unavailableContentError();
  return { ...blog, id: toId(blog), contentType: 'BLOG', type: 'blog' };
}

/**
 * NB-58 deliberately treats the related endpoint as an ID-only recommendation.
 * Every ID is resolved again through the public detail API, so a stale, deleted,
 * draft, or rejected record is never rendered as a recommendation card.
 */
export async function getResolvedRelatedContent(contentId, contentType, signal) {
  const payload = unwrapData(await apiRequest(`/api/v1/contents/${encodeURIComponent(contentId)}/related?limit=6`, { signal }), []);
  if (!Array.isArray(payload)) throw new Error('Invalid related-content response');

  const ids = [...new Set(payload.map(toId).filter((id) => id != null && String(id) !== String(contentId)))];
  const resolved = await Promise.allSettled(ids.map((id) => resolvePublicContent(id, contentType, signal)));
  return resolved
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value);
}
