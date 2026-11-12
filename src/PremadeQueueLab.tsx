import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLocale } from './locales';
import { usePrivacy } from './Privacy';
import { LanguageMenu } from './LanguageMenu';
import { isFinishedRoom, PremadeQueueProvider, usePremadeQueueSession, validQueueRoom, validSimulatedMatch } from './SoloQueueSession';
import { QueueRoomCard, roomTitles, SoloQueuePanel } from './SoloQueuePanel';
import type { QueueRoom } from './MatchReadyDialog';
import type { SimulatedMatch } from './SoloQueueSession';
import './SoloQueueLab.css';

type Setup = { generation:string|null; accountId:string|null; queueDepth:number;
  players:{id:string;name:string;groupId:string;captain:boolean}[] };
const endpoint='/api/v1/local/premade';
function validSetup(value:unknown):value is Setup {
  if(!value||typeof value!=='object')return false;const s=value as Setup;
  return (s.generation===null||typeof s.generation==='string')&&(s.accountId===null||typeof s.accountId==='string')
    &&Number.isSafeInteger(s.queueDepth)&&s.queueDepth>=0&&Array.isArray(s.players)
    &&s.players.every(p=>p&&typeof p.id==='string'&&typeof p.name==='string'&&typeof p.groupId==='string'&&typeof p.captain==='boolean')
    &&(s.accountId===null||s.players.some(p=>p.id===s.accountId));
}
export function PremadeQueueLabPage() {
  const {t,language}=useLocale();const [setup,setSetup]=useState<Setup|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(false);
  const mounted=useRef(false),read=useRef<AbortController|null>(null),mutation=useRef<AbortController|null>(null);
  const load=useCallback(async()=>{
    if(mutation.current||document.hidden)return;read.current?.abort();const controller=new AbortController();read.current=controller;
    const timer=window.setTimeout(()=>controller.abort(),10000);
    try {
      const response=await fetch(endpoint+'/setup',{credentials:'same-origin',cache:'no-store',signal:controller.signal});
      if(!response.ok)throw Error();const body:unknown=await response.json();if(!validSetup(body))throw Error();
      if(mounted.current&&read.current===controller&&!controller.signal.aborted){setSetup(body);setError(false);}
    }catch{if(mounted.current&&read.current===controller&&!controller.signal.aborted)setError(true);}
    finally{window.clearTimeout(timer);if(mounted.current&&read.current===controller&&controller.signal.aborted)setError(true);}
  },[]);
  useEffect(()=>{
    mounted.current=true;void load();const timer=window.setInterval(()=>void load(),5000);
    return()=>{mounted.current=false;window.clearInterval(timer);read.current?.abort();mutation.current?.abort();};
  },[load]);
  useEffect(()=>{document.title=t('premadeLabTitle')+' | rbgs.io';document.querySelector('meta[name="robots"]')?.setAttribute('content','noindex, nofollow');},[language]);
  async function configure(path:string,body?:unknown) {
    if(mutation.current)return;read.current?.abort();read.current=null;
    const controller=new AbortController();mutation.current=controller;setBusy(true);setError(false);
    const timer=window.setTimeout(()=>controller.abort(),20000);
    try {
      const cookie='RBGS_SOLOQ_LAB_XSRF=';const token=document.cookie.split('; ').find(c=>c.startsWith(cookie))?.slice(cookie.length);
      if(!token)throw Error();
      const response=await fetch(endpoint+path,{method:'POST',credentials:'same-origin',cache:'no-store',signal:controller.signal,
        headers:{'X-XSRF-TOKEN':decodeURIComponent(token),...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});
      if(!response.ok)throw Error();const result:unknown=await response.json();if(!validSetup(result))throw Error();
      if(mounted.current&&!controller.signal.aborted)setSetup(result);
    }catch{if(mounted.current)setError(true);}
    finally{window.clearTimeout(timer);mutation.current=null;if(mounted.current){setBusy(false);void load();}}
  }
  return <div className="soloq-lab-scroll"><main className="soloq-lab">
    <header><div><p className="soloq-lab-brand">rbgs.io</p><h1>{t('premadeLabTitle')}</h1></div><LanguageMenu /></header>
    <p className="soloq-lab-banner">{t('premadeLabBanner')}</p><p>{t('premadeLabInstructions')}</p>
    {error&&<p role="alert">{t('premadeQueueStatusError')} <button onClick={()=>void load()}>{t('charactersRetry')}</button></p>}
    <section className="soloq-lab-controls">
      <button disabled={busy||!setup} onClick={()=>void configure('/reset')}>{t('premadeLabReset')}</button>
      {setup?.accountId&&<label>{t('premadeLabActor')} <select disabled={busy} value={setup.accountId} onChange={e=>void configure('/actor',{accountId:e.target.value})}>
        {setup.players.map(p=><option key={p.id} value={p.id}>{p.captain?'♛ ':''}{p.name}</option>)}
      </select></label>}
    </section>
    {setup?.accountId&&<PremadeQueueProvider key={setup.generation+':'+setup.accountId} accountId={setup.accountId} simulation>
      <Controls accountId={setup.accountId} depth={setup.queueDepth} configuring={busy} players={setup.players}
        switchActor={id=>void configure('/actor',{accountId:id})} />
    </PremadeQueueProvider>}
  </main></div>;
}
function Controls({accountId,depth,configuring,players,switchActor}:{accountId:string;depth:number;configuring:boolean;players:Setup['players'];switchActor:(id:string)=>void}) {
  const queue=usePremadeQueueSession();
  const {t}=useLocale();
  const [params,setParams]=useSearchParams();
  const selectedRoom=params.get('room');
  if(!queue?.status)return <p>{t('soloQueueChecking')}</p>;
  const status=queue.status,busy=configuring||queue.busy;
  const active=queue.active;
  const replacement=players.find(p=>p.groupId===status.groupId&&p.id!==accountId&&!p.captain);
  const enter=()=>status.groupId!=null&&status.groupRevision!=null&&queue.enter({groupId:status.groupId,groupRevision:status.groupRevision});
  const pastRooms=status.recentRooms?.filter(room=>room.id!==status.room?.id||room.id===selectedRoom)??[];
  function selectRoom(id: string | null) {
    const next=new URLSearchParams(params);
    if(id)next.set('room',id);
    else next.delete('room');
    setParams(next);
  }
  const advance=(id:string,action:MatchAction,winner?:'A'|'B')=>
    void queue.command('/rooms/'+id+'/simulation','POST',{action,winner});
  return <>
    <section className="soloq-lab-search">
      <p>{t('premadeLabDepth')}: <strong>{depth}</strong></p>
      <p>{t('premadeLabRoster')}: 10 · {status.captainId===accountId?'♛ '+t('groupYou'):t('playLeaderStartsMatch')}</p>
      {!active&&<button className="button" disabled={busy||!status.canControl||!status.available} onClick={()=>void enter()}>{t('findMatch')}</button>}
      <div className="soloq-lab-test-actions">
        <button disabled={busy||status.ticket?.state==='PROPOSED'} onClick={()=>void queue.command('/opponents','POST',{count:1})}>{t('premadeLabAddOne')}</button>
        <button disabled={busy||status.ticket?.state==='PROPOSED'} onClick={()=>void queue.command('/opponents','POST',{count:9})}>{t('premadeLabAddNine')}</button>
        {status.canControl&&replacement&&<button disabled={busy||status.ticket?.state==='PROPOSED'} onClick={()=>void queue.command('/captain','POST',{accountId:replacement.id})}>{t('premadeLabChangeCaptain')}</button>}
      </div>
    </section>
    <SoloQueuePanel premade showRoom={!selectedRoom} roomDetails={status.room&&status.simulatedMatch&&<SimulatedRoom key={status.room.id}
      room={status.room} match={status.simulatedMatch} accountId={accountId} serverTime={status.serverTime} busy={busy}
      switchActor={switchActor} cancel={()=>void queue.respond(false)}
      advance={(action,winner)=>advance(status.room!.id,action,winner)} />} />
    {(pastRooms.length>0||selectedRoom)&&<section className="soloq-lab-room" aria-labelledby="premade-recent-title">
      <h2 id="premade-recent-title">{t('premadeLabRecentRooms')}</h2>
      <ul className="premade-recent-rooms">
        {pastRooms.map(room=><li key={room.id}>
          <button disabled={busy} aria-pressed={selectedRoom===room.id} onClick={()=>selectRoom(room.id)}>
            <strong>Warsong Gulch · {room.id.slice(0,8)}</strong>
            <span>{t(roomTitles[room.status])}</span>
          </button>
        </li>)}
      </ul>
      {selectedRoom&&<>
        <button disabled={busy} onClick={()=>selectRoom(null)}>{t('premadeLabBackToQueue')}</button>
        <PastRoom key={selectedRoom} id={selectedRoom} accountId={accountId} busy={busy}
          version={status.recentRooms?.find(room=>room.id===selectedRoom)?.version}
          advance={(action,winner)=>advance(selectedRoom,action,winner)} />
      </>}
    </section>}
  </>;
}

type MatchAction = 'READY' | 'END_PLAY' | 'SUBMIT_EVIDENCE' | 'RESOLVE';
type Advance = (action:MatchAction,winner?:'A'|'B')=>void;
type PastRoomSnapshot = {room:QueueRoom;simulatedMatch:SimulatedMatch;serverTime:string};

function PastRoom({id,accountId,busy,version,advance}: {
  id:string;accountId:string;busy:boolean;version:number|undefined;advance:Advance;
}) {
  const {t}=useLocale();
  const [state,setState]=useState<PastRoomSnapshot | 'unavailable' | null>(null);
  useEffect(()=>{
    if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(id)) {
      setState('unavailable');
      return;
    }
    let active=true;
    let pending:AbortController|undefined;
    async function load() {
      pending?.abort();
      const controller=new AbortController();
      pending=controller;
      const timeout=window.setTimeout(()=>controller.abort(),8000);
      try {
        const response=await fetch(endpoint+'/rooms/'+id,{cache:'no-store',signal:controller.signal});
        if(!response.ok)throw Error();
        const snapshot:PastRoomSnapshot=await response.json();
        if(!validQueueRoom(snapshot?.room,true)||snapshot.room.id!==id||!isFinishedRoom(snapshot.room.status)
          ||!validSimulatedMatch(snapshot.simulatedMatch)||!Number.isFinite(Date.parse(snapshot.serverTime))
          ||![...snapshot.room.teamA,...snapshot.room.teamB].some(member=>member.accountId===accountId))throw Error();
        if(active&&pending===controller)setState(snapshot);
      }catch{
        if(active&&pending===controller)setState('unavailable');
      }finally{window.clearTimeout(timeout);}
    }
    void load();
    const timer=window.setInterval(()=>{if(!document.hidden)void load();},10000);
    return()=>{active=false;pending?.abort();window.clearInterval(timer);};
  },[id,accountId,version]);
  if(!state)return <p role="status">{t('soloQueueChecking')}</p>;
  if(state==='unavailable')return <p role="status">{t('premadeLabRoomUnavailable')}</p>;
  return <div className="premade-past-room"><QueueRoomCard room={state.room} accountId={accountId}>
    <SimulatedRoom room={state.room} match={state.simulatedMatch} accountId={accountId}
      serverTime={state.serverTime} busy={busy} advance={advance} />
  </QueueRoomCard></div>;
}

