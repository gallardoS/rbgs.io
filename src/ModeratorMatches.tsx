import { useCallback, useEffect, useRef, useState } from 'react';
import { CaptureTestAdmin } from './CaptureTestAdmin';
import { useLocale } from './locales';
import type { MessageKey } from './locales/en';
import './ModeratorMatches.css';

type Result = { matchId: string; mode: string; status: 'PENDING' | 'VERIFIED' | 'REVIEW'; reason: string | null;
  outcome: 'WIN' | 'DRAW' | null; winningTeam: 'A' | 'B' | null; reportsA: number; reportsB: number; requiredPerTeam: number; version: number };
type Player = { name: string; realm: string | null; team: 'A' | 'B' | null };
type Match = { matchId: string; mode: 'CONTROLLED_TEST' | 'MATCHMADE'; evidencePolicy: 'FULL_ROSTER' | 'CAPTURE_ONLY';
  profile: string; createdAt: string; captureStartDeadline: string; cancelledAt: string | null; roster: Player[]; result: Result; canCancel: boolean };
type Page = { items: Match[]; nextCursor: string | null };
type Report = { evidenceId: string; revision: number; receivedAt: string; validation: string; reason: string | null; normalizedFacts: string | null; redactedPayload: string };
type Review = { result: Result; expectedRoster: { character: { name: string; realm: string | null }; assignedTeamKey: string | null }[]; reports: Report[]; events: { id: string; recordedAt: string; status: string; reason: string | null }[] };
const filters = ['ALL', 'PENDING', 'REVIEW', 'VERIFIED', 'CANCELLED'] as const;
const statusKeys: Record<string, MessageKey> = { ALL: 'moderationAll', PENDING: 'moderationPending', VERIFIED: 'moderationVerified', REVIEW: 'moderationReview', CANCELLED: 'moderationCancelled' };
const validationKeys: Record<string, MessageKey> = { PENDING: 'moderationPending', VALID: 'moderationValid', INVALID: 'moderationInvalid', INCOMPLETE: 'moderationIncomplete', UNVERIFIABLE: 'moderationUnverifiable' };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const date = (v: unknown): v is string => typeof v === 'string' && Number.isFinite(Date.parse(v));
const count = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) >= 0;
const nullableText = (v: unknown): v is string | null => v === null || typeof v === 'string';
function validResult(v: any): v is Result {
  return v && uuid.test(v.matchId) && ['CONTROLLED_TEST', 'MATCHMADE'].includes(v.mode)
    && ['PENDING', 'VERIFIED', 'REVIEW'].includes(v.status) && nullableText(v.reason)
    && [null, 'WIN', 'DRAW'].includes(v.outcome) && [null, 'A', 'B'].includes(v.winningTeam)
    && (v.status === 'VERIFIED' ? (v.outcome === 'WIN' && ['A', 'B'].includes(v.winningTeam) || v.outcome === 'DRAW' && v.winningTeam === null) : v.outcome === null && v.winningTeam === null)
    && count(v.reportsA) && count(v.reportsB) && count(v.requiredPerTeam) && v.requiredPerTeam > 0 && count(v.version);
}
function validPage(v: any): v is Page {
  return v && Array.isArray(v.items) && v.items.length <= 50 && nullableText(v.nextCursor)
    && (v.nextCursor === null || v.nextCursor.length <= 256) && new Set(v.items.map((m: any) => m?.matchId)).size === v.items.length
    && v.items.every((m: any) => m && uuid.test(m.matchId) && ['CONTROLLED_TEST', 'MATCHMADE'].includes(m.mode)
      && ['FULL_ROSTER', 'CAPTURE_ONLY'].includes(m.evidencePolicy) && typeof m.profile === 'string'
      && date(m.createdAt) && date(m.captureStartDeadline) && (m.cancelledAt === null || date(m.cancelledAt))
      && typeof m.canCancel === 'boolean' && validResult(m.result) && m.result.matchId === m.matchId && m.result.mode === m.mode
      && (!m.canCancel || m.mode === 'CONTROLLED_TEST' && m.cancelledAt === null)
      && Array.isArray(m.roster) && m.roster.length >= 1 && m.roster.length <= 40
      && m.roster.every((p: any) => p && typeof p.name === 'string' && p.name.length <= 512 && nullableText(p.realm) && [null, 'A', 'B'].includes(p.team)));
}
function validReview(v: any, id: string): v is Review {
  return v && validResult(v.result) && v.result.matchId === id && Array.isArray(v.expectedRoster) && v.expectedRoster.length <= 40
    && v.expectedRoster.every((p: any) => p?.character && typeof p.character.name === 'string' && nullableText(p.character.realm) && [null, 'A', 'B'].includes(p.assignedTeamKey))
    && Array.isArray(v.reports) && v.reports.length <= 1000 && v.reports.every((r: any) => r && uuid.test(r.evidenceId) && count(r.revision) && r.revision > 0
      && date(r.receivedAt) && typeof r.validation === 'string' && nullableText(r.reason) && nullableText(r.normalizedFacts)
      && typeof r.redactedPayload === 'string' && r.redactedPayload.length <= 262144)
    && Array.isArray(v.events) && v.events.length <= 1000 && v.events.every((e: any) => e && uuid.test(e.id) && date(e.recordedAt) && typeof e.status === 'string' && nullableText(e.reason));
}
function reasonKey(reason: string | null): MessageKey | null {
  if (!reason) return null;
  if (reason === 'ASSIGNMENT_CANCELLED') return 'moderationReasonCancelled';
  if (reason === 'CAPTURE_ONLY_NO_EXPECTED_TEAMS') return 'moderationReasonCaptureOnly';
  if (reason === 'INSUFFICIENT_REPORTS') return 'moderationReasonInsufficient';
  if (reason === 'AWAITING_REPORTS') return 'moderationReasonWaiting';
  if (reason === 'CONTRADICTORY_OUTCOME') return 'moderationReasonOutcome';
  if (reason.includes('TIMING')) return 'moderationReasonTiming';
  if (reason.startsWith('OWN_CHARACTER')) return 'moderationReasonCharacter';
  if (reason.includes('ROSTER')) return 'moderationReasonRoster';
  if (reason.startsWith('TEAM_MAPPING')) return 'moderationReasonTeams';
  if (reason === 'CAPTURE_INCOMPLETE') return 'moderationReasonIncomplete';
  if (reason.startsWith('STORED_DATA') || reason === 'ASSIGNMENT_BINDING_MISMATCH') return 'moderationReasonData';
  if (reason === 'UNSUPPORTED_CAPTURE_PROFILE') return 'moderationReasonProfile';
  return 'moderationReasonOther';
}
function decode(value: string | null): Record<string, any> | null {
  try { const parsed = value === null ? null : JSON.parse(value); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null; } catch { return null; }
}

