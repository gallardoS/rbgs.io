import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLocale } from './locales';
import { languageLocales, localizedPath } from './locale-routing';
import { Link } from './LocalizedLink';
import { BattleNetLoginButton } from './BattleNetLoginButton';
import type { MessageKey } from './locales/en';
import { MatchConversation } from './MatchConversation';
import { Notification } from './Notification';
import { HistoryError, historyRequest, validConversation, validDetail, validHistoryPage, type HistoryItem, type MatchDetail, type Outcome } from './match-history-api';
import './MatchHistory.css';

const outcomes: Record<Outcome, MessageKey> = { WIN: 'historyWin', LOSS: 'historyLoss', DRAW: 'historyDraw', PENDING: 'historyPending', REVIEW: 'historyReview', VOIDED: 'historyVoided', CANCELLED: 'historyCancelled' };

const mapArtwork = new Map([
  ['Darkspear Islands', 'darkspear-islands'],
  ['Warsong Gulch', 'warsong-gulch'],
  ['Arathi Basin', 'arathi-basin'],
]);
function FlagMark() {
  return <svg viewBox="0 0 40 40" width="40" height="40" fill="none" aria-hidden="true"><path d="M12 32V8m1 1c6-5 10 5 17 0v13c-7 5-11-5-17 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M8 33h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
}
function useDate() {
  const { language } = useLocale();
  return (value: string, short = false) => new Date(value).toLocaleString(languageLocales[language], { dateStyle: short ? 'medium' : 'long', timeStyle: 'short' });
}
function ResultBadge({ item }: { item: HistoryItem }) {
  const { t } = useLocale();
  return <span className={`mh-result is-${item.result.toLowerCase()}`}><span aria-hidden="true" className="mh-result-dot" />{t(outcomes[item.result])}</span>;
}

