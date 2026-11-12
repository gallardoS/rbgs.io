import { useEffect,useRef,useState,type ReactNode } from 'react';
import { useLocale } from './locales';
import { usePrivacy } from './Privacy';
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

export function SoloQueuePanel({premade=false,roomDetails,showRoom=true,showSearch=true}:{premade?:boolean;roomDetails?:ReactNode;showRoom?:boolean;showSearch?:boolean}) {
  const solo=useSoloQueueSession(),group=usePremadeQueueSession();const queue=premade?group:solo;const {t}=useLocale();const [now,setNow]=useState(Date.now());
  const searching = showSearch && queue?.status?.ticket?.state === 'QUEUED';
  const room = queue?.status?.room;
  const roomId = room?.id;
  const roomStatus = room?.status;
  const completed = room?.status === 'CANCELLED' && room.cancellationReason === 'PRESEASON_PREVIEW_COMPLETE';
  const preparingRoom = useRef<string | undefined>(undefined);
  const [completionNotice, setCompletionNotice] = useState<string>();
  useEffect(() => {
    const previous = preparingRoom.current;
    preparingRoom.current = roomStatus === 'PREPARING' ? roomId : undefined;
    if (!completed || !roomId || previous !== roomId) {
      setCompletionNotice(undefined);
      return;
    }
    setCompletionNotice(roomId);
    const timer = window.setTimeout(() => setCompletionNotice(undefined), 15_000);
    return () => window.clearTimeout(timer);
  }, [completed, roomId, roomStatus]);
  useEffect(()=>{
    if (!searching) return;
    setNow(Date.now());
    const timer=window.setInterval(()=>setNow(Date.now()),1000);
    return()=>window.clearInterval(timer);
  },[searching]);
  if(!queue)return null;const status=queue.status;
  if(!status)return null;
  const lobbyChanged=premade&&status.ticket?.state==='CANCELLED'&&status.ticket.cancellationReason==='LOBBY_CHANGED';
  const showCompletion = showRoom && completed && completionNotice === roomId;
  const displayedRoom = showRoom && !completed ? room : null;
  if (!displayedRoom && !showCompletion && !searching && !lobbyChanged) return null;
  const elapsed=status.ticket?Math.max(0,Math.floor((now-Date.parse(status.ticket.enteredAt))/1000)):0;
  return <section className="solo-queue-panel" aria-label={t(premade?'premadeHeading':'soloHeading')}>
    {lobbyChanged&&<p role="status" data-testid="premade-lobby-changed">{t('premadeQueueLobbyChanged')}</p>}
    {searching&&<div className="solo-queue-search" role="status"><p>{t('soloQueueSearching')} · {elapsed}s</p>
      <button disabled={queue.busy || premade && !status.canControl} onClick={()=>void queue.cancel()}>{t('soloQueueCancel')}</button>{premade&&!status.canControl&&<p>{t('playLeaderStartsMatch')}</p>}</div>}
    {showCompletion&&<div className="solo-queue-room" role="status">
      <h2>{t('preseasonComplete')}</h2>
      <p>{t('preseasonCompleteHelp')}</p>
    </div>}
    {displayedRoom&&<QueueRoomCard room={displayedRoom} accountId={queue.accountId}>
      {displayedRoom.status==='PREPARING'&&!roomDetails&&<p>{t(displayedRoom.preseasonPreview ? 'preseasonRoomHelp'
        : status.simulation ? 'premadeLabPrepared' : 'soloQueuePreparingHelp')}</p>}
      {displayedRoom.status==='PREPARING'&&!status.simulation&&status.matchId&&<p>
        <Link to={'/match-history?match='+encodeURIComponent(status.matchId)}>{t('premadeOpenMatch')}</Link>{' · '}
        <a href="rbgs-companion://matches">{t('premadeOpenCompanion')}</a>
      </p>}
      {displayedRoom.status==='CANCELLED'&&<p>{t('soloQueueCancelledHelp')}</p>}
      {roomDetails}
    </QueueRoomCard>}
  </section>;
}

export function QueueRoomCard({room,accountId,children}:{room:QueueRoom;accountId:string;children:ReactNode}) {
  const {t}=useLocale();
  const { formatBattleTag } = usePrivacy();
  return <div className="solo-queue-room">
    <h2>{t(room.cancellationReason === 'PRESEASON_PREVIEW_COMPLETE' ? 'preseasonComplete'
      : room.preseasonPreview && room.status === 'PREPARING' ? 'preseasonRoomTitle' : roomTitles[room.status])}</h2>
    {children}
    <div className="solo-queue-teams">{[room.teamA,room.teamB].map((team,index)=><div key={index}><h3>{t('soloQueueTeam')} {index?'B':'A'}</h3>
      <ul>{team.map(m=><li key={m.accountId}><span>{m.captain?'♛ ':''}{room.source === 'SIMULATION' ? formatBattleTag(m.name, m.accountId === accountId ? 'own' : 'others') : m.name}</span><span>{m.role}</span><span>{m.accepted?'✓':'—'}</span></li>)}</ul></div>)}</div>
  </div>;
}