function MatchDetails({ id, revision, onDenied }: { id: string; revision: number; onDenied: () => void }) {
  const { t, language } = useLocale();
  const [data, setData] = useState<Review | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let disposed = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    setData(null); setFailed(false);
    void (async () => {
      try {
        const response = await fetch(`/api/v1/moderation/matches/${id}/verification`, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
        if (response.status === 401 || response.status === 403) { if (!disposed) onDenied(); return; }
        if (!response.ok) throw Error();
        const result: unknown = await response.json();
        if (!validReview(result, id)) throw Error();
        if (!disposed) setData(result);
      } catch { if (!disposed) setFailed(true); }
      finally { window.clearTimeout(timeout); }
    })();
    return () => { disposed = true; controller.abort(); window.clearTimeout(timeout); };
  }, [id, revision, attempt, onDenied]);
  if (failed) return <div className="moderation-details" role="alert"><p>{t('moderationDetailsError')}</p><button onClick={() => setAttempt(v => v + 1)}>{t('moderationRetry')}</button></div>;
  if (!data) return <p role="status">{t('moderationLoading')}</p>;
  return <div className="moderation-details">
    <h3>{t('moderationAssignedRoster')}</h3>
    <ul>{data.expectedRoster.map((p, i) => <li key={i}>{p.character.name}{p.character.realm ? ` / ${p.character.realm}` : ''} · {p.assignedTeamKey ? `${t('moderationTeam')} ${p.assignedTeamKey}` : t('moderationNoTeam')}</li>)}</ul>
    <h3>{t('moderationReports')} ({data.reports.length})</h3>
    {data.reports.length === 0 && <p>{t('moderationNoReports')}</p>}
    {data.reports.map(report => {
      const payload = decode(report.redactedPayload);
      const name = typeof payload?.observedCharacter?.name === 'string' ? payload.observedCharacter.name : t('moderationUnknownPlayer');
      const reason = reasonKey(report.reason);
      return <article className="moderation-report" key={report.evidenceId}>
        <h4>{name} · {t(validationKeys[report.validation] ?? 'moderationUnverifiable')}</h4>
        <p>{t('moderationRevision')} {report.revision} · <time dateTime={report.receivedAt}>{new Date(report.receivedAt).toLocaleString(language)}</time></p>
        {reason && <p>{t(reason)}</p>}
        <details><summary>{t('moderationTechnicalEvidence')}</summary>
          <p>{t('moderationPrivateEvidence')}</p>
          <pre tabIndex={0}>{JSON.stringify(decode(report.normalizedFacts), null, 2)}</pre>
          <pre tabIndex={0}>{payload ? JSON.stringify(payload, null, 2) : report.redactedPayload}</pre>
        </details>
      </article>;
    })}
    <h3>{t('moderationHistory')}</h3>
    {data.events.length === 0 ? <p>{t('moderationNoEvents')}</p> : <ol>{data.events.map(event => {
      const reason = reasonKey(event.reason);
      return <li key={event.id}><time dateTime={event.recordedAt}>{new Date(event.recordedAt).toLocaleString(language)}</time> · {t(statusKeys[event.status] ?? 'moderationReview')}{reason ? ` — ${t(reason)}` : ''}</li>;
    })}</ol>}
  </div>;
}