function SimulatedRoom({room,match,accountId,serverTime,busy,switchActor,cancel,advance}: {
  room:QueueRoom; match:SimulatedMatch; accountId:string; serverTime:string; busy:boolean;
  switchActor?:(id:string)=>void; cancel?:()=>void; advance:Advance;
}) {
  const {t}=useLocale();
  const [now,setNow]=useState(Date.now);
  const [winner,setWinner]=useState<'A'|'B'>('A');
  const winnerId=useId();
  const offset=useMemo(()=>Date.parse(serverTime)-Date.now(),[serverTime]);
  const preparing=room.status==='PREPARING';
  useEffect(()=>{
    if(!preparing)return;
    setNow(Date.now());
    const timer=window.setInterval(()=>setNow(Date.now()),1000);
    return()=>window.clearInterval(timer);
  },[preparing,serverTime]);
  const seconds=Math.max(0,Math.ceil((Date.parse(room.preparationDeadline??'')-now-offset)/1000));
  const captainA=room.teamA.find(player=>player.captain);
  const captainB=room.teamB.find(player=>player.captain);
  const isCaptainA=captainA?.accountId===accountId;
  const isCaptain=isCaptainA||captainB?.accountId===accountId;
  const ownReady=isCaptainA?match.captainAReady:match.captainBReady;
  const otherCaptain=isCaptainA?captainB:captainA;
  const { formatBattleTag } = usePrivacy();
  return <div className="premade-simulated-room">
    <p className="premade-room-map">Warsong Gulch</p>
    {preparing&&<>
      <p>{t('premadeLabPrepareTeams')} <strong>{Math.floor(seconds/60)}:{String(seconds%60).padStart(2,'0')}</strong></p>
      <ul className="premade-room-captains">
        {[{team:'A',captain:captainA,ready:match.captainAReady},{team:'B',captain:captainB,ready:match.captainBReady}].map(({team,captain,ready})=>
          <li key={team}><span>♛ {captain && formatBattleTag(captain.name, captain.accountId === accountId ? 'own' : 'others')}</span><strong data-ready={ready}>{t(ready?'premadeLabCaptainReady':'premadeLabCaptainWaiting')}</strong></li>)}
      </ul>
    </>}
    {(preparing||room.status==='PLAYING')&&<p className="premade-room-assignment">
      <label>{t('premadeLabAssignment')} <input readOnly value={match.assignment} onFocus={event=>event.currentTarget.select()} /></label>
    </p>}
    {match.winner&&<p role="status">{t('premadeLabWinner').replace('{team}',match.winner)}</p>}
    <div className="soloq-lab-test-actions">
      {preparing&&<>
        {isCaptain&&<button disabled={busy||ownReady||seconds===0} onClick={()=>advance('READY')}>{t(ownReady?'premadeLabCaptainReady':'premadeLabConfirmPreparation')}</button>}
        {otherCaptain&&switchActor&&<button disabled={busy||seconds===0} onClick={()=>switchActor(otherCaptain.accountId)}>{t('premadeLabSwitchCaptain')}</button>}
        {cancel&&<button disabled={busy||seconds===0} onClick={cancel}>{t('premadeLabEnd')}</button>}
      </>}
      {isCaptain&&room.status==='PLAYING'&&<button disabled={busy} onClick={()=>advance('END_PLAY')}>{t('premadeLabEndPlay')}</button>}
      {isCaptain&&room.status==='AWAITING_EVIDENCE'&&<>
        <label htmlFor={winnerId}>{t('premadeLabSelectWinner')}</label>
        <select id={winnerId} value={winner} disabled={busy} onChange={event=>setWinner(event.target.value==='B'?'B':'A')}>
          <option value="A">{t('soloQueueTeam')} A</option><option value="B">{t('soloQueueTeam')} B</option>
        </select>
        <button disabled={busy} onClick={()=>advance('SUBMIT_EVIDENCE',winner)}>{t('premadeLabSubmitEvidence')}</button>
      </>}
      {isCaptain&&room.status==='UNDER_REVIEW'&&<button disabled={busy} onClick={()=>advance('RESOLVE')}>{t('premadeLabResolve')}</button>}
    </div>
  </div>;
}
