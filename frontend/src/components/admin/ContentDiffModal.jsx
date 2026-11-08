import React, { useMemo } from 'react';
import { BookOpen, Check, ShieldAlert, X } from 'lucide-react';

/** Keep the existing sentence comparison and matching rules intact. */
function splitIntoSentences(htmlOrText) {
  if (!htmlOrText) return [];
  const plain = htmlOrText.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!plain) return [];
  const rawSentences = plain.split(/(?<=[.!?])\s+|\n+/);
  return rawSentences.map((sentence) => sentence.trim()).filter((sentence) => sentence.length > 0);
}

function normalizeForComparison(sentence) {
  return sentence.toLowerCase().replace(/[^\p{L}\p{Nd}\s]/gu, '').replace(/\s+/g, ' ').trim();
}

function ComparisonMeta({ author, date, label }) {
  return <div className="content-diff-meta">
    {author && <span>{author}</span>}
    {date && <time dateTime={date}>{label} {new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</time>}
  </div>;
}

export default function ContentDiffModal({ isOpen, onClose, currentPost, onApprove, onReject, submitting = false }) {
  if (!isOpen || !currentPost) return null;

  const currentSentences = useMemo(() => splitIntoSentences(currentPost.body), [currentPost?.body]);
  const matchedSentences = useMemo(() => splitIntoSentences(currentPost.matchedBody), [currentPost?.matchedBody]);
  const matchedSet = useMemo(() => {
    const set = new Set();
    matchedSentences.forEach((sentence) => {
      const norm = normalizeForComparison(sentence);
      if (norm.length > 5) set.add(norm);
    });
    return set;
  }, [matchedSentences]);
  const currentSet = useMemo(() => {
    const set = new Set();
    currentSentences.forEach((sentence) => {
      const norm = normalizeForComparison(sentence);
      if (norm.length > 5) set.add(norm);
    });
    return set;
  }, [currentSentences]);

  const similarityPct = currentPost.similarityScore != null
    ? Math.round(Number(currentPost.similarityScore) * 100)
    : null;
  const rejectReason = [
    'Duplicate content',
    currentPost.matchedTitle ? `with “${currentPost.matchedTitle}”` : null,
    similarityPct != null ? `(${similarityPct}% similarity)` : null,
  ].filter(Boolean).join(' ');

  const renderSentences = (sentences, otherSet) => sentences.length === 0
    ? <p className="content-diff-empty">No comparison text is available.</p>
    : sentences.map((sentence, index) => {
      const isMatch = otherSet.has(normalizeForComparison(sentence));
      return <span key={`${index}-${sentence}`} className={isMatch ? 'content-diff-sentence is-match' : 'content-diff-sentence'}>{sentence}{' '}</span>;
    });

  return <div className="content-diff-backdrop" role="dialog" aria-modal="true" aria-labelledby="diff-modal-title">
    <section className="content-diff-modal">
      <header className="content-diff-header">
        <div>
          <p className="content-diff-eyebrow">Content review</p>
          <h2 id="diff-modal-title">Content comparison</h2>
          <p>Review the original article and the flagged submission.</p>
        </div>
        <div className="content-diff-header-actions">
          <button type="button" className="content-diff-close" onClick={onClose} aria-label="Close comparison" title="Close"><X size={19} /></button>
        </div>
      </header>
      <div className="content-diff-legend" aria-label="Comparison legend">
        <span className="content-diff-highlight-note"><i className="content-diff-swatch is-match" aria-hidden="true" />Yellow highlights indicate matching passages.</span>
        {similarityPct != null && <span className="content-diff-similarity" aria-label={`Text similarity ${similarityPct}%`}><span>Text similarity</span><strong>{similarityPct}%</strong></span>}
      </div>
      <div className="content-diff-columns">
        <article className="content-diff-column">
          <div className="content-diff-column-heading">
            <span className="content-diff-label"><BookOpen size={14} aria-hidden="true" /> ORIGINAL ARTICLE</span>
            <h3>{currentPost.matchedTitle || 'Published article'}</h3>
            <ComparisonMeta author={currentPost.matchedAuthor} date={currentPost.matchedPublishedAt} label="Published" />
          </div>
          <div className="content-diff-body">{renderSentences(matchedSentences, currentSet)}</div>
        </article>
        <article className="content-diff-column">
          <div className="content-diff-column-heading">
            <span className="content-diff-label is-flagged"><ShieldAlert size={14} aria-hidden="true" /> FLAGGED FOR POSSIBLE PLAGIARISM</span>
            <h3>{currentPost.title || 'Submitted article'}</h3>
            <ComparisonMeta author={currentPost.authorName || currentPost.author || currentPost.authorUsername} date={currentPost.submittedAt} label="Submitted" />
          </div>
          <div className="content-diff-body">{renderSentences(currentSentences, matchedSet)}</div>
        </article>
      </div>
      <footer className="content-diff-footer">
        <div className="content-diff-decision-actions">
          <button type="button" className="admin-btn danger" disabled={submitting} onClick={() => onReject(currentPost, rejectReason)}><X size={15} /> Reject for Plagiarism</button>
          <button type="button" className="admin-btn primary" disabled={submitting} onClick={() => onApprove(currentPost)}><Check size={15} /> Override &amp; Approve</button>
        </div>
      </footer>
    </section>
  </div>;
}
