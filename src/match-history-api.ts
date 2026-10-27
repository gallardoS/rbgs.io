export type MatchState = 'PENDING' | 'REVIEW' | 'VERIFIED' | 'RESOLVED' | 'VOIDED';
export type Outcome = 'WIN' | 'LOSS' | 'DRAW' | 'PENDING' | 'REVIEW' | 'VOIDED' | 'CANCELLED';
export type Verification = { status: MatchState; reason: string | null; version: number; outcome: 'WIN' | 'DRAW' | null;
  winningTeam: 'A' | 'B' | null; reportsA: number; reportsB: number; requiredPerTeam: number; explanation: string | null; resolvedAt: string | null };
export type HistoryItem = { matchId: string; createdAt: string; mode: 'CONTROLLED_TEST' | 'MATCHMADE'; evidencePolicy: 'CAPTURE_ONLY' | 'FULL_ROSTER';
  map: string | null; character: { name: string; realm: string | null }; team: 'A' | 'B' | null; result: Outcome; verification: Verification;
  disputeStatus: 'OPEN' | 'WAITING_PLAYER' | 'RESOLVED' | null; unread: boolean; cancelled: boolean };
export type HistoryPage = { items: HistoryItem[]; nextCursor: string | null };
export type Conversation = { id: string; status: 'OPEN' | 'WAITING_PLAYER' | 'RESOLVED'; version: number; openedAt: string; updatedAt: string;
  unread: boolean; olderMessages: boolean; messages: { id: string; author: 'PLAYER' | 'MODERATOR' | 'SYSTEM'; kind: string; body: string; at: string }[] };
export type MatchDetail = { match: HistoryItem; roster: { name: string; realm: string | null; team: 'A' | 'B' | null; you: boolean }[];
  capture: { startedAt: string | null; endedAt: string | null; durationSeconds: number | null;
    stats: { killingBlows: number | null; deaths: number | null; honorableKills: number | null; damage: number | null; healing: number | null; flagsCaptured?: number | null; flagsReturned?: number | null } | null;
    delivery: string; product: string | null; build: string | null; revision: number } | null;
  dispute: Conversation | null; updates: { id: string; at: string; status: string; reason: string | null; explanation: string | null; outcome: string | null; winningTeam: string | null }[];
  olderUpdates: boolean; canDispute: boolean };
