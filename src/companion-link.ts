// A short-lived approval handle, never a polling secret or device credential.
const pendingKey='rbgs-companion-approval';
export function captureCompanionLink(){
 const match=/^#companion-link=([A-Za-z0-9_-]{43})$/.exec(window.location.hash);
 if(!match)return;
 try{sessionStorage.setItem(pendingKey,JSON.stringify({secret:match[1],until:Date.now()+300000}));}catch{/* Current fragment remains usable without storage. */}
 window.history.replaceState(window.history.state,'',window.location.pathname+window.location.search);
 return match[1];
}
let initialSecret:string|undefined;let initialUntil=0;
export function initializeCompanionLink(){initialSecret=captureCompanionLink();initialUntil=Date.now()+300000;}
export function pendingCompanionLink():string|null {
 if(initialSecret&&Date.now()<initialUntil)return initialSecret;
 try{const value=JSON.parse(sessionStorage.getItem(pendingKey)||'null');if(value&&/^[A-Za-z0-9_-]{43}$/.test(value.secret)&&Number.isFinite(value.until)&&value.until>Date.now())return value.secret;sessionStorage.removeItem(pendingKey);}catch{}
 return null;
}
export function clearCompanionLink(){initialSecret=undefined;try{sessionStorage.removeItem(pendingKey);}catch{}}
const key=(account:string)=>`rbgs-companion-device:${account}`;
const memoryDevices=new Map<string,string>();
export function preferredCompanion(account:string){try{return localStorage.getItem(key(account))??memoryDevices.get(account)??null;}catch{return memoryDevices.get(account)??null;}}
export function selectCompanion(account:string,device:string){memoryDevices.set(account,device);try{localStorage.setItem(key(account),device);}catch{}window.dispatchEvent(new Event('rbgs-companion-device'));}
export function forgetCompanion(account:string,device:string){
 if(preferredCompanion(account)!==device)return;
 memoryDevices.delete(account);try{localStorage.removeItem(key(account));}catch{}
 window.dispatchEvent(new Event('rbgs-companion-device'));
}
