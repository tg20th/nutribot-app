import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  Check,
  ChevronRight,
  Clock3,
  ExternalLink,
  Eye,
  FileText,
  LoaderCircle,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import ChatbotWidget from '../components/chatbot/ChatbotWidget';
import CommunitySideNav from '../components/community/CommunitySideNav';
import CommunityTopBar from '../components/community/CommunityTopBar';
import { recipeConsentRequestsApi } from '../services/recipeConsentRequestsApi';
import '../styles/recipe-consent-requests.css';

const statusCopy = {
  PENDING: 'Needs your response',
  APPROVED_BY_USER: 'You allowed use',
  REJECTED_BY_USER: 'You declined',
  CANCELLED: 'Cancelled',
  EXPIRED: 'Expired',
};

const readableDate = (value) => {
  const date = new Date(value);
  return value && !Number.isNaN(date.getTime())
    ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
    : 'Date unavailable';
};

const isExpired = (request) => request.status === 'EXPIRED'
  || (request.status === 'PENDING' && request.expiresAt && new Date(request.expiresAt).getTime() <= Date.now());

const displayStatus = (request) => (isExpired(request) ? 'EXPIRED' : request.status);

function StatusBadge({ request }) {
  const status = displayStatus(request);
  return <span className={`consent-status is-${status.toLowerCase()}`}>{statusCopy[status] ?? status}</span>;
}

function RequestRow({ request, active, onSelect }) {
  const type = request.post.contentType === 'VIDEO' ? 'VIDEO POST' : 'BLOG POST';

  return (
    <button type="button" className={active ? 'is-active' : ''} onClick={onSelect}>
      <span className="consent-list-icon"><FileText size={17} /></span>
      <span className="consent-list-copy">
        <small>{type}</small>
        <b>{request.post.title}</b>
        <em>{request.post.recipeName}</em>
        <StatusBadge request={request} />
      </span>
      <ChevronRight className="consent-row-arrow" size={16} />
    </button>
  );
}

function LoadingState() {
  return (
    <section className="consent-loading" aria-label="Loading recipe requests">
      <LoaderCircle size={22} />
      <span>Checking your requests</span>
    </section>
  );
}

