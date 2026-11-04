import { useEffect,useState } from 'react';
import { useLocale } from './locales';
import { useSoloQueueSession } from './SoloQueueSession';
import './SoloQueuePanel.css';

export function SoloQueuePanel() {
  const queue=useSoloQueueSession();const {t}=useLocale();const [now,setNow]=useState(Date.now());
  useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),1000);return()=>window.clearInterval(timer);},[]);
  if(!queue)return null;const status=queue.status;
  if(!status)return <p className="availability">{t('soloQueueChecking')}</p>;
  if (!status.room && status.ticket?.state !== 'QUEUED') return null;
  const elapsed=status.ticket?Math.max(0,Math.floor((now-Date.parse(status.ticket.enteredAt))/1000)):0;
  return <section className="solo-queue-panel" aria-label={t('soloHeading')}>
    {status.ticket?.state==='QUEUED'&&<div className="solo-queue-search" role="status"><p>{t('soloQueueSearching')} · {elapsed}s</p>
      <button disabled={queue.busy} onClick={()=>void queue.cancel()}>{t('soloQueueCancel')}</button></div>}
    {status.room&&<div className="solo-queue-room"><h2>{t(status.room.status==='PROPOSED'?'matchReadyTitle':status.room.status==='PREPARING'?'soloQueuePreparing':'soloQueueCancelled')}</h2>
      {status.room.status==='PREPARING'&&<p>{t('soloQueuePreparingHelp')}</p>}
      {status.room.status==='CANCELLED'&&<p>{t('soloQueueCancelledHelp')}</p>}
      <div className="solo-queue-teams">{[status.room.teamA,status.room.teamB].map((team,index)=><div key={index}><h3>{t('soloQueueTeam')} {index?'B':'A'}</h3>
        <ul>{team.map(m=><li key={m.accountId}><span>{m.captain?'♛ ':''}{m.name}</span><span>{m.role}</span><span>{m.accepted?'✓':'—'}</span></li>)}</ul></div>)}</div>
    </div>}
  </section>;
}