export function ModeratorMatches({ accountId }: { accountId: string }) {
  const { t, language } = useLocale();
  const [filter, setFilter] = useState<string>('ALL');
  const [rows, setRows] = useState<Match[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [denied, setDenied] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [action, setAction] = useState<{ id: string; key: MessageKey; error: boolean } | null>(null);
  const [cancelled, setCancelled] = useState<Set<string>>(() => new Set());
  const [created, setCreated] = useState<string | null>(null);
  const request = useRef(0);
  const listController = useRef<AbortController | null>(null);
  const mutation = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const accessDenied = useCallback(() => { setDenied(true); setRows(null); setSelected(null); }, []);
  const onCreated = useCallback((id: string) => { setCreated(id); setFilter('ALL'); setConfirm(null); setRefresh(v => v + 1); }, []);
  const load = useCallback(async (after: string | null = null) => {
    const sequence = ++request.current;
    listController.current?.abort();
    const controller = new AbortController(); listController.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    setLoading(true); setLoadError(false);
    try {
      const query = new URLSearchParams({ status: filter, limit: '20' }); if (after) query.set('cursor', after);
      const response = await fetch(`/api/v1/moderation/matches?${query}`, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
      if (sequence !== request.current || !mounted.current) return;
      if (response.status === 401 || response.status === 403) { accessDenied(); return; }
      if (!response.ok) throw Error();
      const result: unknown = await response.json(); if (!validPage(result)) throw Error();
      if (sequence !== request.current || !mounted.current) return;
      setDenied(false);
      setRows(current => after && current ? [...current, ...result.items.filter(m => !current.some(old => old.matchId === m.matchId))] : result.items);
      setCursor(result.nextCursor);
    } catch { if (sequence === request.current && mounted.current) setLoadError(true); }
    finally { window.clearTimeout(timeout); if (sequence === request.current && mounted.current) setLoading(false); }
  }, [filter, accessDenied]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; request.current++; listController.current?.abort(); mutation.current?.abort(); };
  }, []);
  useEffect(() => { setSelected(null); setCursor(null); void load(); return () => { request.current++; listController.current?.abort(); }; }, [load, refresh]);

  async function cancel(match: Match) {
    if (mutation.current) return;
    const controller = new AbortController(); mutation.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    setBusy(match.matchId); setAction(null);
    try {
      const token = document.cookie.split('; ').find(c => c.startsWith('XSRF-TOKEN='))?.slice(11);
      if (!token) throw Error();
      const response = await fetch(`/api/v1/moderation/capture-tests/${match.matchId}/cancel?expectedVersion=${match.result.version}`, {
        method: 'POST', credentials: 'same-origin', cache: 'no-store', signal: controller.signal, headers: { 'X-XSRF-TOKEN': decodeURIComponent(token) }
      });
      if (!mounted.current) return;
      if (response.status === 401 || response.status === 403) { accessDenied(); return; }
      if (response.status === 409) { setAction({ id: match.matchId, key: 'moderationMatchChanged', error: true }); setConfirm(null); void load(); return; }
      if (response.status !== 204) throw Error();
      setCancelled(current => new Set(current).add(match.matchId));
      setAction({ id: match.matchId, key: 'moderationCancelSuccess', error: false }); setConfirm(null);
      setRefresh(v => v + 1);
    } catch { if (mounted.current) setAction({ id: match.matchId, key: 'moderationCancelError', error: true }); }
    finally { window.clearTimeout(timeout); if (mutation.current === controller) { mutation.current = null; if (mounted.current) setBusy(null); } }
  }

  if (denied) return <section className="profile-settings-section moderator-matches"><p role="alert">{t('moderationAccessError')}</p><button onClick={() => void load()}>{t('moderationRetry')}</button></section>;
  return <>
    <CaptureTestAdmin accountId={accountId} onCreated={onCreated} />
    <section className="profile-settings-section moderator-matches" aria-labelledby="moderation-heading">
      <header className="moderation-toolbar"><div><h2 id="moderation-heading">{t('moderationMatches')}</h2><p>{t('moderationDescription')}</p></div>
        <button disabled={loading || busy !== null} onClick={() => setRefresh(v => v + 1)}>{t('moderationRefresh')}</button></header>
      <label className="moderation-filter">{t('moderationFilter')}<select value={filter} disabled={busy !== null} onChange={e => { setRows(null); setFilter(e.target.value); setConfirm(null); setAction(null); }}>{filters.map(value => <option key={value} value={value}>{t(statusKeys[value])}</option>)}</select></label>
      {loading && <p role="status">{t('moderationLoading')}</p>}
      {loadError && <p role="alert">{t(rows === null ? 'moderationLoadError' : 'moderationRefreshError')}</p>}
      {action && <p className={action.error ? 'moderation-error' : 'moderation-success'} role={action.error ? 'alert' : 'status'}>{t(action.key)}</p>}
      {rows?.length === 0 && !loading && <p>{t('moderationEmpty')}</p>}
      <div className="moderation-list">{rows?.map(match => {
        const isCancelled = match.cancelledAt !== null || cancelled.has(match.matchId);
        const state = isCancelled ? 'CANCELLED' : match.result.status;
        const reason = reasonKey(isCancelled ? 'ASSIGNMENT_CANCELLED' : match.result.reason);
        return <article className={`moderation-match${match.matchId === created ? ' is-created' : ''}`} key={match.matchId}>
          <div className="moderation-match-heading"><h3>{t(match.evidencePolicy === 'CAPTURE_ONLY' ? 'moderationCaptureOnly' : 'moderationFullRoster')} <span>{t(match.mode === 'CONTROLLED_TEST' ? 'moderationTest' : 'moderationMatch')}</span></h3><span className={`moderation-status is-${state.toLowerCase()}`}>{t(statusKeys[state])}</span></div>
          <code className="moderation-match-id">{match.matchId}</code>
          <p><time dateTime={match.createdAt}>{new Date(match.createdAt).toLocaleString(language)}</time> · {match.roster.map(p => p.name).join(', ')}</p>
          {reason && <p className="moderation-reason">{t(reason)}</p>}
          {match.evidencePolicy === 'FULL_ROSTER' && <p>{t('moderationUsableReports')}: {t('moderationTeam')} A {match.result.reportsA}/{match.result.requiredPerTeam} · {t('moderationTeam')} B {match.result.reportsB}/{match.result.requiredPerTeam}</p>}
          {!isCancelled && match.result.status === 'VERIFIED' && <p>{match.result.outcome === 'DRAW' ? t('moderationDraw') : `${t('moderationWinner')}: ${t('moderationTeam')} ${match.result.winningTeam}`}</p>}
          <div className="moderation-actions"><button aria-expanded={selected === match.matchId} aria-controls={`evidence-${match.matchId}`} onClick={() => setSelected(current => current === match.matchId ? null : match.matchId)}>{t(selected === match.matchId ? 'moderationHideDetails' : 'moderationDetails')}</button>
            {match.canCancel && !isCancelled && <button disabled={busy !== null} onClick={() => { setConfirm(match.matchId); setAction(null); }}>{t('moderationCancel')}</button>}</div>
          {confirm === match.matchId && <div className="moderation-confirm" role="group" aria-label={t('moderationConfirmCancel')}><p>{t('moderationConfirmCancel')}</p><button autoFocus disabled={busy !== null} onClick={() => void cancel(match)}>{t(busy === match.matchId ? 'moderationCancelling' : 'moderationConfirm')}</button><button disabled={busy !== null} onClick={() => setConfirm(null)}>{t('moderationKeep')}</button></div>}
          {selected === match.matchId && <div id={`evidence-${match.matchId}`}><MatchDetails id={match.matchId} revision={match.result.version} onDenied={accessDenied} /></div>}
        </article>;
      })}</div>
      {cursor && <button disabled={loading || busy !== null} onClick={() => void load(cursor)}>{t('moderationMore')}</button>}
    </section>
  </>;
}
