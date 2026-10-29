import { useEffect, useRef, useState } from 'react';

/** SSE carries invalidations; authenticated HTTP snapshots remain authoritative. */
export function useLobbyEvents(accountId: string, enabled: boolean, onChange: () => void) {
  const [connected, setConnected] = useState(false);
  const change = useRef(onChange); change.current = onChange;
  useEffect(() => {
    let source: EventSource | null = null;
    let watchdog: number | null = null;
    let disposed = false;
    let lastSignal = Date.now();
    const close = () => {
      source?.close(); source = null;
      if (watchdog !== null) window.clearInterval(watchdog);
      watchdog = null; if (!disposed) setConnected(false);
    };
    const open = () => {
      if (disposed || !enabled || document.hidden || source || typeof EventSource === 'undefined') return;
      const current = new EventSource('/api/v1/me/group-events');
      source = current; lastSignal = Date.now();
      const live = () => !disposed && source === current;
      current.addEventListener('ready', () => {
        if (!live()) return;
        lastSignal = Date.now(); setConnected(true); change.current();
      });
      current.addEventListener('changed', () => { if (live()) { lastSignal = Date.now(); change.current(); } });
      current.addEventListener('ping', () => { if (live()) lastSignal = Date.now(); });
      current.addEventListener('error', () => { if (live()) setConnected(false); });
      watchdog = window.setInterval(() => {
        if (Date.now() - lastSignal > 45000) { close(); open(); }
      }, 15000);
    };
    const visibility = () => { if (document.hidden) close(); else open(); };
    setConnected(false); open();
    document.addEventListener('visibilitychange', visibility);
    return () => { disposed = true; close(); document.removeEventListener('visibilitychange', visibility); };
  }, [accountId, enabled]);
  return connected;
}
