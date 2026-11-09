import { useEffect,useState,type ReactNode } from 'react';
import { useLocale } from './locales';
import { usePremadeQueueSession, useSoloQueueSession } from './SoloQueueSession';
import './SoloQueuePanel.css';
import { Link } from './LocalizedLink';
import type { QueueRoom } from './MatchReadyDialog';
import type { MessageKey } from './locales/en';

export const roomTitles: Record<QueueRoom['status'], MessageKey> = {
  PROPOSED: 'matchReadyTitle',
  PREPARING: 'soloQueuePreparing',
  CANCELLED: 'soloQueueCancelled',
  PLAYING: 'premadeLabPlaying',
  AWAITING_EVIDENCE: 'premadeLabAwaitingEvidence',
  UNDER_REVIEW: 'premadeLabReview',
  RESOLVED: 'premadeLabResolved',
};

export function SoloQueuePanel({premade=false,roomDetails,showRoom=true}:{premade?:boolean;roomDetails?:ReactNode;showRoom?:boolean}) {
  const solo=useSoloQueueSession(),group=usePremadeQueueSession();const queue=premade?group:solo;const {t}=useLocale();const [now,setNow]=useState(Date.now());
  useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),1000);return()=>window.clearInterval(timer);},[]);
  if(!queue)return null;const status=queue.status;
  if(!status)return null;
  const lobbyChanged=premade&&status.ticket?.state==='CANCELLED'&&status.ticket.cancellationReason==='LOBBY_CHANGED';
  if (!status.room && status.ticket?.state !== 'QUEUED' && !lobbyChanged) return null;
  const elapsed=status.ticket?Math.max(0,Math.floor((now-Date.parse(status.ticket.enteredAt))/1000)):0;
  return <section className="solo-queue-panel" aria-label={t(premade?'premadeHeading':'soloHeading')}>
    {lobbyChanged&&<p role="status" data-testid="premade-lobby-changed">{t('premadeQueueLobbyChanged')}</p>}
    {status.ticket?.state==='QUEUED'&&<div className="solo-queue-search" role="status"><p>{t('soloQueueSearching')} · {elapsed}s</p>
      <button disabled={queue.busy || premade && !status.canControl} onClick={()=>void queue.cancel()}>{t('soloQueueCancel')}</button>{premade&&!status.canControl&&<p>{t('playLeaderStartsMatch')}</p>}</div>}
    {showRoom&&status.room&&<QueueRoomCard room={status.room}>
      {status.room.status==='PREPARING'&&!roomDetails&&<p>{t(status.room.preseasonPreview ? 'preseasonRoomHelp'
        : status.simulation ? 'premadeLabPrepared' : 'soloQueuePreparingHelp')}</p>}
      {status.room.status==='PREPARING'&&!status.simulation&&status.matchId&&<p>
        <Link to={'/match-history?match='+encodeURIComponent(status.matchId)}>{t('premadeOpenMatch')}</Link>{' · '}
        <a href="rbgs-companion://matches">{t('premadeOpenCompanion')}</a>
      </p>}
      {status.room.status==='CANCELLED'&&<p>{t(status.room.cancellationReason === 'PRESEASON_PREVIEW_COMPLETE'
        ? 'preseasonCompleteHelp' : 'soloQueueCancelledHelp')}</p>}
      {roomDetails}
    </QueueRoomCard>}
  </section>;
}

export function QueueRoomCard({room,children}:{room:QueueRoom;children:ReactNode}) {
  const {t}=useLocale();
  return <div className="solo-queue-room">
    <h2>{t(room.cancellationReason === 'PRESEASON_PREVIEW_COMPLETE' ? 'preseasonComplete'
      : room.preseasonPreview && room.status === 'PREPARING' ? 'preseasonRoomTitle' : roomTitles[room.status])}</h2>
    {children}
    <div className="solo-queue-teams">{[room.teamA,room.teamB].map((team,index)=><div key={index}><h3>{t('soloQueueTeam')} {index?'B':'A'}</h3>
      <ul>{team.map(m=><li key={m.accountId}><span>{m.captain?'♛ ':''}{m.name}</span><span>{m.role}</span><span>{m.accepted?'✓':'—'}</span></li>)}</ul></div>)}</div>
  </div>;
}
