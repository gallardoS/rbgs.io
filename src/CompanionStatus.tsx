import {useEffect,useState} from 'react';
import {useLocale} from './locales';
import {Link} from './LocalizedLink';
import {preferredCompanion,selectCompanion} from './companion-link';
import './CompanionStatus.css';
type Device={id:string;name:string;connected:boolean;expiresAt:string;revokedAt:string|null;lastSeenAt:string|null};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function CompanionStatus({accountId}:{accountId:string}){
 const {t}=useLocale();const [devices,setDevices]=useState<Device[]|null>(null);const [failed,setFailed]=useState(false);const [preferred,setPreferred]=useState(()=>preferredCompanion(accountId));
 useEffect(()=>{let disposed=false;let timer:ReturnType<typeof setTimeout>;let controller:AbortController|null=null;
  async function read(){controller=new AbortController();const timeout=setTimeout(()=>controller?.abort(),8000);try{
   const response=await fetch('/api/v1/devices/me',{credentials:'same-origin',cache:'no-store',signal:controller.signal});if(!response.ok)throw Error();const list:unknown=await response.json();
   if(!Array.isArray(list)||!list.every(d=>d&&uuid.test(d.id)&&typeof d.name==='string'&&typeof d.connected==='boolean'&&Number.isFinite(Date.parse(d.expiresAt))&&(d.revokedAt===null||Number.isFinite(Date.parse(d.revokedAt)))&&(d.lastSeenAt===null||Number.isFinite(Date.parse(d.lastSeenAt)))))throw Error();
   if(!disposed){setDevices(list);setFailed(false);setPreferred(preferredCompanion(accountId));}
  }catch{if(!disposed){setFailed(true);setDevices(null);}}finally{clearTimeout(timeout);if(!disposed)timer=setTimeout(()=>void read(),10000);}}
  const changed=()=>setPreferred(preferredCompanion(accountId));window.addEventListener('rbgs-companion-device',changed);void read();
  return()=>{disposed=true;clearTimeout(timer);controller?.abort();window.removeEventListener('rbgs-companion-device',changed);};
 },[accountId]);
 const active=devices?.filter(d=>d.revokedAt===null&&Date.parse(d.expiresAt)>Date.now())??[];
 const selected=active.find(d=>d.id===preferred)??(active.length===1&&!preferred?active[0]:undefined);
 const online=selected?.connected===true;
 return <aside className={`companion-status ${online?'connected':''}`} aria-label={t('devicesHeading')}>
  <p role="status">{t(failed?'companionPresenceUnavailable':devices===null?'companionPresenceChecking':online?'companionPresenceConnected':!selected&&active.length>1?'companionChooseDevice':active.length===0?'companionPresenceUnpaired':'companionPresenceMissing')}{selected&&<> · {selected.name}</>}</p>
  {(active.length>1||active.length===1&&!selected)&&<label>{t('companionDevice')}<select value={selected?.id??''} onChange={e=>{selectCompanion(accountId,e.target.value);setPreferred(e.target.value);}}><option value="">{t('companionChooseDevice')}</option>{active.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>}
  {!online&&<div className="companion-status-actions"><a className="button" href="rbgs-companion://open">{t('companionOpen')}</a><Link to="/settings">{t('companionConnect')}</Link><Link to="/downloads">{t('navigationDownloads')}</Link></div>}
  {!online&&<p className="companion-status-hint">{t('companionOpenHint')}</p>}
 </aside>;
}
