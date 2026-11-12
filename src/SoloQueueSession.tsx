import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { MatchReadyDialog, type QueueRoom } from './MatchReadyDialog';
import { MessageNotification } from './FloatingNotifications';
import type { MessageKey } from './locales/en';
import { useLocale } from './locales';

export type SimulatedMatch = { captainAReady: boolean; captainBReady: boolean; assignment: string; winner: 'A' | 'B' | null };
export type FinishedRoomState = 'AWAITING_EVIDENCE' | 'UNDER_REVIEW' | 'RESOLVED';
export type RecentRoom = { id: string; status: FinishedRoomState; winner: SimulatedMatch['winner']; version: number };
export const isFinishedRoom = (status: unknown): status is FinishedRoomState =>
  status === 'AWAITING_EVIDENCE' || status === 'UNDER_REVIEW' || status === 'RESOLVED';
const isWinner = (winner: unknown) => winner === null || winner === 'A' || winner === 'B';

export function validSimulatedMatch(value: unknown): value is SimulatedMatch {
  if (!value || typeof value !== 'object') return false;
  const match = value as SimulatedMatch;
  return typeof match.captainAReady === 'boolean' && typeof match.captainBReady === 'boolean'
    && typeof match.assignment === 'string' && /^LAB:[0-9a-f-]{36}$/.test(match.assignment) && isWinner(match.winner);
}

export function validQueueRoom(value: unknown, simulation: boolean): value is QueueRoom {
  if (!value || typeof value !== 'object') return false;
  const room = value as QueueRoom;
  const member=(m:any)=>m&&typeof m.accountId==='string'&&typeof m.name==='string'&&['FC','HEALER','DPS'].includes(m.role)&&typeof m.captain==='boolean'&&typeof m.accepted==='boolean';
  return room.source === (simulation ? 'SIMULATION' : 'FOREVER') && typeof room.id === 'string'
    && (['PROPOSED','PREPARING','CANCELLED'].includes(room.status) || simulation && (room.status === 'PLAYING' || isFinishedRoom(room.status)))
    && Number.isFinite(Date.parse(room.acceptanceDeadline)) && Array.isArray(room.teamA) && room.teamA.length === 10 && room.teamA.every(member)
    && Array.isArray(room.teamB) && room.teamB.length === 10 && room.teamB.every(member);
}

export type SoloQueueStatus = { available: boolean; blockers: string[]; ticket: {
  id: string; state: 'QUEUED'|'PROPOSED'|'CANCELLED'; enteredAt: string; proposalId: string|null; version: number; cancellationReason: string|null
} | null; room: QueueRoom|null; matchId: string|null; serverTime: string; revision: string;
  simulation?: boolean; simulatedMatch?: SimulatedMatch | null; recentRooms?: RecentRoom[];
  groupId?: string|null; groupRevision?: number|null; captainId?: string|null; canControl?: boolean };
export function validSoloQueue(value: unknown, simulation = false): value is SoloQueueStatus {
  if(!value||typeof value!=='object')return false;
  const s=value as SoloQueueStatus;
  const match = s.simulatedMatch;
  const validMatch = match
    ? simulation && validSimulatedMatch(match)
      && typeof s.room?.preparationDeadline === 'string' && Number.isFinite(Date.parse(s.room.preparationDeadline))
    : match == null;
  const recent = s.recentRooms;
  const validRecent = recent === undefined || Array.isArray(recent) && recent.length <= (simulation ? 10 : 0)
    && recent.every(room => room && typeof room.id === 'string' && isFinishedRoom(room.status)
      && isWinner(room.winner) && Number.isSafeInteger(room.version));
  return typeof s.available==='boolean'&&Array.isArray(s.blockers)&&s.blockers.every(b=>typeof b==='string')&&typeof s.revision==='string'
    &&validMatch&&validRecent
    &&Number.isFinite(Date.parse(s.serverTime))&&(s.ticket===null||!!s.ticket&&typeof s.ticket.id==='string'&&['QUEUED','PROPOSED','CANCELLED'].includes(s.ticket.state)&&Number.isFinite(Date.parse(s.ticket.enteredAt)))
    &&(s.room===null||validQueueRoom(s.room,simulation)
      && (s.room.status !== 'PLAYING' && !isFinishedRoom(s.room.status) || !!match));
}
export type QueueSession = { accountId: string; status: SoloQueueStatus|null; busy: boolean; error: MessageKey|null; active: boolean;
  refresh: ()=>Promise<void>; enter: (request:{seasonId:string;seasonVersion:number;selectionVersion:number}|{groupId:string;groupRevision:number})=>Promise<void>;
  command:(path:string,method:string,body?:unknown)=>Promise<void>;
  cancel: ()=>Promise<void>; respond:(accept:boolean)=>Promise<void> };
