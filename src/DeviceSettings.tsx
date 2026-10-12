import { useEffect, useId, useRef, useState } from 'react';
import { useLocale } from './locales';
import type { MessageKey } from './locales/en';
import './DeviceSettings.css';
import {BrowserPairing} from './BrowserPairing';

type Device = { id: string; name: string; createdAt: string; expiresAt: string; revokedAt: string | null };
function validDevices(value: unknown): value is Device[] {
  return Array.isArray(value) && value.every(d => d && typeof d.id === 'string' && typeof d.name === 'string'
    && typeof d.createdAt === 'string' && Number.isFinite(Date.parse(d.createdAt))
    && typeof d.expiresAt === 'string' && Number.isFinite(Date.parse(d.expiresAt))
    && (d.revokedAt === null || (typeof d.revokedAt === 'string' && Number.isFinite(Date.parse(d.revokedAt)))));
}
export function DeviceSettings({accountId}:{accountId:string}) {
  const { t, language } = useLocale();
  const id = useId();
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [code, setCode] = useState('');
  const [capturePermissions, setCapturePermissions] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<MessageKey | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const mutation = useRef<AbortController | null>(null);
  useEffect(() => () => { mutation.current?.abort(); mutation.current = null; }, []);
  useEffect(() => {
    let disposed = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    setDevices(null);
    fetch('/api/v1/devices/me', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error();
        const result: unknown = await response.json();
        if (!validDevices(result)) throw new Error();
        if (!disposed) setDevices(result);
      })
      .catch(() => { if (!disposed) { setMessage('devicesLoadError'); setError(true); } })
      .finally(() => window.clearTimeout(timeout));
    return () => { disposed = true; controller.abort(); window.clearTimeout(timeout); };
  }, [attempt]);
  async function mutate(path: string, method: string, body?: object) {
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
      if (method === 'POST') { setCode(''); setCapturePermissions(false); }
      setAttempt(value => value + 1);
    } catch { if (mutation.current === controller) { setError(true); setMessage('devicesActionError'); } }
    finally { window.clearTimeout(timeout); if (mutation.current === controller) { mutation.current = null; setBusy(false); } }
  }
  return <section className="device-settings profile-settings-section" aria-labelledby={`${id}-title`}>
    <div className="profile-section-heading"><h2 id={`${id}-title`}>{t('devicesHeading')}</h2><p>{t('devicesDescription')}</p></div>
    <div>
      <BrowserPairing accountId={accountId} ready={devices!==null} onConnected={()=>setAttempt(value=>value+1)} />
      <p>{t('companionPairInstructions')}</p><p><a className="button" href="rbgs-companion://open">{t('companionOpen')}</a></p>
      <details><summary>{t('companionManualCode')}</summary>
      <form className="device-pair-form" onSubmit={event => { event.preventDefault(); if (/^[A-HJ-NP-Z2-9]{10}$/.test(code)) void mutate('/api/v1/device-pairings/approve', 'POST', { code, acceptCapturePermissions: capturePermissions }); }}>
        <label htmlFor={`${id}-code`}>{t('devicesCode')}</label>
        <input id={`${id}-code`} value={code} onChange={event => { setCode(event.target.value.toUpperCase().replace(/[\s-]/g, '').slice(0, 10)); setCapturePermissions(false); }}
          maxLength={24} autoComplete="off" spellCheck={false} disabled={busy || !devices} aria-describedby={`${id}-warning`} />
        <p id={`${id}-warning`}>{t('devicesWarning')}</p>
        <label className="capture-permission"><input type="checkbox" checked={capturePermissions} disabled={busy || !devices} onChange={event => setCapturePermissions(event.target.checked)} />{t('devicesCaptureConsent')}</label>
        <button type="submit" disabled={busy || !devices || !/^[A-HJ-NP-Z2-9]{10}$/.test(code)}>{t('devicesApprove')}</button>
      </form>
      </details>
      {message && <p role={error ? 'alert' : 'status'}>{t(message)}</p>}
      {!devices ? <button type="button" disabled={busy} onClick={() => { setMessage(null); setAttempt(v => v + 1); }}>{t('devicesRefresh')}</button>
        : devices.length === 0 ? <p>{t('devicesEmpty')}</p>
        : <ul className="device-list">{devices.map(device => {
          const inactive = device.revokedAt !== null || Date.parse(device.expiresAt) <= Date.now();
          return <li key={device.id}><div><strong>{device.name}</strong><p>{t(inactive ? 'devicesInactive' : 'devicesPaired')} · {new Date(device.createdAt).toLocaleDateString(language)}</p></div>
            {!inactive && <button type="button" disabled={busy} onClick={() => void mutate(`/api/v1/devices/${encodeURIComponent(device.id)}`, 'DELETE')}>{t('devicesRevoke')}</button>}</li>;
        })}</ul>}
    </div>
  </section>;
}
