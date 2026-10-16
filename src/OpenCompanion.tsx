import {useEffect,useRef,useState} from 'react';
import {useLocale} from './locales';
import {selectCompanion} from './companion-link';
import type {MessageKey} from './locales/en';
import './OpenCompanion.css';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function OpenCompanion({accountId,compact=false,onConnected}:{accountId:string;compact?:boolean;onConnected?:()=>void}) {
  const {t}=useLocale();
  const [busy,setBusy]=useState(false);const [url,setUrl]=useState<string|null>(null);
  const [message,setMessage]=useState<MessageKey|null>(null);const [error,setError]=useState(false);
  const run=useRef<{controller:AbortController;timer?:ReturnType<typeof setTimeout>}|null>(null);
  useEffect(()=>()=>{run.current?.controller.abort();clearTimeout(run.current?.timer);run.current=null;},[accountId]);
  async function open(){
    if(run.current)return;
    const task={controller:new AbortController(),timer:undefined as ReturnType<typeof setTimeout>|undefined};run.current=task;
    setBusy(true);setError(false);setMessage('companionOpening');setUrl(null);
    const request=async(path:string,options:RequestInit={})=>{
      const controller=new AbortController();const abort=()=>controller.abort();task.controller.signal.addEventListener('abort',abort);
      const timeout=setTimeout(abort,8000);
      try{return await fetch(path,{...options,credentials:'same-origin',cache:'no-store',signal:controller.signal});}
      finally{clearTimeout(timeout);task.controller.signal.removeEventListener('abort',abort);}
    };
    const finish=(key:MessageKey,failed:boolean)=>{
      if(run.current!==task)return;
      task.controller.abort();clearTimeout(task.timer);run.current=null;setBusy(false);setUrl(null);setMessage(key);setError(failed);
    };
    try{
      const cookie=document.cookie.split('; ').find(c=>c.startsWith('XSRF-TOKEN='))?.slice(11);
      if(!cookie)throw Error();
      const response=await request('/api/v1/device-launches',{method:'POST',headers:{'Content-Type':'application/json','X-XSRF-TOKEN':decodeURIComponent(cookie)},body:JSON.stringify({acceptCapturePermissions:true})});
      if(!response.ok){finish(response.status===429?'devicesRateLimit':'companionLaunchError',true);return;}
      const launch=await response.json();
      if(!launch||!uuid.test(launch.id)||typeof launch.launchSecret!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(launch.launchSecret)||!Number.isFinite(Date.parse(launch.expiresAt)))throw Error();
      if(run.current!==task)return;
      const expires=Math.min(Date.parse(launch.expiresAt),Date.now()+120000);
      const href=`rbgs-companion://connect/${launch.launchSecret}`;setUrl(href);setMessage('companionLaunchWaiting');
      window.location.assign(href);
      const poll=async()=>{
        if(run.current!==task)return;
        if(Date.now()>=expires){finish('companionLaunchExpired',true);return;}
        try{
          const status=await request(`/api/v1/device-launches/${encodeURIComponent(launch.id)}`);
          if(run.current!==task)return;
          if([401,403,404,410,429].includes(status.status)){finish(status.status===429?'devicesRateLimit':'companionLaunchExpired',true);return;}
          if(status.ok){const progress=await status.json();
            if(progress.status==='PAIRED'&&typeof progress.deviceId==='string'&&uuid.test(progress.deviceId)){
              finish('companionLinked',false);selectCompanion(accountId,progress.deviceId);onConnected?.();return;
            }
          }
        }catch{/* A temporary outage can recover within the ticket lifetime. */}
        if(run.current===task)task.timer=setTimeout(()=>void poll(),2000);
      };
      task.timer=setTimeout(()=>void poll(),1500);
    }catch{finish('companionLaunchError',true);}
  }
  return <div className={`companion-launch ${compact?'is-compact':''}`}>
    <button className={compact?'companion-launch-button':'button'} type="button" disabled={busy} onClick={()=>void open()}>{t(busy?'companionOpening':compact?'companionStart':'companionOpenConnect')}</button>
    {message&&<p className="companion-launch-message" role={error?'alert':'status'}>{t(message)}{url&&<> <a href={url}>{t('companionOpenAgain')}</a></>}</p>}
  </div>;
}
