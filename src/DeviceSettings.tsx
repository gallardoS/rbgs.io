import { useEffect, useId, useRef, useState } from 'react';
import { useLocale } from './locales';
import type { MessageKey } from './locales/en';
import './DeviceSettings.css';
import './CompanionStatus.css';
import {BrowserPairing} from './BrowserPairing';
import { forgetCompanion, preferredCompanion, selectCompanion } from './companion-link';
import {OpenCompanion} from './OpenCompanion';

type Device = { id: string; createdAt: string; expiresAt: string; revokedAt: string | null; connected: boolean };
function validDevices(value: unknown): value is Device[] {
  return Array.isArray(value) && value.every(d => d && typeof d.id === 'string' && typeof d.connected === 'boolean'
    && typeof d.createdAt === 'string' && Number.isFinite(Date.parse(d.createdAt))
    && typeof d.expiresAt === 'string' && Number.isFinite(Date.parse(d.expiresAt))
    && (d.revokedAt === null || (typeof d.revokedAt === 'string' && Number.isFinite(Date.parse(d.revokedAt)))));
}
export function DeviceSettings({accountId}:{accountId:string}) {
  const { t, language } = useLocale();
  const id = useId();
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<MessageKey | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [preferred, setPreferred] = useState(() => preferredCompanion(accountId));
  const mutation = useRef<AbortController | null>(null);
  useEffect(() => {
    const changed = () => { setPreferred(preferredCompanion(accountId)); setAttempt(value => value + 1); };
    window.addEventListener('rbgs-companion-device', changed);
    return () => window.removeEventListener('rbgs-companion-device', changed);
  }, [accountId]);
  useEffect(() => () => { mutation.current?.abort(); mutation.current = null; }, []);
  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController;
    async function read() {
      controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 10000);
      try {
        const response = await fetch('/api/v1/devices/me', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error();
        const result: unknown = await response.json();
        if (!validDevices(result)) throw new Error();
        if (!disposed) { setDevices(result); setLoadFailed(false); }
      } catch {
        if (!disposed) { setDevices(null); setLoadFailed(true); }
      } finally {
        window.clearTimeout(timeout);
        if (!disposed) timer = window.setTimeout(() => void read(), 10000);
      }
    }
    void read();
    return () => { disposed = true; controller?.abort(); window.clearTimeout(timer); };
  }, [accountId, attempt]);
  async function mutate(path: string, method: string, body?: object, revokedDeviceId?: string) {
    if (mutation.current) return;
    const controller = new AbortController();
    mutation.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    setBusy(true); setMessage(null); setError(false);
    try {
      const cookie = document.cookie.split('; ').find(c => c.startsWith('XSRF-TOKEN='))?.slice(11);
      if (!cookie) throw new Error();
      const response = await fetch(path, { method, credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
        headers: { 'X-XSRF-TOKEN': decodeURIComponent(cookie), ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (controller.signal.aborted) return;
      if (!response.ok) { setError(true); setMessage(response.status === 410 ? 'devicesCodeExpired' : response.status === 429 ? 'devicesRateLimit' : 'devicesActionError'); return; }
      setMessage(method === 'POST' ? 'devicesApproved' : 'devicesRevoked');
      if (revokedDeviceId) {
        setDevices(current => current?.filter(device => device.id !== revokedDeviceId) ?? null);
        forgetCompanion(accountId, revokedDeviceId);
      }
      if (method === 'POST') setCode('');
      setAttempt(value => value + 1);
    } catch { if (mutation.current === controller) { setError(true); setMessage('devicesActionError'); } }
    finally { window.clearTimeout(timeout); if (mutation.current === controller) { mutation.current = null; setBusy(false); } }
  }
  const active = devices?.filter(device => device.revokedAt === null && Date.parse(device.expiresAt) > Date.now()) ?? [];
  const selected = active.find(device => device.id === preferred) ?? (active.length === 1 && !preferred ? active[0] : undefined);
  const online = selected?.connected === true;
  return <section className="device-settings profile-settings-section" aria-labelledby={`${id}-title`}>
    <div className="profile-section-heading"><h2 id={`${id}-title`}>{t('devicesHeading')}</h2><p>{t('devicesDescription')}</p></div>
    <div>
      <BrowserPairing accountId={accountId} ready={devices!==null} onConnected={()=>setAttempt(value=>value+1)} />
      {online ? <p className="device-connection-status" role="status">
        <span className="companion-presence-dot is-connected" aria-hidden="true" />{t('companionPresenceConnected')}
      </p> : devices === null && !loadFailed ? <p role="status">{t('companionPresenceChecking')}</p> : <>
      <OpenCompanion accountId={accountId} />
      <details className="device-manual-pairing"><summary>
        <span>{t('companionManualCode')}</span>
        <svg className="device-manual-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </summary>
      <form className="device-pair-form" onSubmit={event => { event.preventDefault(); if (/^[A-HJ-NP-Z2-9]{10}$/.test(code)) void mutate('/api/v1/device-pairings/approve', 'POST', { code, acceptCapturePermissions: true }); }}>
        <label htmlFor={`${id}-code`}>{t('devicesCode')}</label>
        <input id={`${id}-code`} value={code} onChange={event => setCode(event.target.value.toUpperCase().replace(/[\s-]/g, '').slice(0, 10))}
          maxLength={24} autoComplete="off" spellCheck={false} disabled={busy || !devices} aria-describedby={`${id}-warning`} />
        <p id={`${id}-warning`}>{t('devicesWarning')}</p>
        <button type="submit" disabled={busy || !devices || !/^[A-HJ-NP-Z2-9]{10}$/.test(code)}>{t('devicesApprove')}</button>
      </form>
      </details>
      </>}
      {loadFailed && <p role="alert">{t('devicesLoadError')}</p>}
      {message && <p role={error ? 'alert' : 'status'}>{t(message)}</p>}
      {(active.length > 1 || active.length === 1 && !selected) && <label className="device-preference">
        {t('companionDevice')}
        <select value={selected?.id ?? ''} onChange={event => selectCompanion(accountId, event.target.value)}>
          <option value="">{t('companionChooseDevice')}</option>
          {active.map(device => <option key={device.id} value={device.id}>{new Date(device.createdAt).toLocaleString(language)}</option>)}
        </select>
      </label>}
      {!devices ? loadFailed && <button type="button" disabled={busy} onClick={() => { setMessage(null); setAttempt(v => v + 1); }}>{t('devicesRefresh')}</button>
        : active.length === 0 ? <p>{t('devicesEmpty')}</p>
        : <ul className="device-list">{active.map(device => <li key={device.id}>
          <div><strong>{t('devicesPaired')}</strong><p>{new Date(device.createdAt).toLocaleString(language)}</p></div>
          <button className="device-disconnect" type="button" disabled={busy} onClick={() => void mutate(`/api/v1/devices/${encodeURIComponent(device.id)}`, 'DELETE', undefined, device.id)}>{t('devicesRevoke')}</button>
        </li>)}</ul>}
    </div>
  </section>;
}
