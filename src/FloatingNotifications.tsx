import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useLocale } from './locales';
import type { MessageKey } from './locales/en';
import './LobbyInvitationNotifications.css';

const NotificationTarget = createContext<HTMLElement | null>(null);

/** One shared stack keeps account messages, invitations and removal notices from overlapping. */
export function FloatingNotificationsProvider({ children }: { children: ReactNode }) {
  const { t } = useLocale();
  const [mounted, setMounted] = useState(false);
  const [target, setTarget] = useState<HTMLElement | null>(null);
  useEffect(() => { setMounted(true); }, []);
  return <NotificationTarget.Provider value={target}>
    {children}
    {mounted && createPortal(<section ref={setTarget} className="lobby-invite-notifications floating-notifications"
      aria-label={t('notificationsLabel')} />, document.body)}
  </NotificationTarget.Provider>;
}

export function FloatingNotificationGroup({ children }: { children: ReactNode }) {
  const target = useContext(NotificationTarget);
  if (!target) return null;
  return createPortal(children, target);
}

/** Error state owns lifetime. Dismissal hides the notice until the state clears or a new attempt starts. */
export function MessageNotification({ message, attempt = 0, container, children, role = 'alert' }: {
  message: MessageKey | null; attempt?: number; container?: HTMLElement | null; children?: ReactNode; role?: 'alert' | 'status';
}) {
  const { t } = useLocale();
  const target = useContext(NotificationTarget);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => { setDismissed(false); }, [message, attempt]);
  if (!message || dismissed || !(container || target)) return null;
  const notice = <article className="lobby-invite-notice message-notification" role={role}
    onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setDismissed(true); } }}>
    <div className="lobby-invite-notice-heading">
      <span className="lobby-invite-notice-icon" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="12" cy="12" r="9" />
        <path d="M12 7v6m0 4h.01" /></svg></span>
      <strong>{t(message)}</strong>
      <button type="button" className="lobby-invite-dismiss" aria-label={t('notificationDismiss')} onClick={() => setDismissed(true)}>×</button>
    </div>
    {children && <div className="message-notification-actions">{children}</div>}
  </article>;
  return createPortal(container ? <section className="lobby-invite-notifications floating-notifications"
    aria-label={t('notificationsLabel')}>{notice}</section> : notice, container || target!);
}