export default function RecipeConsentRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogAction, setDialogAction] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');

    recipeConsentRequestsApi.listMine(controller.signal)
      .then((items) => {
        if (controller.signal.aborted) return;
        setRequests(items);
        setSelectedId((current) => (
          items.some((item) => item.requestId === current) ? current : items[0]?.requestId ?? null
        ));
      })
      .catch((requestError) => {
        if (!controller.signal.aborted) {
          setError(requestError?.message || 'We could not load your recipe-use requests.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [reloadKey]);

  const selected = useMemo(
    () => requests.find((request) => request.requestId === selectedId) ?? null,
    [requests, selectedId],
  );

  const pendingCount = requests.filter((request) => displayStatus(request) === 'PENDING').length;

  const submitResponse = async () => {
    if (!selected || !dialogAction || submitting || displayStatus(selected) !== 'PENDING') return;

    setSubmitting(true);
    try {
      const updated = await recipeConsentRequestsApi.respond(selected.requestId, dialogAction);
      setRequests((current) => current.map((request) => (
        request.requestId === updated.requestId ? updated : request
      )));
      setNotice(dialogAction === 'ACCEPT'
        ? 'Your approval has been recorded. The recipe now waits for final review.'
        : 'You declined this recipe-use request.');
      setDialogAction(null);
    } catch (requestError) {
      setDialogAction(null);
      setNotice(requestError?.message || 'This request could not be updated. Refresh and try again.');
      setReloadKey((key) => key + 1);
    } finally {
      setSubmitting(false);
    }
  };

  const retry = () => setReloadKey((key) => key + 1);

  return (
    <div className="community-page consent-page">
      <CommunityTopBar hideSearch activePath="/community/recipe-consent-requests" />
      <div className="community-shell">
        <CommunitySideNav activePath="/community/recipe-consent-requests" />

        <main className="consent-main">
          <Link className="consent-back" to="/community/my-blogs">
            <ArrowLeft size={16} />
            My content
          </Link>

          <header className="consent-hero">
            <div>
              <p>COMMUNITY RECIPE CONTRIBUTION</p>
              <h1>Recipe consent</h1>
              <span>Decide whether a recipe in your post may move forward for the NutriBot community collection.</span>
            </div>
            <div className="consent-counter" aria-label={`${pendingCount} requests awaiting you`}>
              <Clock3 size={21} />
              <strong>{pendingCount}</strong>
              <span>awaiting you</span>
            </div>
          </header>

          <section className="consent-principle">
            <ShieldCheck size={20} />
            <p><b>You stay in control.</b> A recipe is never imported automatically. Your confirmation only sends it to an administrator for final review.</p>
          </section>

          {notice && (
            <div className="consent-notice" role="status">
              <BadgeCheck size={18} />
              <span>{notice}</span>
              <button type="button" onClick={() => setNotice('')} aria-label="Dismiss notification"><X size={15} /></button>
            </div>
          )}

          {loading && <LoadingState />}

          {!loading && error && (
            <section className="consent-message consent-error">
              <AlertCircle size={26} />
              <p className="consent-kicker">CONNECTION UNAVAILABLE</p>
              <h2>We could not load your requests.</h2>
              <p>{error}</p>
              <button type="button" onClick={retry}>Try again</button>
            </section>
          )}

          {!loading && !error && !requests.length && (
            <section className="consent-message consent-empty">
              <FileText size={29} />
              <p className="consent-kicker">ALL CLEAR</p>
              <h2>No recipe requests yet</h2>
              <p>When the team identifies a recipe in one of your posts, its request will appear here for your decision.</p>
            </section>
          )}

          {!loading && !error && requests.length > 0 && (
            <div className="consent-workspace">
              <section className="consent-list" aria-label="Recipe-use requests">
                <div className="consent-list-heading">
                  <span>Your requests</span>
                  <b>{requests.length}</b>
                </div>
                {requests.map((request) => (
                  <RequestRow
                    key={request.requestId}
                    request={request}
                    active={selectedId === request.requestId}
                    onSelect={() => setSelectedId(request.requestId)}
                  />
                ))}
              </section>

              {selected && (
                <article className="consent-detail">
                  <header className="consent-detail-topbar">
                    <div>
                      <span>RECIPE-USE REQUEST</span>
                      <StatusBadge request={selected} />
                    </div>
                    <time>Requested {readableDate(selected.createdAt)}</time>
                  </header>

                  <div className="consent-post">
                    <div className="consent-post-art">
                      {selected.post.imageUrl ? <img src={selected.post.imageUrl} alt="" /> : <FileText size={27} />}
                    </div>
                    <section>
                      <small>{selected.post.contentType === 'VIDEO' ? 'VIDEO POST' : 'BLOG POST'}</small>
                      <h2>{selected.post.title}</h2>
                      <p>{selected.post.excerpt || 'This post contains a recipe that the community team would like to consider.'}</p>
                      {selected.post.contentId && (
                        <Link to={`/community/posts/${selected.post.contentId}`}>
                          <Eye size={15} /> View post <ExternalLink size={13} />
                        </Link>
                      )}
                    </section>
                  </div>

                  <section className="consent-recipe">
                    <span>RECIPE REQUESTED</span>
                    <h3>{selected.post.recipeName}</h3>
                    <p><UserRound size={15} /> Requested by {selected.requesterName}</p>
                  </section>

                  {displayStatus(selected) === 'PENDING' ? (
                    <footer className="consent-actions">
                      <div>
                        <b>Your approval is required</b>
                        <span>No automatic import. An administrator makes the final collection decision.</span>
                        {selected.expiresAt && <small>Response deadline: {readableDate(selected.expiresAt)}</small>}
                      </div>
                      <div>
                        <button type="button" className="consent-reject" disabled={submitting} onClick={() => setDialogAction('REJECT')}>Decline</button>
                        <button type="button" className="consent-accept" disabled={submitting} onClick={() => setDialogAction('ACCEPT')}>
                          <Check size={16} /> Allow use
                        </button>
                      </div>
                    </footer>
                  ) : (
                    <section className="consent-resolved">
                      <Clock3 size={19} />
                      <div>
                        <b>{statusCopy[displayStatus(selected)]}</b>
                        <span>{displayStatus(selected) === 'EXPIRED'
                          ? 'This request can no longer be answered.'
                          : `Response recorded ${readableDate(selected.respondedAt)}.`}
                        </span>
                      </div>
                    </section>
                  )}
                </article>
              )}
            </div>
          )}
        </main>
      </div>

      <ChatbotWidget />

      {dialogAction && selected && (
        <div className="consent-dialog-backdrop" onMouseDown={() => !submitting && setDialogAction(null)}>
          <section
            className="consent-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="consent-dialog-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <p>PLEASE CONFIRM</p>
            <h2 id="consent-dialog-title">
              {dialogAction === 'ACCEPT' ? 'Allow this recipe to be used?' : 'Decline this recipe-use request?'}
            </h2>
            <span>
              {dialogAction === 'ACCEPT'
                ? `NutriBot may send “${selected.post.recipeName}” for final administrator review. It will not be imported automatically.`
                : 'This recipe will not be sent for collection review from this request.'}
            </span>
            <div>
              <button type="button" disabled={submitting} onClick={() => setDialogAction(null)}>Cancel</button>
              <button
                type="button"
                disabled={submitting}
                className={dialogAction === 'ACCEPT' ? 'consent-accept' : 'consent-reject'}
                onClick={submitResponse}
              >
                {submitting ? 'Saving...' : dialogAction === 'ACCEPT' ? 'Allow use' : 'Decline request'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
