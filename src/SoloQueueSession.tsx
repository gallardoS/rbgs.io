import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { MatchReadyDialog, type QueueRoom } from './MatchReadyDialog';
import { MessageNotification } from './FloatingNotifications';
import type { MessageKey } from './locales/en';
import { useLocale } from './locales';

export type SoloQueueStatus = { available: boolean; blockers: string[]; ticket: {
  id: string; state: 'QUEUED'|'PROPOSED'|'CANCELLED'; enteredAt: string; proposalId: string|null; version: number; cancellationReason: string|null
} | null; room: QueueRoom|null; matchId: string|null; serverTime: string; revision: string };
export function validSoloQueue(value: unknown): value is SoloQueueStatus {
  if(!value||typeof value!=='object')return false;
  const s=value as SoloQueueStatus;
  const member=(m:any)=>m&&typeof m.accountId==='string'&&typeof m.name==='string'&&['FC','HEALER','DPS'].includes(m.role)&&typeof m.captain==='boolean'&&typeof m.accepted==='boolean';
  return typeof s.available==='boolean'&&Array.isArray(s.blockers)&&s.blockers.every(b=>typeof b==='string')&&typeof s.revision==='string'
    &&Number.isFinite(Date.parse(s.serverTime))&&(s.ticket===null||!!s.ticket&&typeof s.ticket.id==='string'&&['QUEUED','PROPOSED','CANCELLED'].includes(s.ticket.state)&&Number.isFinite(Date.parse(s.ticket.enteredAt)))
    &&(s.room===null||!!s.room&&s.room.source==='FOREVER'&&typeof s.room.id==='string'&&['PROPOSED','PREPARING','CANCELLED'].includes(s.room.status)
      &&Number.isFinite(Date.parse(s.room.acceptanceDeadline))&&Array.isArray(s.room.teamA)&&s.room.teamA.length===10&&s.room.teamA.every(member)
      &&Array.isArray(s.room.teamB)&&s.room.teamB.length===10&&s.room.teamB.every(member));
}
type Session = { status: SoloQueueStatus|null; busy: boolean; error: MessageKey|null; active: boolean;
  refresh: ()=>Promise<void>; enter: (request:{seasonId:string;seasonVersion:number;selectionVersion:number})=>Promise<void>;
  cancel: ()=>Promise<void>; respond:(accept:boolean)=>Promise<void> };
const Context=createContext<Session|null>(null);
export const useSoloQueueSession=()=>useContext(Context);
export function AuthenticatedSoloQueue({accountId,children}:{accountId:string|null;children:ReactNode}) {
  return accountId?<ConnectedSoloQueue key={accountId} accountId={accountId}>{children}</ConnectedSoloQueue>:children;
}
function ConnectedSoloQueue({accountId,children}:{accountId:string;children:ReactNode}) {
  const {t}=useLocale();
  const [status,setStatus]=useState<SoloQueueStatus|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState<MessageKey|null>(null);
  const [visible,setVisible]=useState(!document.hidden),[connected,setConnected]=useState(false);
  const mounted=useRef(false),mutation=useRef<AbortController|null>(null),read=useRef<AbortController|null>(null);
  const commandFailed=useRef(false);
  const latest=useRef(status);latest.current=status;
  const active=!!status?.ticket&&status.ticket.state!=='CANCELLED';
  const refresh=useCallback(async()=>{
    if(mutation.current)return;
    read.current?.abort();const controller=new AbortController();read.current=controller;
    const timeout=window.setTimeout(()=>controller.abort(),10000);
    try {
      const response=await fetch('/api/v1/me/solo-queue',{credentials:'same-origin',cache:'no-store',signal:controller.signal});
      if(!response.ok)throw Error();const body:unknown=await response.json();
      if(!validSoloQueue(body)||body.room&&![...body.room.teamA,...body.room.teamB].some(m=>m.accountId===accountId))throw Error();
      if(mounted.current&&read.current===controller&&!controller.signal.aborted){setStatus(body);if(!commandFailed.current)setError(null);}
    }catch{if(mounted.current&&read.current===controller&&!controller.signal.aborted)setError('soloQueueStatusError');}
    finally{window.clearTimeout(timeout);if(mounted.current&&read.current===controller&&controller.signal.aborted)setError('soloQueueStatusError');}
  },[accountId]);
  useEffect(()=>{
    mounted.current=true;void refresh();const onVisible=()=>{setVisible(!document.hidden);if(!document.hidden)void refresh();};
    document.addEventListener('visibilitychange',onVisible);window.addEventListener('focus',onVisible);
    return()=>{mounted.current=false;read.current?.abort();mutation.current?.abort();mutation.current=null;document.removeEventListener('visibilitychange',onVisible);window.removeEventListener('focus',onVisible);};
  },[accountId,refresh]);
  useEffect(()=>{
    if(!visible||!active){setConnected(false);return;}
    let receivedAt=Date.now();
    const source=new EventSource('/api/v1/me/solo-queue/events');const ping=()=>{receivedAt=Date.now();setConnected(true);};const changed=()=>{ping();void refresh();};
    source.addEventListener('ping',ping);
    const watchdog=window.setInterval(()=>{if(Date.now()-receivedAt>25000)setConnected(false);},5000);
    source.addEventListener('ready',changed);source.addEventListener('changed',changed);source.onerror=()=>{setConnected(false);void refresh();};
    return()=>{window.clearInterval(watchdog);source.close();setConnected(false);};
  },[active,visible,refresh]);
  useEffect(()=>{
    if(!visible)return;
    const timer=window.setInterval(()=>void refresh(),active&&!connected?5000:60000);return()=>window.clearInterval(timer);
  },[visible,active,connected,refresh]);
  async function command(path:string,method:string,body?:unknown) {
    if(mutation.current)return;
    read.current?.abort();read.current=null;
    const controller=new AbortController();mutation.current=controller;commandFailed.current=false;setBusy(true);setError(null);
    const timeout=window.setTimeout(()=>controller.abort(),10000);
    try {
      const token=document.cookie.split('; ').find(c=>c.startsWith('XSRF-TOKEN='))?.slice(11);if(!token)throw Error();
      const response=await fetch('/api/v1/me/solo-queue'+path,{method,credentials:'same-origin',cache:'no-store',signal:controller.signal,
        headers:{'X-XSRF-TOKEN':decodeURIComponent(token),...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});
      if(response.status===204)return;
      const snapshot:unknown=await response.json();
      if(![200,409].includes(response.status)||!validSoloQueue(snapshot))throw Error();
      if(mounted.current&&!controller.signal.aborted){setStatus(snapshot);if(response.status===409)setError('soloQueueBlocked');}
    }catch{commandFailed.current=true;if(mounted.current)setError('soloQueueStatusError');}
    finally{window.clearTimeout(timeout);if(mutation.current===controller){mutation.current=null;if(mounted.current){setBusy(false);void refresh();}}}
  }
  const session:Session={status,busy,error,active,refresh,enter:request=>command('','POST',request),
    cancel:()=>latest.current?.ticket?command('/'+latest.current.ticket.id,'DELETE'):Promise.resolve(),
    respond:accept=>latest.current?.room?command('/rooms/'+latest.current.room.id+'/response','POST',{accept}):Promise.resolve()};
  return <Context.Provider value={session}>{children}
    <MessageNotification message={error} />
    <MatchReadyDialog room={status?.room??null} accountId={accountId} serverTime={status?.serverTime??new Date().toISOString()} busy={busy} onRespond={accept=>void session.respond(accept)} error={error?t(error):undefined} />
  </Context.Provider>;
}
