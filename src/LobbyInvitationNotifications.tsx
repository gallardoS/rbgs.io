import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useLocale } from './locales';
import { localizedPath } from './locale-routing';
import type { GroupLobby } from './GroupPage';
import './LobbyInvitationNotifications.css';

function readDismissed(key: string): string[] {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(key) ?? '[]');
    return Array.isArray(value) ? value.filter(item => typeof item === 'string').slice(-100) : [];
  } catch { return []; }
}

// Group invitations expire 60 seconds after creation or renewal (GroupInvitation).
const INVITATION_LIFETIME_MS = 60 * 1000;

function InvitationLifetime({ expiresAt }: { expiresAt: string }) {
  const [startedAt, setStartedAt] = useState(Date.now);
  useEffect(() => {
    const resync = () => { if (!document.hidden) setStartedAt(Date.now()); };
    document.addEventListener('visibilitychange', resync);
    window.addEventListener('focus', resync);
    return () => {
      document.removeEventListener('visibilitychange', resync);
      window.removeEventListener('focus', resync);
    };
  }, []);
  const remaining = Math.max(0, Date.parse(expiresAt) - startedAt);
  return <div className="lobby-invite-lifetime" aria-hidden="true">
    <span key={startedAt} style={{ '--invite-remaining': Math.min(1, remaining / INVITATION_LIFETIME_MS),
      animationDuration: `${remaining}ms` } as CSSProperties} />
  </div>;
}

export function LobbyInvitationNotifications({ lobby }: { lobby: GroupLobby }) {
  const { t, language } = useLocale();
  const navigate = useNavigate();
  const storageKey = `rbgs.lobby-invites.dismissed.${lobby.accountId}`;
  const [dismissed, setDismissed] = useState<string[]>(() => readDismissed(storageKey));
  const [clock, setClock] = useState(Date.now);
  const [failed, setFailed] = useState<string | null>(null);
  const running = useRef(false);
  const currentTime = Math.max(clock, Date.now());
  const pending = lobby.incoming.filter(invite => Date.parse(invite.expiresAt) > currentTime);
  const visible = pending.filter(invite => !dismissed.includes(`${invite.id}:${invite.expiresAt}`));
  useEffect(() => {
    const next = Math.min(...lobby.incoming.map(invite => Date.parse(invite.expiresAt)).filter(at => at > Date.now()));
    if (!Number.isFinite(next)) return;
    const timeout = window.setTimeout(() => setClock(Date.now()), Math.min(next - Date.now() + 20, 2_147_483_647));
    return () => window.clearTimeout(timeout);
  }, [lobby.incoming, clock]);

  function dismiss(key: string) {
    setDismissed(previous => {
      const next = [...previous.filter(value => value !== key), key].slice(-100);
      try { sessionStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Session-only in-memory dismissal still works. */ }
      return next;
    });
  }
  async function respond(id: string, key: string, accept: boolean) {
    if (running.current || lobby.busy) return;
    running.current = true; setFailed(null);
    try {
      if (await lobby.action(`/api/v1/me/group-invitations/${id}/${accept ? 'accept' : 'decline'}`, {})) {
        dismiss(key);
        if (accept) navigate(`${localizedPath('/play', language)}?mode=premade`);
      } else setFailed(key);
    } finally { running.current = false; }
  }
  if (typeof document === 'undefined') return null;
  return createPortal(<>
    <div className="sr-only" role="status" aria-live="polite" aria-atomic="false" aria-relevant="additions text">
      {visible.slice(0, 3).map(invite => <span key={`${invite.id}:${invite.expiresAt}`}>{invite.captainName} {t('lobbyInviteMessage')}</span>)}
    </div>
    {visible.length > 0 && <section className="lobby-invite-notifications" aria-label={t('lobbyInviteNotifications')}>
    {visible.slice(0, 3).map(invite => {
      const key = `${invite.id}:${invite.expiresAt}`;
      return <article key={key} className="lobby-invite-notice" onKeyDown={event => {
        if (event.key === 'Escape') { event.stopPropagation(); dismiss(key); }
      }}>
        <div className="lobby-invite-notice-heading">
          <span className="lobby-invite-notice-icon" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="9" cy="7" r="4" /><path d="M2 21v-3a7 7 0 0 1 14 0v3M20 8v8M16 12h8" /></svg></span>
          <strong>{t('lobbyInviteTitle')}</strong>
          <button type="button" className="lobby-invite-dismiss" aria-label={t('lobbyInviteDismiss')} onClick={() => dismiss(key)}>×</button>
        </div>
        <p><strong>{invite.captainName}</strong> {t('lobbyInviteMessage')}</p>
        <span className="lobby-invite-expires">{t('groupExpires')} <time dateTime={invite.expiresAt}>{lobby.expires(invite.expiresAt)}</time></span>
        {lobby.group && <p className="lobby-invite-hint">{t('lobbyInviteLeaveFirst')}</p>}
        {failed === key && <p className="lobby-invite-error" role="alert">{t(lobby.error ?? 'groupActionError')}</p>}
        <div className="lobby-invite-notice-actions">
          <button type="button" className="lobby-invite-accept" disabled={lobby.busy || !!lobby.group} onClick={() => void respond(invite.id, key, true)}>{t('groupAccept')}</button>
          <button type="button" disabled={lobby.busy} onClick={() => void respond(invite.id, key, false)}>{t('groupDecline')}</button>
        </div>
        <InvitationLifetime expiresAt={invite.expiresAt} />
      </article>;
    })}
    {visible.length > 3 && <span className="lobby-invite-more">{t(visible.length === 4 ? 'lobbyInviteMoreOne' : 'lobbyInviteMore').replace('{count}', String(visible.length - 3))}</span>}
  </section>}</>, document.body);
}
