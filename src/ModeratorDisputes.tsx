import { useEffect, useRef, useState } from 'react';
import { useLocale } from './locales';
import type { MessageKey } from './locales/en';
import { HistoryError, historyRequest, validConversation, type ModeratorConversation } from './match-history-api';
import { MatchConversation } from './MatchConversation';
import './MatchHistory.css';

export function ModeratorDisputes({ matchId, version, onDenied }: { matchId: string; version: number; onDenied: () => void }) {
  const { t } = useLocale();
  const [rows, setRows] = useState<ModeratorConversation[] | null>(null);
  const [error, setError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  useEffect(() => {
    let disposed = false; const controller = new AbortController(); setError(false);
    void (async () => {
      try {
        const result = await historyRequest(`/api/v1/moderation/matches/${matchId}/disputes`, controller.signal);
        if (disposed) return;
        if (!Array.isArray(result) || result.length > 40 || !result.every(r => r && typeof r.id === 'string' && typeof r.playerName === 'string' && r.playerName.length <= 512 && validConversation(r.thread) && r.id === r.thread.id)) throw Error();
        setRows(result);
      } catch (failure) { if (disposed) return; if (failure instanceof HistoryError && [401, 403].includes(failure.status)) onDenied(); else setError(true); }
    })();
    return () => { disposed = true; controller.abort(); };
  }, [matchId, version, refresh, onDenied]);
  return <section className="moderation-disputes"><h3>{t('historyParticipantDisputes')}</h3>
    {error && <div role="alert"><p>{t('historyDetailsError')}</p><button onClick={() => setRefresh(v => v + 1)}>{t('historyRetry')}</button></div>}
    {!rows && !error && <p role="status">{t('historyLoading')}</p>}
    {rows?.length === 0 && <p>{t('historyNoParticipantDisputes')}</p>}
    {rows?.map(row => <ModeratorThread key={row.id} row={row} matchId={matchId} onDenied={onDenied}
      draft={drafts[row.id] ?? ''} setDraft={value => setDrafts(current => ({ ...current, [row.id]: value }))}
      onUpdated={thread => setRows(current => current?.map(r => r.id === row.id ? { ...r, thread } : r) ?? null)}
      onRefresh={() => setRefresh(v => v + 1)} />)}
  </section>;
}

function ModeratorThread({ row, matchId, onDenied, draft, setDraft, onUpdated, onRefresh }: { row: ModeratorConversation; matchId: string;
  onDenied: () => void; draft: string; setDraft: (value: string) => void; onUpdated: (thread: ModeratorConversation['thread']) => void; onRefresh: () => void }) {
  const { t } = useLocale();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const [stale, setStale] = useState(false);
  const [saved, setSaved] = useState(false);
  const active = useRef<AbortController | null>(null);
  useEffect(() => { setStale(false); }, [row.thread.version]);
  useEffect(() => () => { active.current?.abort(); active.current = null; }, []);
  async function submit() {
    if (!draft.trim() || draft.length > 2000 || active.current || stale) return;
    const controller = new AbortController(); active.current = controller; setBusy(true); setError(null); setSaved(false);
    try {
      const result = await historyRequest(`/api/v1/moderation/matches/${matchId}/disputes/${row.id}/requests`, controller.signal,
        { expectedVersion: row.thread.version, message: draft.trim() });
      if (active.current !== controller) return;
      if (!validConversation(result) || result.id !== row.id) throw Error();
      onUpdated(result); setDraft(''); setSaved(true);
    } catch (failure) {
      if (active.current !== controller) return;
      if (failure instanceof HistoryError && [401, 403].includes(failure.status)) { onDenied(); return; }
      setStale(true); setError(failure instanceof HistoryError && failure.status === 409 ? 'historyChanged' : failure instanceof HistoryError && failure.status === 429 ? 'historyRateLimited' : 'historyUnconfirmed');
    } finally { if (active.current === controller) { active.current = null; setBusy(false); } }
  }
  return <article className="mh-panel"><h4>{row.playerName}</h4><MatchConversation thread={row.thread} moderator />
    {row.thread.status !== 'RESOLVED' && <form className="mh-compose" onSubmit={e => { e.preventDefault(); void submit(); }}><label htmlFor={`request-${row.id}`}>{t('historyRequestEvidence')}</label><p className="mh-muted">{t('historyRequestHelp')}</p>
      <textarea id={`request-${row.id}`} required maxLength={2000} rows={3} value={draft} disabled={busy} onChange={e => setDraft(e.target.value)} />
      <div className="mh-compose-actions"><span>{draft.length}/2000</span><button disabled={!draft.trim() || busy || stale} type="submit">{t(busy ? 'historySending' : 'historySendRequest')}</button></div></form>}
    {saved && <p role="status">{t('historyRequestSent')}</p>}
    {error && <div role="alert"><p>{t(error)}</p>{stale && <button disabled={busy} onClick={onRefresh}>{t('historyRefreshMatch')}</button>}</div>}
  </article>;
}
