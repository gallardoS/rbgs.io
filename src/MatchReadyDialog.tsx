import { lazy, memo, Suspense, useEffect, useId, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { useLocale } from './locales';
import './MatchReadyDialog.css';
import { playMatchReadySound, prepareMatchReadySound } from './match-ready-sound';
import type { GalaxyProps } from './vendor/galaxy/Galaxy';

const Galaxy = memo(lazy<ComponentType<GalaxyProps>>(
  () => import('./vendor/galaxy/Galaxy').catch(() => ({ default: () => null })),
));
const starColors = ['#facc15'];
const acceptWarpMs = 320;

export type QueueMember = { accountId: string; name: string; role: 'FC' | 'HEALER' | 'DPS'; captain: boolean; accepted: boolean; testBot?: boolean };
export type QueueRoom = { id: string; source: 'SIMULATION' | 'FOREVER'; status: 'PROPOSED' | 'PREPARING' | 'CANCELLED' | 'PLAYING' | 'AWAITING_EVIDENCE' | 'UNDER_REVIEW' | 'RESOLVED';
  acceptanceDeadline: string; preparationDeadline: string | null; cancellationReason: string | null;
  version: number; teamA: QueueMember[]; teamB: QueueMember[]; preseasonPreview?: boolean };

export function MatchReadyDialog({ room, accountId, serverTime, busy, onRespond, testControls, error }: {
  room: QueueRoom | null; accountId: string | null; serverTime: string; busy: boolean;
  onRespond: (accept: boolean) => void; testControls?: ReactNode; error?: string;
}) {
  const id = useId();
  const { t } = useLocale();const dialog = useRef<HTMLDialogElement>(null);
  const warp = useRef<(() => boolean) | null>(null);
  const [warpRoom, setWarpRoom] = useState<QueueRoom | null>(null);
  const [clock, setClock] = useState(Date.now());
  const active = room?.status === 'PROPOSED';
  const visibleRoom = active ? room : warpRoom;
  const visible = visibleRoom !== null;
  const serverOffset = useRef(Date.parse(serverTime) - Date.now());
  useEffect(() => { serverOffset.current = Date.parse(serverTime) - Date.now(); setClock(Date.now()); }, [serverTime]);
  useEffect(() => {
    if (visible && dialog.current && !dialog.current.open) dialog.current.showModal();
    if (!visible) dialog.current?.close();
  }, [visible]);
  useEffect(() => {
    if (!warpRoom) return;
    const timer = window.setTimeout(() => setWarpRoom(null), acceptWarpMs);
    return () => window.clearTimeout(timer);
  }, [warpRoom]);
  useEffect(() => {
    if (!active) return;
    setClock(Date.now());const timer = window.setInterval(() => setClock(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, [active, room?.id]);
  useEffect(() => () => { dialog.current?.close(); }, []);
  const shownRoom = visibleRoom ?? room;
  const members = shownRoom ? [...shownRoom.teamA,...shownRoom.teamB] : [];
  const count = members.filter(m=>m.accepted).length;
  const testBots = members.filter(member => member.testBot).length;
  const own = members.find(m=>m.accountId===accountId);
  useEffect(prepareMatchReadySound, []);
  useEffect(() => {
    if (!active || !room || !accountId || !own || own.accepted) return;
    return playMatchReadySound(`${room.source}:${accountId}:${room.id}`,
      Date.parse(room.acceptanceDeadline) - serverOffset.current);
  }, [active, room?.id, room?.source, room?.acceptanceDeadline, accountId, own?.accepted]);
  const remainingSeconds = shownRoom ? Math.max(0, (Date.parse(shownRoom.acceptanceDeadline) - clock - serverOffset.current) / 1000) : 0;
  const seconds = Math.ceil(remainingSeconds);
  const ringOffset = 60 - Math.min(60, remainingSeconds);
  const responding = busy || !active || warpRoom?.id === room?.id;
  const canRespond = !responding && !!own && !own.accepted && seconds > 0;
  function accept() {
    if (!active || !canRespond) return;
    onRespond(true);
    if (warp.current?.()) setWarpRoom(room);
  }
  return <dialog ref={dialog} className="match-ready-dialog" aria-labelledby={id + "-title"} aria-describedby={id + "-description"}
    onCancel={event=>event.preventDefault()}>
    {visibleRoom && <div className="match-ready-effect" aria-hidden="true">
      <Suspense fallback={null}>
        <Galaxy key={visibleRoom.id}
          density={1.3} glowIntensity={0.23} flareIntensity={0} starSpeed={0.25}
          mouseRepulsion={false} clickWarp={false} warpRef={warp} starColors={starColors}
          starSize={1} twinkleIntensity={0} speed={1} rotationSpeed={0.04} layers={4}
          direction="forward" repulsionStrength={2} mouseInteraction intro lightMode={false} dpr={1} />
      </Suspense>
    </div>}
    <div className="match-ready-panel">
      <h2 id={id + "-title"}>{t('matchReadyTitle')}</h2>
      <p id={id + "-description"}>{t(members.length === 1 ? 'testerConfirmIndividual' : own?.accepted ? 'matchReadyWaiting' : 'matchReadyConfirm')}</p>
      {shownRoom?.preseasonPreview && <p>{t('preseasonQueueHelp')}</p>}
      {testBots > 0 && <p>{t('testerPreseasonBotsInMatch').replace('{count}', String(testBots))}</p>}
      <div className="match-ready-clock">
        <svg className="match-ready-ring" viewBox="0 0 128 128" aria-hidden="true">
          <circle className="match-ready-ring-track" cx="64" cy="64" r="62.5" />
          <circle className="match-ready-ring-progress" cx="64" cy="64" r="62.5" pathLength="60"
            strokeDasharray="60" strokeDashoffset={ringOffset} />
        </svg>
        <strong>{seconds}</strong><span>{t('matchReadySeconds')}</span>
      </div>
      {members.length > 1 && <p className="match-ready-count" role="status">{t('matchReadyCount').replace('{count}',String(count))}</p>}
      {members.length > 1 && <div className="match-ready-slots" aria-hidden="true">{members.map(m=><span key={m.accountId} data-accepted={m.accepted} data-own={m.accountId===accountId} />)}</div>}
      <div className="match-ready-actions">
        <button type="button" className="match-ready-accept" disabled={!canRespond} onClick={accept} autoFocus>{t(own?.accepted?'matchReadyAccepted':'matchReadyAccept')}</button>
        <button type="button" disabled={!canRespond} onClick={()=>{ if (canRespond) onRespond(false); }}>{t('matchReadyDecline')}</button>
      </div>
      {seconds===0&&<p role="status">{t('matchReadyExpired')}</p>}
      {error&&<p role="alert">{error}</p>}
      {active&&testControls&&<div className="match-ready-test-controls">{testControls}</div>}
    </div>
  </dialog>;
}