const Context=createContext<QueueSession|null>(null);
const PremadeContext=createContext<QueueSession|null>(null);
export const useSoloQueueSession=()=>useContext(Context);
export const usePremadeQueueSession=()=>useContext(PremadeContext);
export function AuthenticatedPremadeQueue({accountId,children}:{accountId:string|null;children:ReactNode}) {
  return accountId?<PremadeQueueProvider key={accountId} accountId={accountId}>{children}</PremadeQueueProvider>:children;
}
export function PremadeQueueProvider({accountId,children,simulation=false}:{accountId:string;children:ReactNode;simulation?:boolean}) {
  return <ConnectedQueue accountId={accountId} premade simulation={simulation}>{children}</ConnectedQueue>;
}
export function AuthenticatedSoloQueue({accountId,children}:{accountId:string|null;children:ReactNode}) {
  return accountId?<ConnectedQueue key={accountId} accountId={accountId}>{children}</ConnectedQueue>:children;
}
function ConnectedQueue({accountId,children,premade=false,simulation=false}:{accountId:string;children:ReactNode;premade?:boolean;simulation?:boolean}) {
  const endpoint=premade?(simulation?'/api/v1/local/premade':'/api/v1/me/premade-queue'):'/api/v1/me/solo-queue';
  const Provider=premade?PremadeContext.Provider:Context.Provider;
  const statusError:MessageKey=premade?'premadeQueueStatusError':'soloQueueStatusError';
  const blockedError:MessageKey=premade?'premadeQueueBlocked':'soloQueueBlocked';
  const validate=(value:unknown):value is SoloQueueStatus=>validSoloQueue(value,simulation)&&(!premade||typeof value.canControl==='boolean'&&value.simulation===simulation&&(value.groupId===null||typeof value.groupId==='string')&&(value.groupRevision===null||Number.isSafeInteger(value.groupRevision)));
  const {t}=useLocale();
  const [status,setStatus]=useState<SoloQueueStatus|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState<MessageKey|null>(null);
  const [visible,setVisible]=useState(!document.hidden),[connected,setConnected]=useState(false);
  const mounted=useRef(false),mutation=useRef<AbortController|null>(null),read=useRef<AbortController|null>(null);
  const commandFailed=useRef(false);
  const latest=useRef(status);latest.current=status;
  const active=!!status?.ticket&&status.ticket.state!=='CANCELLED';
  const watch=active||premade&&!!status?.groupId;
  const refresh=useCallback(async()=>{
    if(mutation.current)return;
    read.current?.abort();const controller=new AbortController();read.current=controller;
    const timeout=window.setTimeout(()=>controller.abort(),10000);
    try {
      const response=await fetch(endpoint,{credentials:'same-origin',cache:'no-store',signal:controller.signal});
      if(!response.ok)throw Error();const body:unknown=await response.json();
      if(!validate(body)||body.room&&![...body.room.teamA,...body.room.teamB].some(m=>m.accountId===accountId))throw Error();
      if(mounted.current&&read.current===controller&&!controller.signal.aborted){setStatus(body);if(!commandFailed.current)setError(null);}
    }catch{if(mounted.current&&read.current===controller&&!controller.signal.aborted)setError(statusError);}
    finally{window.clearTimeout(timeout);if(mounted.current&&read.current===controller&&controller.signal.aborted)setError(statusError);}
  },[accountId,endpoint,simulation,premade,statusError]);
  useEffect(()=>{
    mounted.current=true;void refresh();const onVisible=()=>{setVisible(!document.hidden);if(!document.hidden)void refresh();};
    document.addEventListener('visibilitychange',onVisible);window.addEventListener('focus',onVisible);
    return()=>{mounted.current=false;read.current?.abort();mutation.current?.abort();mutation.current=null;document.removeEventListener('visibilitychange',onVisible);window.removeEventListener('focus',onVisible);};
  },[accountId,refresh]);
  useEffect(()=>{
    if(!visible||!watch){setConnected(false);return;}
    let receivedAt=Date.now();
    const source=new EventSource(endpoint+'/events');const ping=()=>{receivedAt=Date.now();setConnected(true);};const changed=()=>{ping();void refresh();};
    source.addEventListener('ping',ping);
    const watchdog=window.setInterval(()=>{if(Date.now()-receivedAt>25000)setConnected(false);},5000);
    source.addEventListener('ready',changed);source.addEventListener('changed',changed);source.onerror=()=>{setConnected(false);void refresh();};
    return()=>{window.clearInterval(watchdog);source.close();setConnected(false);};
  },[watch,visible,refresh]);
  useEffect(()=>{
    if(!visible)return;
    const timer=window.setInterval(()=>void refresh(),watch&&!connected?5000:60000);return()=>window.clearInterval(timer);
  },[visible,watch,connected,refresh]);
  async function command(path:string,method:string,body?:unknown) {
    if(mutation.current)return;
    read.current?.abort();read.current=null;
    const controller=new AbortController();mutation.current=controller;commandFailed.current=false;setBusy(true);setError(null);
    const timeout=window.setTimeout(()=>controller.abort(),10000);
    try {
      const cookie=(simulation?'RBGS_SOLOQ_LAB_XSRF':'XSRF-TOKEN')+'=';
      const token=document.cookie.split('; ').find(c=>c.startsWith(cookie))?.slice(cookie.length);if(!token)throw Error();
      const response=await fetch(endpoint+path,{method,credentials:'same-origin',cache:'no-store',signal:controller.signal,
        headers:{'X-XSRF-TOKEN':decodeURIComponent(token),...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});
      if(response.status===204)return;
      const snapshot:unknown=await response.json();
      if(![200,409].includes(response.status)||!validate(snapshot))throw Error();
      if(mounted.current&&!controller.signal.aborted){setStatus(snapshot);if(response.status===409)setError(blockedError);}
    }catch{commandFailed.current=true;if(mounted.current)setError(statusError);}
    finally{window.clearTimeout(timeout);if(mutation.current===controller){mutation.current=null;if(mounted.current){setBusy(false);void refresh();}}}
  }
  const session:QueueSession={accountId,status,busy,error,active,refresh,command,enter:request=>command('','POST',request),
    cancel:()=>latest.current?.ticket?command('/'+latest.current.ticket.id,'DELETE'):Promise.resolve(),
    respond:accept=>latest.current?.room?command('/rooms/'+latest.current.room.id+'/response','POST',{accept}):Promise.resolve()};
  return <Provider value={session}>{children}
    <MessageNotification message={error} />
    <MatchReadyDialog room={status?.room??null} accountId={accountId} serverTime={status?.serverTime??new Date().toISOString()} busy={busy} onRespond={accept=>void session.respond(accept)} error={error?t(error):undefined}
      testControls={simulation&&status?.room?.status==='PROPOSED'?<button disabled={busy} onClick={()=>void command('/rooms/'+status.room!.id+'/test-acceptances','POST')}>{t('premadeLabAcceptOthers')}</button>:undefined} />
  </Provider>;
}