export function MatchHistory() {
  const { t, language } = useLocale();
  const formatDate = useDate();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  function setParams(next: URLSearchParams | Record<string, string>) {
    navigate({ pathname: localizedPath('/match-history', language), search: new URLSearchParams(next).toString() }, { replace: true });
  }
  const selected = /^[0-9a-f-]{36}$/i.test(params.get('match') ?? '') ? params.get('match') : null;
  const [rows, setRows] = useState<HistoryItem[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [denied, setDenied] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 900px)');
    const update = () => setCompact(query.matches);
    update(); query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const request = useRef(0);
  const active = useRef<AbortController | null>(null);
  const onDenied = useCallback(() => { request.current++; active.current?.abort(); setDenied(true); setRows(null); setCursor(null); setDrafts({}); }, []);
  const onRead = useCallback((id: string, version: number) => {
    setRows(current => current?.map(row => row.matchId === id && row.verification.version === version ? { ...row, unread: false } : row) ?? null);
  }, []);
  const load = useCallback(async (after: string | null = null) => {
    const sequence = ++request.current; active.current?.abort();
    const controller = new AbortController(); active.current = controller;
    setLoading(true); setError(false);
    try {
      const query = new URLSearchParams({ status: 'ALL', limit: '20' }); if (after) query.set('cursor', after);
      const result = await historyRequest(`/api/v1/me/matches?${query}`, controller.signal);
      if (sequence !== request.current) return;
      if (!validHistoryPage(result)) throw Error();
      setDenied(false); setRows(old => after && old ? [...old, ...result.items.filter(m => !old.some(r => r.matchId === m.matchId))] : result.items);
      setCursor(result.nextCursor);
    } catch (failure) {
      if (sequence !== request.current) return;
      if (failure instanceof HistoryError && [401, 403].includes(failure.status)) onDenied(); else setError(true);
    } finally { if (sequence === request.current) setLoading(false); }
  }, [onDenied]);
  useEffect(() => { setRows(null); setCursor(null); void load(); return () => { request.current++; active.current?.abort(); }; }, [load]);
  useEffect(() => {
    if (!selected && rows && rows.length > 0) {
      const next = new URLSearchParams(params); next.set('match', rows[0].matchId);
      navigate({ pathname: localizedPath('/match-history', language), search: next.toString() }, { replace: true });
    }
  }, [rows, selected, params, navigate, language]);
  function select(id: string) { if (id === selected) return; const next = new URLSearchParams(params); next.set('match', id); setParams(next); }
  const inspector = selected && <MatchInspector key={selected} id={selected} onDenied={onDenied} onRead={onRead}
    onUpdated={() => void load()} draft={drafts[selected] ?? ''} setDraft={value => setDrafts(current => ({ ...current, [selected]: value }))} />;

  const today = new Date(now);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const relativeTime = new Intl.RelativeTimeFormat(languageLocales[language], { numeric: 'auto', style: 'narrow' });
  const rowDate = (value: string) => {
    const date = new Date(value);
    const elapsed = now - date.getTime();
    if (elapsed >= 0 && elapsed < 60_000) return relativeTime.format(0, 'second');
    if (elapsed >= 60_000 && elapsed < 3_600_000) return relativeTime.format(-Math.floor(elapsed / 60_000), 'minute');
    if (elapsed >= 3_600_000 && elapsed < 86_400_000) return relativeTime.format(-Math.floor(elapsed / 3_600_000), 'hour');
    if (sameDay(date, yesterday)) return relativeTime.format(-1, 'day');
    return formatDate(value, true);
  };
  return <main className="content info-page match-history-page">
    <header className="mh-heading"><h1>{t('navigationHistory')}</h1></header>
    {denied ? <section className="mh-empty"><h2>{t('historyAccessHeading')}</h2><p>{t('historyAccessError')}</p><BattleNetLoginButton /></section> : rows?.length === 0 && !loading && !error ?
      <section className="mh-empty-history"><h2>{t('historyEmptyHeading')}</h2><Link className="button" to="/play">{t('navigationPlay')}</Link></section> : <>
      <div className="mh-workspace"><div className="mh-browser">
      {error && <div className="mh-notice is-error" role="alert"><p>{t(rows === null ? 'historyLoadError' : 'historyRefreshError')}</p><button onClick={() => void load()}>{t('historyRetry')}</button></div>}
      {loading && <p role="status" className="mh-loading">{t('historyLoading')}</p>}
      {compact && selected && !rows?.some(row => row.matchId === selected) && inspector}
      <ul className="mh-list" aria-label={t('historyYourMatches')}>{rows?.map(row => {
        const artwork = mapArtwork.get(row.map ?? '');
        return <li key={row.matchId} className={`mh-match is-${row.result.toLowerCase()}${selected === row.matchId ? ' is-selected' : ''}`}>
        <button className={`mh-row${artwork ? ' has-map-art' : ''}`} aria-pressed={selected === row.matchId} aria-expanded={compact ? selected === row.matchId : undefined} aria-controls={`match-${row.matchId}`} onClick={() => select(row.matchId)}>
          {artwork && <span className={`mh-row-art mh-row-art--${artwork}`} aria-hidden="true" />}
          {row.unread && <Notification className="mh-update-marker" aria-label={t('historyNewUpdate')} title={t('historyNewUpdate')} />}
          <span className="mh-row-result"><ResultBadge item={row} /><span className="mh-row-kind">{t(row.mode === 'CONTROLLED_TEST' ? 'historyTestMatch' : 'historyMatch')}</span></span>
          <span className="mh-row-identity"><strong>{row.map ?? t('historyBattleground')}</strong><span>{row.character.name}{row.character.realm && <span className="mh-realm"> · {row.character.realm}</span>}</span></span>
          <span className="mh-row-state">{row.disputeStatus && <span className="mh-dispute-hint">{t(row.disputeStatus === 'OPEN' ? 'historyDisputeOpen' : row.disputeStatus === 'WAITING_PLAYER' ? 'historyActionRequired' : 'historyDisputeResolved')}</span>}</span>
          <span className="mh-row-date"><time dateTime={row.createdAt} title={formatDate(row.createdAt)} aria-label={formatDate(row.createdAt)}>{rowDate(row.createdAt)}</time></span>
        </button>
        {compact && selected === row.matchId && inspector}
      </li>;
      })}</ul>
      {cursor && <div className="mh-pagination"><button disabled={loading} onClick={() => void load(cursor)}>{t('historyLoadMore')}</button><p>{t('historyNewestFirst')}</p></div>}
      </div>
      {!compact && <div className="mh-inspector-pane">{inspector || <section className="mh-selection-empty"><FlagMark /><h2>{t('historySelectMatch')}</h2><p>{t('historySelectMatchHint')}</p></section>}</div>}
      </div>
    </>}
  </main>;
}

