import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale } from './locales';
import { LanguageMenu } from './LanguageMenu';
import { RoleSelection, type MatchRole } from './RoleSelection';
import './SoloQueueLab.css';
import { MatchReadyDialog } from './MatchReadyDialog';

type Player = { id: string; name: string; role: MatchRole; captainConsent: boolean };
type Member = { accountId: string; name: string; role: MatchRole; captain: boolean; accepted: boolean };
type Room = { id: string; source: 'SIMULATION'; status: 'PROPOSED' | 'PREPARING' | 'CANCELLED';
  acceptanceDeadline: string; preparationDeadline: string | null; cancellationReason: string | null;
  version: number; teamA: Member[]; teamB: Member[] };
type Snapshot = { simulation: true; generation: string | null; scenario: string; serverTime: string;
  accountId: string | null; players: Player[]; queueDepth: number; revision: string;
  ticket: { id: string; state: 'QUEUED' | 'PROPOSED'; enteredAt: string; version: number } | null; room: Room | null };
const endpoint = '/api/v1/local/soloq';
const copy = {
  en: { title: 'SoloQ test room', banner: 'Local simulation · test players · no game connection or rating',
    setup: 'Create simulation', reset: 'Reset simulation', normal: 'Normal teams', noCaptains: 'No volunteers', noHealers: 'No healers',
    actor: 'View as test player', captain: 'Volunteer as captain', enter: 'Find match', cancel: 'Cancel search',
    captainRule: 'Volunteers have priority. Otherwise, captains are assigned by games played, then rating. If everyone is new, they are chosen at random.',
    add19: 'Queue 19 test players', add99: 'Queue 99 test players', depth: 'Players waiting', waiting: 'Searching for compatible players',
    idle: 'Ready to search', found: 'Match proposed', preparing: 'Teams accepted', cancelled: 'Proposal cancelled',
    accept: 'Accept match', accepted: 'Accepted', decline: 'Decline match', bots: 'Accept for other test players', end: 'End simulation',
    acceptedCount: 'Accepted', team: 'Team', seconds: 's remaining', wait: 's waiting', live: 'Live updates', fallback: 'Reconnecting · refreshing automatically',
    unavailable: 'The local simulation server is unavailable. Start the isolated SoloQ lab and retry.', retry: 'Retry',
    readyNote: 'This simulated room is ready. Game launch, addon codes and rating are outside this test.',
    expired: 'The deadline expired. All players can search again.', declined: 'The simulation ended. All players can search again.',
    error: 'The action could not be completed. Refreshing the current state.', busy: 'Working…',
    instructions: 'Choose a test player, find a match, then add test players. Accept the proposal and simulate the other acceptances.' },
  es: { title: 'Sala de prueba SoloQ', banner: 'Simulación local · jugadores ficticios · sin conexión al juego ni rating',
    setup: 'Crear simulación', reset: 'Reiniciar simulación', normal: 'Equipos normales', noCaptains: 'Sin voluntarios', noHealers: 'Sin healers',
    actor: 'Ver como jugador de prueba', captain: 'Ofrecerme como capitán', enter: 'Buscar partida', cancel: 'Cancelar búsqueda',
    captainRule: 'Se priorizan los voluntarios. Si faltan, se asignan capitanes por partidas jugadas y después por rating. Si todos son nuevos, se eligen al azar.',
    add19: 'Añadir 19 jugadores a la cola', add99: 'Añadir 99 jugadores a la cola', depth: 'Jugadores esperando', waiting: 'Buscando jugadores compatibles',
    idle: 'Listo para buscar', found: 'Partida propuesta', preparing: 'Equipos aceptados', cancelled: 'Propuesta cancelada',
    accept: 'Aceptar partida', accepted: 'Aceptada', decline: 'Rechazar partida', bots: 'Aceptar por los otros jugadores ficticios', end: 'Finalizar simulación',
    acceptedCount: 'Han aceptado', team: 'Equipo', seconds: 's restantes', wait: 's esperando', live: 'Actualizaciones en directo', fallback: 'Reconectando · actualización automática',
    unavailable: 'El servidor local de simulación no está disponible. Inicia el entorno aislado de SoloQ y reinténtalo.', retry: 'Reintentar',
    readyNote: 'La sala simulada está lista. Esta prueba no inicia el juego ni genera códigos para el addon o rating.',
    expired: 'El plazo terminó. Todos los jugadores pueden volver a buscar.', declined: 'La simulación terminó. Todos los jugadores pueden volver a buscar.',
    error: 'No se pudo completar la acción. Actualizando el estado actual.', busy: 'Procesando…',
    instructions: 'Elige un jugador ficticio, busca partida y añade jugadores. Acepta la propuesta y simula las demás aceptaciones.' },
  fr: { title: 'Salle de test SoloQ', banner: 'Simulation locale · joueurs fictifs · sans connexion au jeu ni classement',
    setup: 'Créer une simulation', reset: 'Réinitialiser la simulation', normal: 'Équipes normales', noCaptains: 'Sans volontaires', noHealers: 'Sans soigneurs',
    actor: 'Voir comme joueur de test', captain: 'Me proposer comme capitaine', enter: 'Trouver un match', cancel: 'Annuler la recherche',
    captainRule: 'Les volontaires sont prioritaires. Sinon, les capitaines sont choisis selon les matchs joués, puis le classement. Si tous sont nouveaux, le choix est aléatoire.',
    add19: 'Ajouter 19 joueurs à la file', add99: 'Ajouter 99 joueurs à la file', depth: 'Joueurs en attente', waiting: 'Recherche de joueurs compatibles',
    idle: 'Prêt à chercher', found: 'Match proposé', preparing: 'Équipes acceptées', cancelled: 'Proposition annulée',
    accept: 'Accepter le match', accepted: 'Accepté', decline: 'Refuser le match', bots: 'Accepter pour les autres joueurs fictifs', end: 'Terminer la simulation',
    acceptedCount: 'Acceptations', team: 'Équipe', seconds: 's restantes', wait: 's d’attente', live: 'Mises à jour en direct', fallback: 'Reconnexion · actualisation automatique',
    unavailable: 'Le serveur local de simulation est indisponible. Démarrez le laboratoire SoloQ isolé et réessayez.', retry: 'Réessayer',
    readyNote: 'La salle simulée est prête. Ce test ne lance pas le jeu et ne génère aucun code pour l’addon ni classement.',
    expired: 'Le délai est écoulé. Tous les joueurs peuvent relancer la recherche.', declined: 'La simulation est terminée. Tous les joueurs peuvent relancer la recherche.',
    error: 'L’action a échoué. Actualisation de l’état actuel.', busy: 'Traitement…',
    instructions: 'Choisissez un joueur fictif, cherchez un match et ajoutez des joueurs. Acceptez la proposition et simulez les autres acceptations.' },
};
function valid(value: unknown): value is Snapshot {
  if (!value || typeof value !== 'object') return false;
  const v = value as Snapshot;
  const member = (m: Member) => m && typeof m.accountId === 'string' && typeof m.name === 'string'
    && ['FC', 'HEALER', 'DPS'].includes(m.role) && typeof m.captain === 'boolean' && typeof m.accepted === 'boolean';
  return v.simulation === true && typeof v.revision === 'string' && Number.isFinite(Date.parse(v.serverTime))
    && (v.generation === null || typeof v.generation === 'string') && (v.accountId === null || typeof v.accountId === 'string')
    && Number.isSafeInteger(v.queueDepth) && v.queueDepth >= 0 && Array.isArray(v.players)
    && v.players.every(p => typeof p.id === 'string' && typeof p.name === 'string' && ['FC','HEALER','DPS'].includes(p.role) && typeof p.captainConsent === 'boolean')
    && (v.ticket === null || typeof v.ticket.id === 'string' && ['QUEUED','PROPOSED'].includes(v.ticket.state) && Number.isFinite(Date.parse(v.ticket.enteredAt)))
    && (v.room === null || v.room.source === 'SIMULATION' && typeof v.room.id === 'string'
      && ['PROPOSED','PREPARING','CANCELLED'].includes(v.room.status) && Number.isFinite(Date.parse(v.room.acceptanceDeadline))
      && Array.isArray(v.room.teamA) && v.room.teamA.length === 10 && v.room.teamA.every(member)
      && Array.isArray(v.room.teamB) && v.room.teamB.length === 10 && v.room.teamB.every(member));
}

