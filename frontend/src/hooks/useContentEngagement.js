import { useEffect, useRef } from 'react';
import { isAuthenticated } from '../utils/auth';
import { sendContentEngagement } from '../services/contentEngagementService';

const HEARTBEAT_MS = 15000;
const completionThreshold = 90;

export default function useContentEngagement({ contentId, enabled = true } = {}) {
  const state = useRef({ activeSince: null, dwell: 0, maxScroll: 0, inFlight: false, queued: null, finalized: false });

  useEffect(() => {
    if (!contentId || !enabled || !isAuthenticated()) return undefined;
    const current = state.current = { activeSince: document.visibilityState === 'visible' ? performance.now() : null, dwell: 0, maxScroll: 0, inFlight: false, queued: null, finalized: false };
    const addActiveTime = () => {
      if (current.activeSince == null) return;
      current.dwell += Math.max(0, Math.floor((performance.now() - current.activeSince) / 1000));
      current.activeSince = performance.now();
    };
    const measureScroll = () => {
      const root = document.documentElement;
      const denominator = Math.max(1, root.scrollHeight - window.innerHeight);
      current.maxScroll = Math.max(current.maxScroll, Math.min(100, (window.scrollY / denominator) * 100));
    };
    const transmit = (finalize = false) => {
      if (current.finalized && !finalize) return;
      addActiveTime(); measureScroll();
      const payload = { dwellTimeSec: current.dwell, maxScrollPct: Number(current.maxScroll.toFixed(2)), completed: current.maxScroll >= completionThreshold, finalize };
      if (current.inFlight) { current.queued = { payload, finalize }; return; }
      current.inFlight = true;
      sendContentEngagement(contentId, payload, { keepalive: finalize }).catch(() => {}).finally(() => {
        current.inFlight = false;
        if (current.queued) { const next = current.queued; current.queued = null; transmit(next.finalize); }
      });
      if (finalize) current.finalized = true;
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') { addActiveTime(); transmit(false); current.activeSince = null; }
      else if (current.activeSince == null && !current.finalized) current.activeSince = performance.now();
    };
    const onPageHide = () => transmit(true);
    const interval = window.setInterval(() => transmit(false), HEARTBEAT_MS);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('scroll', measureScroll, { passive: true });
    window.addEventListener('pagehide', onPageHide);
    measureScroll();
    return () => { window.clearInterval(interval); document.removeEventListener('visibilitychange', onVisibility); window.removeEventListener('scroll', measureScroll); window.removeEventListener('pagehide', onPageHide); transmit(true); };
  }, [contentId, enabled]);
}
