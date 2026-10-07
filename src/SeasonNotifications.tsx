import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLocale } from './locales';
import type { MessageKey } from './locales/en';
import './SeasonNotifications.css';

type Status = { emailEnabled: boolean; seasonLive: boolean; subscriptionsAvailable: boolean };
type LinkState = { kind: 'confirm' | 'unsubscribe'; token: string };
async function post(path: string, body: object) {
  // Establish a fresh CSRF cookie even for visitors without a Battle.net session.
  const status = await fetch('/api/v1/season-notifications', { credentials: 'same-origin' });
  if (!status.ok) throw new Error('seasonUnavailable');
  const cookie = document.cookie.split('; ').find(value => value.startsWith('XSRF-TOKEN='))?.slice('XSRF-TOKEN='.length);
  if (!cookie) throw new Error('seasonUnavailable');
  const response = await fetch(`/api/v1/season-notifications${path}`, {
    method: 'POST', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': decodeURIComponent(cookie) },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(response.status === 429 ? 'seasonRateLimited'
    : response.status === 400 && path ? 'seasonInvalidLink'
    : response.status === 409 ? 'seasonAlreadyLive' : 'seasonUnavailable');
}

export function SeasonNotificationsProvider({ children }: { children: ReactNode }) {
  const { t } = useLocale();
  const [status, setStatus] = useState<Status | null>(null);
  const [action, setAction] = useState<LinkState | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [panelHeight, setPanelHeight] = useState<number | null>(null);
  const panel = useRef<HTMLElement>(null);
  const statusRequest = useRef<AbortController | null>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const heading = useId();

  const refreshStatus = useCallback(() => {
    statusRequest.current?.abort();
    const controller = new AbortController();
    statusRequest.current = controller;
    const refresh = () => { void fetch('/api/v1/season-notifications', { credentials: 'same-origin', signal: controller.signal })
      .then(async response => {
        if (!response.ok) { if (!controller.signal.aborted) setStatus(null); return; }
        const value: unknown = await response.json();
        if (controller.signal.aborted) return;
        if (value && typeof value === 'object' && 'emailEnabled' in value && 'seasonLive' in value && 'subscriptionsAvailable' in value
          && typeof value.emailEnabled === 'boolean' && typeof value.seasonLive === 'boolean' && typeof value.subscriptionsAvailable === 'boolean') setStatus(value as Status);
        else setStatus(null);
      }).catch(() => { if (!controller.signal.aborted) setStatus(null); }); };
    refresh();
  }, []);

  useEffect(() => {
    refreshStatus();
    return () => { statusRequest.current?.abort(); };
  }, [refreshStatus]);

  useEffect(() => {
    const search = new URLSearchParams(location.search);
    const linkHash = /^#season-(confirm|unsubscribe)=/.test(location.hash);
    const links = linkHash ? new URLSearchParams(location.hash.slice(1)) : search;
    const confirmation = links.get('season-confirm');
    const unsubscribe = links.get('season-unsubscribe');
    if (confirmation || unsubscribe) {
      setAction({ kind: confirmation ? 'confirm' : 'unsubscribe', token: confirmation ?? unsubscribe! });
      setExpanded(true);
      search.delete('season-confirm');
      search.delete('season-unsubscribe');
      // Bearer links stay in memory, rather than in the address bar or future referrers.
      navigate({ pathname: location.pathname, search: search.toString(), hash: linkHash ? '' : location.hash }, { replace: true });
    }
  }, [location.pathname, location.search, location.hash, navigate]);

  return <>
    {children}
    {status?.emailEnabled && (!status.seasonLive || action) && <div className={`season-widget${expanded ? ' is-expanded' : ''}`} onKeyDown={event => {
      if (event.key === 'Escape' && expanded) { setExpanded(false); toggle.current?.focus(); }
    }}>
    <aside ref={panel} id={`${heading}-panel`} className="season-floating" aria-labelledby={heading} inert={!expanded}
      style={panelHeight === null || action ? undefined : { height: panelHeight }}>
      <span className="season-eyebrow"><span className="season-dot" aria-hidden="true" />{t(action ? 'seasonNotificationLabel' : 'seasonBadge')}</span>
      <h2 id={heading}>{t(action ? action.kind === 'confirm' ? 'seasonConfirmHeading' : 'seasonUnsubscribeHeading' : 'seasonHeading')}</h2>
      {action ? <>
        <LinkAction key={action.kind + action.token} kind={action.kind} token={action.token} />
        <button className="season-back" onClick={() => setAction(null)}>{t('seasonBackToNotice')}</button>
      </> : <>
        <p className="season-description">{t('seasonDescription')}</p>
        <NotificationForm available={status?.subscriptionsAvailable ?? false}
          onPrivacyChange={opening => setPanelHeight(opening ? panel.current?.getBoundingClientRect().height ?? null : null)} />
      </>}
    </aside>
    <button ref={toggle} className="season-quest-toggle" type="button" aria-expanded={expanded}
      aria-controls={`${heading}-panel`} aria-label={t(expanded ? 'seasonHideNotice' : 'seasonShowNotice')}
      onClick={() => { if (!expanded) refreshStatus(); setExpanded(value => !value); }}>
      <img src="/quest-exclamation.svg" alt="" aria-hidden="true" />
    </button>
    </div>}
  </>;
}

function NotificationForm({ available, onPrivacyChange }: { available: boolean; onPrivacyChange: (opening: boolean) => void }) {
  const { t, language } = useLocale();
  const id = useId();
  const [state, setState] = useState<'idle' | 'sending' | 'success'>('idle');
  const [error, setError] = useState<MessageKey | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!available || state === 'sending') return;
    const form = new FormData(event.currentTarget);
    setState('sending'); setError(null);
    try {
      await post('', { email: String(form.get('email')).trim(), language, website: form.get('website') });
      onPrivacyChange(false); setState('success');
    } catch (failure) {
      setState('idle'); setError(errorKey(failure));
    }
  }

  if (state === 'success') return <div className="season-success" role="status"><span aria-hidden="true">✓</span><div><strong>{t('seasonCheckInbox')}</strong><p>{t('seasonCheckInboxDescription')}</p></div></div>;
  return <form className="season-form" onSubmit={event => void submit(event)}>
    <label className="season-email-label" htmlFor={id}>{t('seasonEmail')}</label>
    <div className="season-input-row"><input id={id} name="email" type="email" autoComplete="email" placeholder="you@example.com" maxLength={254} required aria-describedby={`${id}-notice`} disabled={state === 'sending' || !available} />
      <button className="season-primary" type="submit" aria-describedby={`${id}-notice`} disabled={state === 'sending' || !available}>{t(state === 'sending' ? 'seasonSending' : 'seasonNotify')}</button></div>
    <div className="season-honeypot" aria-hidden="true"><label htmlFor={`${id}-website`}>Website</label><input id={`${id}-website`} name="website" autoComplete="off" tabIndex={-1} /></div>
    <p id={`${id}-notice`} className="season-notice">{t('seasonNotice')}</p>
    <details className="season-privacy" onToggle={event => { if (!event.currentTarget.open) onPrivacyChange(false); }}>
      <summary onClick={event => onPrivacyChange(!(event.currentTarget.parentElement as HTMLDetailsElement).open)}>{t('seasonPrivacy')}</summary>
      <p>{t('seasonPrivacyDescription')}</p>
    </details>
    {!available && <p className="season-feedback" role="status">{t('seasonUnavailable')}</p>}
    {error && <p className="season-feedback" role="alert">{t(error)}</p>}
  </form>;
}