export function SoloQueueLabPage() {
  const { language } = useLocale();
  const c = copy[language === 'es' ? 'es' : language === 'fr' ? 'fr' : 'en'];
  const [state, setState] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [actionError, setActionError] = useState(false);
  const [connected, setConnected] = useState(false);
  const [visible, setVisible] = useState(!document.hidden);
  const [scenario, setScenario] = useState('NORMAL');
  const [now, setNow] = useState(Date.now());
  const offset = useRef(0);
  const mutation = useRef<AbortController | null>(null);
  const read = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  const ingest = useCallback((value: unknown) => {
    if (!valid(value)) throw new Error('Invalid simulation snapshot');
    offset.current = Date.parse(value.serverTime) - Date.now();
    setState(value); setError(false);
  }, []);
  const load = useCallback(async () => {
    if (mutation.current) return;
    read.current?.abort();
    const controller = new AbortController(); read.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(endpoint, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
      const body: unknown = response.ok ? await response.json() : null;
      if (!mounted.current || controller.signal.aborted || read.current !== controller) return;
      ingest(body);
    } catch { if (mounted.current && read.current === controller && !controller.signal.aborted) setError(true); }
    finally { window.clearTimeout(timeout); if (mounted.current && read.current === controller && controller.signal.aborted) setError(true); }
  }, [ingest]);
  useEffect(() => {
    mounted.current = true; void load();
    const visibility = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', visibility);
    const timer = window.setInterval(() => setNow(Date.now() + offset.current), 1000);
    return () => { mounted.current = false; read.current?.abort(); mutation.current?.abort(); mutation.current = null;
      document.removeEventListener('visibilitychange', visibility); window.clearInterval(timer); };
  }, [load]);
  useEffect(() => {
    document.title = `${c.title} | rbgs.io`;
    document.querySelector('meta[name="robots"]')?.setAttribute('content', 'noindex, nofollow');
  }, [c.title]);
  useEffect(() => {
    if (!visible || !state?.generation) { setConnected(false); return; }
    const stream = new EventSource(`${endpoint}/events`);
    const resync = () => { setConnected(true); void load(); };
    stream.addEventListener('ready', resync); stream.addEventListener('changed', resync);
    stream.onerror = () => { setConnected(false); void load(); };
    void load();
    return () => { stream.close(); setConnected(false); };
  }, [visible, state?.generation, state?.accountId, load]);
  useEffect(() => {
    if (!visible) return;
    const interval = window.setInterval(() => void load(), connected ? 30000 : 3000);
    return () => window.clearInterval(interval);
  }, [visible, connected, load]);
  async function command(path: string, body?: unknown, method = 'POST') {
    if (mutation.current) return;
    read.current?.abort(); read.current = null;
    const controller = new AbortController(); mutation.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    setBusy(true); setError(false); setActionError(false);
    try {
      const cookieName = 'RBGS_SOLOQ_LAB_XSRF=';
      const token = document.cookie.split('; ').find(cookie => cookie.startsWith(cookieName))?.slice(cookieName.length);
      if (!token) throw new Error('Missing CSRF');
      const response = await fetch(endpoint + path, { method, credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
        headers: { 'X-XSRF-TOKEN': decodeURIComponent(token), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        body: body === undefined ? undefined : JSON.stringify(body) });
      if (!response.ok) throw new Error('Command failed');
      const snapshot: unknown = await response.json();
      if (mounted.current && !controller.signal.aborted) ingest(snapshot);
    } catch { if (mounted.current) setActionError(true); }
    finally {
      window.clearTimeout(timeout);
      if (mutation.current === controller) { mutation.current = null; if (mounted.current) { setBusy(false); void load(); } }
    }
  }
  const self = state?.players.find(p => p.id === state.accountId);
  const room = state?.room;
  const activeRoom = room && room.status !== 'CANCELLED' ? room : null;
  const accepted = room ? [...room.teamA, ...room.teamB].filter(p => p.accepted).length : 0;
  const deadline = activeRoom?.status === 'PREPARING' ? activeRoom.preparationDeadline : activeRoom?.acceptanceDeadline;
  const remaining = deadline ? Math.max(0, Math.ceil((Date.parse(deadline) - now) / 1000)) : 0;
  const elapsed = state?.ticket ? Math.max(0, Math.floor((now - Date.parse(state.ticket.enteredAt)) / 1000)) : 0;
  return <div className="soloq-lab-scroll"><main className="soloq-lab">
    <header><div><p className="soloq-lab-brand">rbgs.io</p><h1>{c.title}</h1></div><LanguageMenu /></header>
    <p className="soloq-lab-banner">{c.banner}</p>
    <p>{c.instructions}</p>
    {(error || actionError) && <p role="alert">{state ? c.error : c.unavailable} <button onClick={() => { setActionError(false); void load(); }}>{c.retry}</button></p>}
    <section className="soloq-lab-controls" aria-label={c.setup}>
      <select aria-label={c.setup} disabled={busy} value={scenario} onChange={e => setScenario(e.target.value)}>
        <option value="NORMAL">{c.normal}</option><option value="NO_CAPTAINS">{c.noCaptains}</option><option value="NO_HEALERS">{c.noHealers}</option>
      </select>
      <button disabled={busy || !state} onClick={() => void command('/reset', { scenario })}>{busy ? c.busy : state?.generation ? c.reset : c.setup}</button>
      {state?.generation && <span className="soloq-lab-live" role="status">{connected ? c.live : c.fallback}</span>}
    </section>
    {state?.generation && self && <>
      <section className="soloq-lab-selection">
        <label>{c.actor}<select disabled={busy} value={self.id} onChange={e => void command('/actor', { accountId: e.target.value })}>
          {state.players.map(p => <option key={p.id} value={p.id}>{p.name} · {p.role}</option>)}
        </select></label>
        <RoleSelection fcIcon="tank" value={self.role} disabled={busy || !!state.ticket}
          onChange={role => void command('/selection', { role, captainConsent: self.captainConsent }, 'PUT')} />
        <label><input type="checkbox" checked={self.captainConsent} disabled={busy || !!state.ticket}
          onChange={e => void command('/selection', { role: self.role, captainConsent: e.target.checked }, 'PUT')} /> {c.captain}</label>
        <p className="soloq-lab-captain-rule">{c.captainRule}</p>
      </section>
      <section className="soloq-lab-search" aria-live="polite">
        <p>{c.depth}: <strong data-testid="queue-depth">{state.queueDepth}</strong></p>
        {!state.ticket && <><p>{c.idle}</p><button className="button" disabled={busy} onClick={() => void command('/queue')}>{c.enter}</button></>}
        {state.ticket?.state === 'QUEUED' && <><p data-testid="searching">{c.waiting} · {elapsed} {c.wait}</p>
          <button disabled={busy} onClick={() => void command(`/queue/${state.ticket!.id}`, undefined, 'DELETE')}>{c.cancel}</button></>}
        <div className="soloq-lab-test-actions">
          <button disabled={busy || !!activeRoom} onClick={() => void command('/players', { count: 19 })}>{c.add19}</button>
          <button disabled={busy || !!activeRoom} onClick={() => void command('/players', { count: 99 })}>{c.add99}</button>
        </div>
      </section>
      {room && <section className="soloq-lab-room" data-status={room.status} aria-labelledby="soloq-room-heading">
        <h2 id="soloq-room-heading">{room.status === 'PROPOSED' ? c.found : room.status === 'PREPARING' ? c.preparing : c.cancelled}</h2>
        <p>{c.acceptedCount}: <strong data-testid="accepted-count">{accepted}/20</strong>
          {activeRoom && <> · <span data-testid="room-countdown">{remaining} {c.seconds}</span></>}</p>
        {room.status === 'PREPARING' && <><p>{c.readyNote}</p><button disabled={busy} onClick={() => void command(`/rooms/${room.id}/response`, { accept: false })}>{c.end}</button></>}
        {room.status === 'CANCELLED' && <p>{room.cancellationReason === 'DEADLINE_EXPIRED' ? c.expired : c.declined}</p>}
        <div className="soloq-lab-teams">{[room.teamA, room.teamB].map((team, index) => <div key={index}>
          <h3>{c.team} {index === 0 ? 'A' : 'B'}</h3>
          <ol>{team.map(p => <li key={p.accountId} data-self={p.accountId === self.id}>
            <span>{p.captain && <span aria-label={c.captain}>♛ </span>}{p.name}</span><span>{p.role}</span><span aria-label={p.accepted ? c.accepted : undefined}>{p.accepted ? '✓' : '—'}</span>
          </li>)}</ol>
        </div>)}</div>
      </section>}
    </>}
    <MatchReadyDialog room={room ?? null} accountId={state?.accountId ?? null} serverTime={state?.serverTime ?? new Date().toISOString()}
      busy={busy} error={actionError ? c.error : undefined} onRespond={accept => room && void command(`/rooms/${room.id}/response`, {accept})}
      testControls={room && <button disabled={busy || remaining === 0} onClick={() => void command(`/rooms/${room.id}/test-acceptances`)}>{c.bots}</button>} />
  </main></div>;
}