function MatchInspector({ id, onDenied, onRead, onUpdated, draft, setDraft }: { id: string; onDenied: () => void; onRead: (id: string, version: number) => void;
  onUpdated: () => void; draft: string; setDraft: (value: string) => void }) {
  const { t, language } = useLocale();
  const formatDate = useDate();
  const [data, setData] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [missing, setMissing] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [tab, setTab] = useState<'overview' | 'players' | 'dispute'>('overview');
  const [compose, setCompose] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<MessageKey | null>(null);
  const [stale, setStale] = useState(false);
  const [sent, setSent] = useState(false);
  const active = useRef<AbortController | null>(null);
  useEffect(() => {
    let disposed = false; const controller = new AbortController();
    setLoading(true); setLoadError(false); setMissing(false);
    void (async () => {
      try {
        const result = await historyRequest(`/api/v1/me/matches/${id}`, controller.signal);
        if (disposed) return; if (!validDetail(result, id)) throw Error(); setData(result); setStale(false); setActionError(null);
        if (result.match.unread) {
          try {
            await historyRequest(`/api/v1/me/matches/${id}/read`, controller.signal, { expectedVersion: result.match.verification.version, disputeVersion: result.dispute?.version ?? null });
            if (!disposed) onRead(id, result.match.verification.version);
            if (result.dispute && !disposed) {
              const refreshed = await historyRequest(`/api/v1/me/matches/${id}`, controller.signal);
              if (!disposed && validDetail(refreshed, id)) setData(refreshed);
            }
          } catch (failure) {
            if (!disposed && failure instanceof HistoryError && [401, 403].includes(failure.status)) onDenied();
            // Keep the unread marker if acknowledgement fails; reopening can retry.
          }
        }
      } catch (failure) { if (disposed) return; if (failure instanceof HistoryError && [401, 403].includes(failure.status)) { onDenied(); return; } if (failure instanceof HistoryError && failure.status === 404) { setMissing(true); setData(null); } else setLoadError(true); }
      finally { if (!disposed) setLoading(false); }
    })();
    return () => { disposed = true; controller.abort(); };
  }, [id, attempt, onDenied, onRead]);
  useEffect(() => () => { active.current?.abort(); active.current = null; }, []);
  async function mutate() {
    if (!data || active.current || !draft.trim() || draft.length > 2000 || stale) return;
    const controller = new AbortController(); active.current = controller; setBusy(true); setActionError(null); setSent(false);
    try {
      const reply = data.dispute !== null && data.dispute.status !== 'RESOLVED';
      const path = `/api/v1/me/matches/${id}/${reply ? 'disputes/replies' : 'disputes'}`;
      const result = await historyRequest(path, controller.signal, { expectedVersion: reply ? data.dispute!.version : data.match.verification.version, message: draft.trim() });
      if (active.current !== controller) return;
      if (!validConversation(result)) throw Error();
      setDraft(''); setCompose(false); setSent(true);
      setAttempt(v => v + 1); onUpdated();
    } catch (failure) {
      if (active.current !== controller) return;
      if (failure instanceof HistoryError && [401, 403].includes(failure.status)) { onDenied(); return; }
      if (failure instanceof HistoryError && failure.status === 429) setActionError('historyRateLimited');
      else if (failure instanceof HistoryError && failure.status === 400) setActionError('historyMessageInvalid');
      else { setStale(true); setActionError(failure instanceof HistoryError && failure.status === 409 ? 'historyChanged' : 'historyUnconfirmed'); }
    } finally { if (active.current === controller) { active.current = null; setBusy(false); } }
  }
  const stats = data?.capture?.stats;
  const number = (value: number | null | undefined) => value == null ? '—' : value.toLocaleString(languageLocales[language]);
  const status = data?.match.verification.status;
  const artwork = mapArtwork.get(data?.match.map ?? '');
  return <section className="mh-detail" id={`match-${id}`} aria-label={t('historyMatchDetails')} aria-busy={loading}>
    {!data && <header className="mh-detail-heading"><h2>{t('historyMatchDetails')}</h2></header>}
    {loading && <p role="status">{t('historyLoading')}</p>}
    {missing && <p role="alert">{t('historyMatchMissing')}</p>}
    {loadError && <div className="mh-notice is-error" role="alert"><p>{t('historyDetailsError')}</p><button disabled={busy} onClick={() => setAttempt(v => v + 1)}>{t('historyRetry')}</button></div>}
    {data && <>
      <header className={`mh-detail-hero${artwork ? ` mh-detail-hero--${artwork}` : ''}`}>
        <div><ResultBadge item={data.match} /><h2>{data.match.map ?? t('historyBattleground')}</h2><time dateTime={data.match.createdAt}>{formatDate(data.match.createdAt, true)}</time></div>
      </header>
      <div className="mh-detail-summary"><div className="mh-detail-meta"><span>{t('historyDuration')}</span><strong>{data.capture?.durationSeconds == null ? '—' : `${Math.floor(data.capture.durationSeconds / 60)}:${String(data.capture.durationSeconds % 60).padStart(2, '0')}`}</strong></div><div className="mh-detail-meta"><span>{t('historyRating')}</span><strong>—</strong><small>{t('historyUnrated')}</small></div></div>
      <div className="mh-tabs" role="group" aria-label={t('historyMatchDetails')}><button aria-pressed={tab === 'overview'} onClick={() => setTab('overview')}>{t('historyOverview')}</button><button aria-pressed={tab === 'players'} onClick={() => setTab('players')}>{t('historyPlayers')}</button><button aria-pressed={tab === 'dispute'} onClick={() => setTab('dispute')}>{t('historyDisputeAndUpdates')}{data.dispute?.status === 'WAITING_PLAYER' && <span className="mh-alert-dot" aria-label={t('historyActionRequired')} />}</button></div>
      {tab === 'overview' ? <div className="mh-detail-grid"><div>
        <section className="mh-panel"><h3>{t('historyYourPerformance')}</h3>{!stats && <p className="mh-muted">{t('historyStatsUnavailable')}</p>}<dl className="mh-stats">{(['killingBlows', 'deaths', 'honorableKills', 'damage', 'healing'] as const).map(key => <div key={key}><dt>{t(({ killingBlows: 'historyKillingBlows', deaths: 'historyDeaths', honorableKills: 'historyHonorableKills', damage: 'historyDamage', healing: 'historyHealing' } as const)[key])}</dt><dd title={stats?.[key] == null ? t('historyUnknown') : undefined}>{number(stats?.[key])}</dd></div>)}</dl></section>
      </div><aside className="mh-panel mh-resolution"><h3>{t('historyResultStatus')}</h3><span className="mh-tag">{t(data.match.cancelled ? 'historyCancelled' : status === 'VERIFIED' ? 'historyVerified' : status === 'RESOLVED' ? 'historyResolvedByModerator' : status === 'VOIDED' ? 'historyVoided' : status === 'REVIEW' ? 'historyReview' : 'historyPending')}</span>
        <p>{data.match.verification.explanation ?? t(data.match.cancelled ? 'historyCancelledExplanation' : data.match.evidencePolicy === 'CAPTURE_ONLY' ? 'historyCaptureOnlyExplanation' : status === 'REVIEW' ? 'historyReviewExplanation' : status === 'PENDING' ? 'historyPendingExplanation' : 'historyVerifiedExplanation')}</p>
        {data.match.evidencePolicy === 'FULL_ROSTER' && <div className="mh-coverage"><h4>{t('historyReportsReceived')}</h4>{(['A', 'B'] as const).map(team => <div key={team}><span>{t('historyTeam')} {team}</span><strong>{team === 'A' ? data.match.verification.reportsA : data.match.verification.reportsB} / {data.match.verification.requiredPerTeam}</strong></div>)}</div>}
        <p className="mh-muted mh-delivery">{t(data.capture ? 'historySavedOnServer' : 'historyNoCapture')}</p>
      </aside></div> : tab === 'players' ? (<section className="mh-panel"><h3>{t('historyPlayers')}</h3><div className="mh-teams">{(data.match.evidencePolicy === 'FULL_ROSTER' ? ['A', 'B'] : [null]).map(team => <div key={team ?? 'capture'}><h4>{team === null ? t('historyRecordedPlayer') : `${t(team === data.match.team ? 'historyYourTeam' : 'historyOpponents')} · ${team}`}</h4><ul>{data.roster.filter(p => p.team === team).map((player, i) => <li key={i} className={player.you ? 'is-you' : ''}><span>{player.name}{player.you && <small>{t('historyYou')}</small>}</span>{player.realm && <span className="mh-muted">{player.realm}</span>}</li>)}</ul></div>)}</div></section>) : <div className="mh-detail-grid"><section className="mh-panel"><h3>{t('historyDisputeAndUpdates')}</h3>
        {data.dispute ? <MatchConversation thread={data.dispute} /> : <p>{t('historyNoDispute')}</p>}
        {sent && <p role="status" className="mh-success">{t('historyMessageSent')}</p>}
        {(!data.match.cancelled && (compose && data.canDispute || data.dispute && data.dispute.status !== 'RESOLVED')) ? <form className="mh-compose" onSubmit={event => { event.preventDefault(); void mutate(); }}>
          <label htmlFor={`message-${id}`}>{t(data.canDispute ? 'historyDisputeReason' : 'historyReplyLabel')}</label><p className="mh-muted" id={`message-help-${id}`}>{t('historyDisputeHelp')}</p>
          <textarea id={`message-${id}`} aria-describedby={`message-help-${id}`} required maxLength={2000} rows={4} value={draft} disabled={busy} onChange={event => setDraft(event.target.value)} />
          <div className="mh-compose-actions"><span>{draft.length}/2000</span><button className="mh-primary" disabled={!draft.trim() || busy || loading || stale} type="submit">{t(busy ? 'historySending' : data.canDispute ? 'historySubmitDispute' : 'historySendReply')}</button></div>
        </form> : data.canDispute ? <button onClick={() => setCompose(true)}>{t('historyDisputeResult')}</button> : !data.dispute && <p className="mh-muted">{t(data.match.cancelled ? 'historyCancelledExplanation' : 'historyWaitForResult')}</p>}
      </section><aside className="mh-panel"><h3>{t('historyResultTimeline')}</h3><ol className="mh-timeline">{data.updates.map(update => <li key={update.id}><time dateTime={update.at}>{formatDate(update.at, true)}</time><strong>{t(update.reason === 'ASSIGNMENT_CANCELLED' ? 'historyCancelled' : update.reason === 'PLAYER_DISPUTE' ? 'historyDisputeOpen' : update.status === 'RESOLVED' ? 'historyResolvedByModerator' : update.status === 'VOIDED' ? 'historyVoided' : update.status === 'VERIFIED' ? 'historyVerified' : update.status === 'REVIEW' ? 'historyReview' : 'historyPending')}</strong>{update.explanation && <p>{update.explanation}</p>}</li>)}</ol>{data.updates.length === 0 && <p className="mh-muted">{t('historyNoUpdates')}</p>}{data.olderUpdates && <p className="mh-muted">{t('historyRecentUpdates')}</p>}</aside></div>}
      {actionError && <div className="mh-notice is-error" role="alert"><p>{t(actionError)}</p>{stale && <button disabled={busy || loading} onClick={() => setAttempt(v => v + 1)}>{t('historyRefreshMatch')}</button>}</div>}
      <footer className="mh-reference"><span>{t('historyMatchReference')}</span> <code>{id}</code></footer>
    </>}
  </section>;
}
