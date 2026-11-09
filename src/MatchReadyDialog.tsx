import { lazy, memo, Suspense, useEffect, useId, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { useLocale } from './locales';
import './MatchReadyDialog.css';
import { playMatchReadySound, prepareMatchReadySound } from './match-ready-sound';
import type { LightTunnelProps } from './vendor/light-tunnel/LightTunnel';

const LightTunnel = memo(lazy<ComponentType<LightTunnelProps>>(
  () => import('./vendor/light-tunnel/LightTunnel').catch(() => ({ default: () => null })),
));

export type QueueMember = { accountId: string; name: string; role: 'FC' | 'HEALER' | 'DPS'; captain: boolean; accepted: boolean };
export type QueueRoom = { id: string; source: 'SIMULATION' | 'FOREVER'; status: 'PROPOSED' | 'PREPARING' | 'CANCELLED' | 'PLAYING' | 'AWAITING_EVIDENCE' | 'UNDER_REVIEW' | 'RESOLVED';
  acceptanceDeadline: string; preparationDeadline: string | null; cancellationReason: string | null;
  version: number; teamA: QueueMember[]; teamB: QueueMember[]; preseasonPreview?: boolean };

export function MatchReadyDialog({ room, accountId, serverTime, busy, onRespond, testControls, error }: {
  room: QueueRoom | null; accountId: string | null; serverTime: string; busy: boolean;
  onRespond: (accept: boolean) => void; testControls?: ReactNode; error?: string;
}) {
  const id = useId();
  const { t } = useLocale();const dialog = useRef<HTMLDialogElement>(null);
  const [clock, setClock] = useState(Date.now());
  const active = room?.status === 'PROPOSED';
  const serverOffset = useRef(Date.parse(serverTime) - Date.now());
  useEffect(() => { serverOffset.current = Date.parse(serverTime) - Date.now(); setClock(Date.now()); }, [serverTime]);
  useEffect(() => {
    if (active && dialog.current && !dialog.current.open) dialog.current.showModal();
    if (!active) dialog.current?.close();
    if (!active) return;
    setClock(Date.now());const timer = window.setInterval(() => setClock(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, [active, room?.id]);
  useEffect(() => () => { dialog.current?.close(); }, []);
  const members = room ? [...room.teamA,...room.teamB] : [];
  const count = members.filter(m=>m.accepted).length;
  const own = members.find(m=>m.accountId===accountId);
  useEffect(prepareMatchReadySound, []);
  useEffect(() => {
    if (!active || !room || !accountId || !own || own.accepted) return;
    return playMatchReadySound(`${room.source}:${accountId}:${room.id}`,
      Date.parse(room.acceptanceDeadline) - serverOffset.current);
  }, [active, room?.id, room?.source, room?.acceptanceDeadline, accountId, own?.accepted]);
  const remainingSeconds = room ? Math.max(0, (Date.parse(room.acceptanceDeadline) - clock - serverOffset.current) / 1000) : 0;
  const seconds = Math.ceil(remainingSeconds);
  const ringOffset = 60 - Math.min(60, remainingSeconds);
  return <dialog ref={dialog} className="match-ready-dialog" aria-labelledby={id + "-title"} aria-describedby={id + "-description"}
    onCancel={event=>event.preventDefault()}>
    {active && <div className="match-ready-tunnel" aria-hidden="true">
      <Suspense fallback={null}>
        <LightTunnel key={room.id}
          cableColor="#000000" pulseColor="#dada19" cableCount={56} pulseDensity={0.3}
          flowDirection="inward" mouseInteraction clickSurge={false} tunnelColor="#e2e2e2" tunnelOpacity={0}
          speed={0.06} pulseSpeed={2} pulseLength={0.4} pulseBlend={0.6} pulseWidth={1}
          thickness={0.35} rimWidth={0.15} waviness={0.3} sway={0.8} bend={0.4} glow={1} size={1}
          fadeNear={0.5} fadeFar={2} brightness={0.65} colorVariance grain={false} mouseStrength={0.1}
          intro lightMode={false} dpr={1} />
      </Suspense>
    </div>}
    <div className="match-ready-panel">
      <h2 id={id + "-title"}>{t('matchReadyTitle')}</h2>
      <p id={id + "-description"}>{t(members.length === 1 ? 'testerConfirmIndividual' : own?.accepted ? 'matchReadyWaiting' : 'matchReadyConfirm')}</p>
      {room?.preseasonPreview && <p>{t('preseasonQueueHelp')}</p>}
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
        <button type="button" className="match-ready-accept" disabled={busy||!own||!!own.accepted||seconds===0} onClick={()=>onRespond(true)} autoFocus>{t(own?.accepted?'matchReadyAccepted':'matchReadyAccept')}</button>
        <button type="button" disabled={busy} onClick={()=>onRespond(false)}>{t('matchReadyDecline')}</button>
      </div>
      {seconds===0&&<p role="status">{t('matchReadyExpired')}</p>}
      {error&&<p role="alert">{error}</p>}
      {testControls&&<div className="match-ready-test-controls">{testControls}</div>}
    </div>
  </dialog>;
}
