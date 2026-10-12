import {useEffect,useState} from 'react';
import {useLocale} from './locales';
import {clearCompanionLink,pendingCompanionLink,selectCompanion} from './companion-link';
type Request={name:string;scope:string;expiresAt:string;status:'PENDING'|'APPROVED'|'PAIRED';deviceId:string|null;accountName:string};
export function BrowserPairing({accountId,ready,onConnected}:{accountId:string;ready:boolean;onConnected:()=>void}){
 const {t}=useLocale();const [secret,setSecret]=useState(pendingCompanionLink);const [request,setRequest]=useState<Request|null>(null);const [error,setError]=useState(false);const [busy,setBusy]=useState(false);const [done,setDone]=useState(false);const [retry,setRetry]=useState(0);
 async function post(approve=false,signal?:AbortSignal){
  const csrf=document.cookie.split('; ').find(c=>c.startsWith('XSRF-TOKEN='))?.slice(11);if(!csrf)throw Error();
  const response=await fetch(`/api/v1/device-pairings/browser/${approve?'approve':'details'}`,{method:'POST',credentials:'same-origin',cache:'no-store',signal,headers:{'Content-Type':'application/json','X-XSRF-TOKEN':decodeURIComponent(csrf)},body:JSON.stringify({approvalSecret:secret,acceptCapturePermissions:approve&&request?.scope.includes('evidence:write')===true})});
  if(!response.ok)throw Error();const value=await response.json();if(!value||typeof value.name!=='string'||typeof value.accountName!=='string'||!['companion:status','companion:status companion:assignments evidence:write'].includes(value.scope)||!['PENDING','APPROVED','PAIRED'].includes(value.status)||!Number.isFinite(Date.parse(value.expiresAt))||(value.deviceId!==null&&!/^[0-9a-f-]{36}$/i.test(value.deviceId)))throw Error();return value as Request;
 }
 useEffect(()=>{if(!secret||!ready)return;let disposed=false;let timer:ReturnType<typeof setTimeout>;let controller:AbortController;
  async function read(){controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),8000);try{const value=await post(false,controller.signal);if(disposed)return;setRequest(value);setError(false);if(value.status==='PAIRED'&&value.deviceId){selectCompanion(accountId,value.deviceId);clearCompanionLink();setSecret(null);setDone(true);onConnected();}else timer=setTimeout(()=>void read(),5000);}catch{if(!disposed)setError(true);}finally{clearTimeout(timeout);}}
  void read();return()=>{disposed=true;clearTimeout(timer);controller?.abort();};
 },[secret,ready,accountId,request?.status,retry]);
 if(!secret)return done?<p role="status">{t('companionLinked')}</p>:null;
 async function approve(){setBusy(true);setError(false);try{setRequest(await post(true));}catch{setError(true);}finally{setBusy(false);}}
 return <section className="browser-pairing"><h3>{t('companionApproveHeading')}</h3>
  {error?<><p role="alert">{t('companionApprovalError')}</p><button onClick={()=>setRetry(value=>value+1)}>{t('companionRetry')}</button></>:!request?<p role="status">{t('companionPresenceChecking')}</p>:request.status==='PAIRED'?<p role="status">{t('companionLinked')}</p>:request.status==='APPROVED'?<p role="status">{t('companionApprovalWaiting')}</p>:<>
   <p><strong>{request.name}</strong> · {t('companionApproveAccount')} <strong>{request.accountName}</strong></p><p>{t(request.scope.includes('evidence:write')?'companionApproveCaptures':'companionApproveStatus')}</p><p>{t('devicesWarning')}</p>
   <button disabled={busy||Date.parse(request.expiresAt)<=Date.now()} onClick={()=>void approve()}>{t(request.scope.includes('evidence:write')?'companionApproveCaptureButton':'devicesApprove')}</button>
  </>}
  <button disabled={busy} onClick={()=>{clearCompanionLink();setSecret(null);}}>{t('companionDismiss')}</button>
 </section>;
}
