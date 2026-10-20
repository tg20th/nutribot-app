import { AlertCircle, ArrowLeft, Check, Clock3, ExternalLink, Eye, FileText, UserRound, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import ChatbotWidget from '../components/chatbot/ChatbotWidget';
import CommunitySideNav from '../components/community/CommunitySideNav';
import CommunityTopBar from '../components/community/CommunityTopBar';
import { recipeConsentRequestsApi } from '../services/recipeConsentRequestsApi';
import '../styles/recipe-consent-requests.css';

const labels = { PENDING: 'Awaiting your decision', APPROVED_BY_USER: 'Accepted', REJECTED_BY_USER: 'Rejected', CANCELLED: 'Cancelled', EXPIRED: 'Expired' };
const readableDate = (value) => {
  const date = new Date(value);
  return value && !Number.isNaN(date.getTime()) ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(date) : 'Date unavailable';
};
const isExpired = (request) => request.status === 'EXPIRED' || (request.status === 'PENDING' && request.expiresAt && new Date(request.expiresAt).getTime() <= Date.now());
const displayStatus = (request) => isExpired(request) ? 'EXPIRED' : request.status;

function RequestStatus({ request }) {
  const status = displayStatus(request);
  return <span className={`consent-status is-${status.toLowerCase()}`}>{labels[status] ?? status}</span>;
}

export default function RecipeConsentRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState(null);
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
        setSelectedId((current) => items.some((item) => item.requestId === current) ? current : items[0]?.requestId ?? null);
      })
      .catch((requestError) => { if (!controller.signal.aborted) setError(requestError?.message || 'We could not load your recipe-use requests.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [reloadKey]);

  const selected = useMemo(() => requests.find((request) => request.requestId === selectedId) ?? null, [requests, selectedId]);
  const submitResponse = async () => {
    if (!selected || !dialog || submitting) return;
    setSubmitting(true);
    try {
      const updated = await recipeConsentRequestsApi.respond(selected.requestId, dialog);
      setRequests((current) => current.map((request) => request.requestId === updated.requestId ? updated : request));
      setNotice(dialog === 'ACCEPT' ? 'You accepted the use of this recipe.' : 'You declined the use of this recipe.');
      setDialog(null);
    } catch (requestError) {
      setDialog(null);
      setNotice(requestError?.message || 'This request could not be updated. Refresh and try again.');
      setReloadKey((key) => key + 1);
    } finally { setSubmitting(false); }
  };

  return <div className="community-page consent-page"><CommunityTopBar hideSearch activePath="/community/recipe-consent-requests" /><CommunitySideNav activePath="/community/recipe-consent-requests" />
    <main className="consent-main">
      <Link className="consent-back" to="/community/my-blogs"><ArrowLeft size={16}/> My content</Link>
      <header className="consent-hero"><div><p>COMMUNITY RECIPE CONTRIBUTION</p><h1>Recipe-use requests</h1><span>Choose whether NutriBot may consider a recipe in one of your posts for the community recipe collection.</span></div><div><Clock3 size={20}/><b>{requests.filter((request) => displayStatus(request) === 'PENDING').length}</b><span>awaiting you</span></div></header>
      {notice && <div className="consent-notice" role="status"><Check size={17}/><span>{notice}</span><button type="button" onClick={() => setNotice('')} aria-label="Dismiss notification"><X size={15}/></button></div>}
      {loading ? <div className="consent-state"><i/><i/><i/></div>
        : error ? <section className="consent-error"><AlertCircle size={25}/><h2>We could not load your requests.</h2><p>{error}</p><button type="button" onClick={() => setReloadKey((key) => key + 1)}>Try again</button></section>
          : !requests.length ? <section className="consent-empty"><FileText size={28}/><h2>No recipe-use requests yet</h2><p>If a recipe from one of your posts is eligible, you will see the request here before anything is added to the collection.</p></section>
            : <div className="consent-workspace"><section className="consent-list" aria-label="Recipe-use requests">{requests.map((request) => <button type="button" key={request.requestId} className={selectedId === request.requestId ? 'is-active' : ''} onClick={() => setSelectedId(request.requestId)}><span className="consent-list-icon"><FileText size={17}/></span><span><small>{request.post.contentType === 'VIDEO' ? 'VIDEO POST' : 'BLOG POST'}</small><b>{request.post.title}</b><em>{request.post.recipeName}</em><RequestStatus request={request}/></span></button>)}</section>
              {selected && <article className="consent-detail"><header><div><span>RECIPE-USE REQUEST</span><RequestStatus request={selected}/></div><time>Requested {readableDate(selected.createdAt)}</time></header><div className="consent-post"><div>{selected.post.imageUrl ? <img src={selected.post.imageUrl} alt=""/> : <FileText size={25}/>}</div><section><small>{selected.post.contentType === 'VIDEO' ? 'VIDEO POST' : 'BLOG POST'}</small><h2>{selected.post.title}</h2><p>{selected.post.excerpt || 'This post contains a recipe that the community team would like to consider.'}</p>{selected.post.contentId && <Link to={`/community/posts/${selected.post.contentId}`}><Eye size={15}/> View post <ExternalLink size={13}/></Link>}</section></div><section className="consent-recipe"><span>RECIPE REQUESTED</span><h3>{selected.post.recipeName}</h3><p><UserRound size={15}/> Requested by {selected.requesterName}</p></section>{displayStatus(selected) === 'PENDING' && <footer><div><b>Your approval is required</b><span>Nothing is imported automatically. You can change the recipe's availability only by confirming below.</span>{selected.expiresAt && <small>Expires {readableDate(selected.expiresAt)}</small>}</div><div><button type="button" className="consent-reject" disabled={submitting} onClick={() => setDialog('REJECT')}>Decline</button><button type="button" className="consent-accept" disabled={submitting} onClick={() => setDialog('ACCEPT')}><Check size={16}/> Allow use</button></div></footer>}{displayStatus(selected) !== 'PENDING' && <section className="consent-resolved"><Clock3 size={18}/><div><b>{labels[displayStatus(selected)]}</b><span>{displayStatus(selected) === 'EXPIRED' ? 'This request can no longer be answered.' : `Responded ${readableDate(selected.respondedAt)}.`}</span></div></section>}</article>}</div>}
    </main><ChatbotWidget />
    {dialog && selected && <div className="consent-dialog-backdrop" onMouseDown={() => !submitting && setDialog(null)}><section className="consent-dialog" role="dialog" aria-modal="true" aria-labelledby="consent-dialog-title" onMouseDown={(event) => event.stopPropagation()}><p>PLEASE CONFIRM</p><h2 id="consent-dialog-title">{dialog === 'ACCEPT' ? 'Allow this recipe to be used?' : 'Decline this recipe-use request?'}</h2><span>{dialog === 'ACCEPT' ? `NutriBot may send “${selected.post.recipeName}” for the final administrator review. It will not be imported automatically.` : 'The recipe will not be sent for collection review from this request.'}</span><div><button type="button" disabled={submitting} onClick={() => setDialog(null)}>Cancel</button><button type="button" disabled={submitting} className={dialog === 'ACCEPT' ? 'consent-accept' : 'consent-reject'} onClick={submitResponse}>{submitting ? 'Saving…' : dialog === 'ACCEPT' ? 'Allow use' : 'Decline request'}</button></div></section></div>}
  </div>;
}