export type ModeratorConversation = { id: string; playerName: string; thread: Conversation };
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const text = (v: unknown, limit = 2000): v is string => typeof v === 'string' && v.length <= limit;
const nullableText = (v: unknown, limit?: number): v is string | null => v === null || text(v, limit);
const count = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) >= 0;
const date = (v: unknown): v is string => text(v, 64) && Number.isFinite(Date.parse(v));
const nullableDate = (v: unknown) => v === null || date(v);
const states = ['PENDING', 'REVIEW', 'VERIFIED', 'RESOLVED', 'VOIDED'];
const threadStates = ['OPEN', 'WAITING_PLAYER', 'RESOLVED'];
export function validHistoryItem(v: any): v is HistoryItem {
  const r = v?.verification;
  const expected = v?.cancelled ? 'CANCELLED' : ['VERIFIED', 'RESOLVED'].includes(r?.status)
    ? r.outcome === 'DRAW' ? 'DRAW' : v.team === null ? 'REVIEW' : v.team === r.winningTeam ? 'WIN' : 'LOSS' : r?.status;
  return v && uuid(v.matchId) && date(v.createdAt) && ['CONTROLLED_TEST', 'MATCHMADE'].includes(v.mode)
    && ['CAPTURE_ONLY', 'FULL_ROSTER'].includes(v.evidencePolicy) && nullableText(v.map, 128)
    && v.character && text(v.character.name, 512) && nullableText(v.character.realm, 128) && [null, 'A', 'B'].includes(v.team)
    && ['WIN', 'LOSS', 'DRAW', 'PENDING', 'REVIEW', 'VOIDED', 'CANCELLED'].includes(v.result)
    && [null, ...threadStates].includes(v.disputeStatus) && typeof v.unread === 'boolean' && typeof v.cancelled === 'boolean'
    && r && states.includes(r.status) && nullableText(r.reason, 128) && count(r.version) && [null, 'WIN', 'DRAW'].includes(r.outcome)
    && [null, 'A', 'B'].includes(r.winningTeam) && count(r.reportsA) && count(r.reportsB) && count(r.requiredPerTeam)
    && nullableText(r.explanation) && nullableDate(r.resolvedAt) && v.result === expected
    && (['VERIFIED', 'RESOLVED'].includes(r.status) ? (r.outcome === 'WIN' && ['A', 'B'].includes(r.winningTeam) || r.outcome === 'DRAW' && r.winningTeam === null) : r.outcome === null && r.winningTeam === null);
}
export function validHistoryPage(v: any): v is HistoryPage {
  return v && Array.isArray(v.items) && v.items.length <= 50 && v.items.every(validHistoryItem)
    && new Set(v.items.map((m: HistoryItem) => m.matchId)).size === v.items.length && nullableText(v.nextCursor, 256);
}
export function validConversation(v: any): v is Conversation {
  return v && uuid(v.id) && threadStates.includes(v.status) && count(v.version) && date(v.openedAt) && date(v.updatedAt)
    && typeof v.unread === 'boolean' && typeof v.olderMessages === 'boolean' && Array.isArray(v.messages) && v.messages.length <= 100
    && v.messages.every((m: any) => m && uuid(m.id) && ['PLAYER', 'MODERATOR', 'SYSTEM'].includes(m.author) && text(m.kind, 32) && text(m.body) && date(m.at));
}
export function validDetail(v: any, id: string): v is MatchDetail {
  return v && validHistoryItem(v.match) && v.match.matchId === id && Array.isArray(v.roster) && v.roster.length <= 40
    && v.roster.every((p: any) => p && text(p.name, 512) && nullableText(p.realm, 128) && [null, 'A', 'B'].includes(p.team) && typeof p.you === 'boolean')
    && (v.capture === null || v.capture && nullableDate(v.capture.startedAt) && nullableDate(v.capture.endedAt)
      && (v.capture.durationSeconds === null || count(v.capture.durationSeconds)) && text(v.capture.delivery, 32)
      && nullableText(v.capture.product, 128) && nullableText(v.capture.build, 128) && count(v.capture.revision)
      && (v.capture.stats === null || ['killingBlows', 'deaths', 'honorableKills', 'damage', 'healing'].every(k => v.capture.stats[k] === null || count(v.capture.stats[k])) && ['flagsCaptured', 'flagsReturned'].every(k => v.capture.stats[k] === undefined || v.capture.stats[k] === null || count(v.capture.stats[k]))))
    && (v.dispute === null || validConversation(v.dispute)) && Array.isArray(v.updates) && v.updates.length <= 100
    && v.updates.every((e: any) => e && uuid(e.id) && date(e.at) && states.includes(e.status) && nullableText(e.reason, 128) && nullableText(e.explanation) && nullableText(e.outcome, 8) && nullableText(e.winningTeam, 1))
    && typeof v.olderUpdates === 'boolean' && typeof v.canDispute === 'boolean';
}
export class HistoryError extends Error {
  constructor(public status: number) { super('Match request failed'); }
}
export async function historyRequest(path: string, signal: AbortSignal, body?: unknown): Promise<unknown> {
  const controller = new AbortController();
  const abort = () => controller.abort(); signal.addEventListener('abort', abort, { once: true });
  if (signal.aborted) controller.abort();
  const timeout = window.setTimeout(abort, 10000);
  try {
    const headers: Record<string, string> = {};
    if (body !== undefined) {
      const token = document.cookie.split('; ').find(c => c.startsWith('XSRF-TOKEN='))?.slice(11);
      if (!token) throw new HistoryError(0);
      headers['X-XSRF-TOKEN'] = decodeURIComponent(token); headers['Content-Type'] = 'application/json';
    }
    const response = await fetch(path, { method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', cache: 'no-store',
      signal: controller.signal, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    if (!response.ok) throw new HistoryError(response.status);
    return response.status === 204 ? null : await response.json();
  } finally { window.clearTimeout(timeout); signal.removeEventListener('abort', abort); }
}
