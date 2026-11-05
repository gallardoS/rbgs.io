import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale } from './locales';
import { LanguageMenu } from './LanguageMenu';
import { PremadeQueueProvider, usePremadeQueueSession } from './SoloQueueSession';
import { SoloQueuePanel } from './SoloQueuePanel';
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
      <Controls accountId={setup.accountId} depth={setup.queueDepth} configuring={busy} players={setup.players} />
    </PremadeQueueProvider>}
  </main></div>;
}
function Controls({accountId,depth,configuring,players}:{accountId:string;depth:number;configuring:boolean;players:Setup['players']}) {
  const queue=usePremadeQueueSession();const {t}=useLocale();if(!queue?.status)return <p>{t('soloQueueChecking')}</p>;
  const status=queue.status,busy=configuring||queue.busy;
  const active=queue.active;
  const replacement=players.find(p=>p.groupId===status.groupId&&p.id!==accountId&&!p.captain);
  const enter=()=>status.groupId!=null&&status.groupRevision!=null&&queue.enter({groupId:status.groupId,groupRevision:status.groupRevision});
  return <>
    <section className="soloq-lab-search">
      <p>{t('premadeLabDepth')}: <strong>{depth}</strong></p>
      <p>{t('premadeLabRoster')}: 10 · {status.captainId===accountId?'♛ '+t('groupYou'):t('playLeaderStartsMatch')}</p>
      {!active&&<button className="button" disabled={busy||!status.canControl||!status.available} onClick={()=>void enter()}>{t('findMatch')}</button>}
      <div className="soloq-lab-test-actions">
        <button disabled={busy||status.room?.status==='PROPOSED'||status.room?.status==='PREPARING'} onClick={()=>void queue.command('/opponents','POST',{count:1})}>{t('premadeLabAddOne')}</button>
        <button disabled={busy||status.room?.status==='PROPOSED'||status.room?.status==='PREPARING'} onClick={()=>void queue.command('/opponents','POST',{count:9})}>{t('premadeLabAddNine')}</button>
        {status.canControl&&replacement&&<button disabled={busy||status.room?.status==='PROPOSED'||status.room?.status==='PREPARING'} onClick={()=>void queue.command('/captain','POST',{accountId:replacement.id})}>{t('premadeLabChangeCaptain')}</button>}
      </div>
    </section>
    <SoloQueuePanel premade />
    {status.room?.status==='PREPARING'&&<button disabled={busy} onClick={()=>void queue.respond(false)}>{t('premadeLabEnd')}</button>}
  </>;
}
