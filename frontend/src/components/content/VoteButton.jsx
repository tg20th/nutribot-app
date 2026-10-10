import { useEffect, useState } from 'react';
import { Heart, ThumbsUp } from 'lucide-react';
import { getContentVote, toggleContentVote } from '../../services/contentInteractionApi';
import '../../styles/content-interactions.css';

export default function VoteButton({ contentId, compact = false, icon = 'heart', onVoteChange, loadVote = getContentVote, submitVote = toggleContentVote }) {
  const [vote, setVote] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setVote(null);
    setError('');
    loadVote(contentId, controller.signal).then((data) => {
      if (!controller.signal.aborted) setVote(data);
    }).catch(() => {
      if (!controller.signal.aborted) setError('Could not load likes.');
    });
    return () => controller.abort();
  }, [contentId, retry, loadVote]);

  async function toggle() {
    if (busy || !vote) return;
    setBusy(true);
    setError('');
    try {
      const next = await submitVote(contentId);
      setVote(next);
      onVoteChange?.(next);
    } catch (failure) {
      setError(failure.message || 'Could not update like.');
    } finally {
      setBusy(false);
    }
  }

  const Icon = icon === 'thumb' ? ThumbsUp : Heart;

  return <span className={`content-vote${compact ? ' content-vote--compact' : ''}`}>
    <button type="button" className={vote?.isVoted ? 'is-liked' : ''} aria-pressed={!!vote?.isVoted}
      aria-label={`${vote?.isVoted ? 'Unlike' : 'Like'} this post, ${vote?.voteCount ?? 0} likes`}
      disabled={!vote || busy} onClick={toggle}>
      <Icon size={18} fill={vote?.isVoted ? 'currentColor' : 'none'}/>
      {compact ? vote?.voteCount ?? '…' : `${vote?.isVoted ? 'Liked' : 'Like'} · ${vote?.voteCount ?? '…'}`}
    </button>
    {error && <span className="content-vote-error" role="alert">{error} {!vote && <button type="button" onClick={() => setRetry((value) => value + 1)}>Retry</button>}</span>}
  </span>;
}