function LinkAction({ kind, token }: { kind: 'confirm' | 'unsubscribe'; token: string }) {
  const { t } = useLocale();
  const [state, setState] = useState<'idle' | 'sending' | 'success'>('idle');
  const [error, setError] = useState<MessageKey | null>(null);
  async function act() {
    setState('sending'); setError(null);
    try { await post(`/${kind}`, { token }); setState('success'); }
    catch (failure) { setState('idle'); setError(errorKey(failure)); }
  }
  return <div className="season-link-action">
    <p className="season-description" role={state === 'success' ? 'status' : undefined}>{t(state === 'success'
      ? kind === 'confirm' ? 'seasonConfirmed' : 'seasonUnsubscribed'
      : kind === 'confirm' ? 'seasonConfirmDescription' : 'seasonUnsubscribeDescription')}</p>
    {state !== 'success' && <button className="season-primary" disabled={state === 'sending'} onClick={() => void act()}>{t(state === 'sending' ? 'seasonSending' : kind === 'confirm' ? 'seasonConfirmAction' : 'seasonUnsubscribeAction')}</button>}
    {error && <p className="season-feedback" role="alert">{t(error)}</p>}
  </div>;
}

function errorKey(error: unknown): MessageKey {
  const message = error instanceof Error ? error.message : '';
  return message === 'seasonRateLimited' || message === 'seasonInvalidLink' || message === 'seasonAlreadyLive' ? message : 'seasonUnavailable';
}
