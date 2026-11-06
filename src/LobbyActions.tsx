import { useId, useState } from 'react';
import { useLocale } from './locales';
import { ClipboardIcon } from './ClipboardIcon';
import type { GroupLobby } from './GroupPage';

type IconName = 'copy' | 'check' | 'refresh' | 'shuffle' | 'invitations' | 'lock' | 'unlock' | 'leave' | 'join' | 'create';

function LobbyIcon({ name }: { name: IconName }) {
  if (name === 'copy' || name === 'check') return <ClipboardIcon copied={name === 'check'} />;
  const paths = {
    refresh: <><path d="M19 5v4h-4M5 19v-4h4" /><path d="M5.2 9a7 7 0 0 1 11.75-2.05L19 9M5 15l2.05 2.05A7 7 0 0 0 18.8 15" /></>,
    shuffle: <><path d="M3 6h3l12 12h3m-4-4 4 4-4 4M3 18h3l4-4m4-4 4-4h3m-4-4 4 4-4 4" /></>,
    invitations: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 6 9 7 9-7" /></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V6a4 4 0 0 1 8 0v4M12 14v3" /></>,
    unlock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V6a4 4 0 0 1 7.5-2M12 14v3" /></>,
    leave: <><path d="M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5M9 12h12m-5-5 5 5-5 5" /></>,
    join: <><path d="M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5M3 12h12m-5-5 5 5-5 5" /></>,
    create: <><circle cx="8" cy="8" r="4" /><path d="M1 21v-2a7 7 0 0 1 14 0v2M19 7v8m-4-4h8" /></>,
  };
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export function LobbyActionButton({ label, hint, icon, onClick, type = 'button', disabled = false, danger = false, active = false, badge = 0, className = '', pressed }: {
  label: string; hint?: string; icon: IconName; onClick?: () => void; type?: 'button' | 'submit'; disabled?: boolean; danger?: boolean; active?: boolean;
  badge?: number; className?: string; pressed?: boolean;
}) {
  const tooltipId = useId();
  const [dismissed, setDismissed] = useState(false);
  return <span className="lobby-icon-action" data-tooltip-dismissed={dismissed} tabIndex={disabled ? 0 : undefined}
    aria-label={disabled ? label : undefined} aria-describedby={disabled ? tooltipId : undefined}
    onPointerEnter={() => setDismissed(false)} onFocusCapture={() => setDismissed(false)}
    onKeyDown={event => { if (event.key === 'Escape') setDismissed(true); }}>
    <button type={type} className={`lobby-action-button${danger ? ' is-danger' : ''}${active ? ' is-active' : ''} ${className}`}
      disabled={disabled} aria-label={badge > 0 ? `${label} (${badge})` : label} aria-describedby={tooltipId} aria-pressed={pressed}
      onClick={() => { setDismissed(true); onClick?.(); }}>
      <LobbyIcon name={icon} />{badge > 0 && <span className="lobby-action-badge" aria-hidden="true">{badge > 99 ? '99+' : badge}</span>}
    </button>
    <span id={tooltipId} className="captain-tooltip lobby-icon-tooltip" role="tooltip"><strong>{label}</strong>{hint && <span>{hint}</span>}</span>
  </span>;
}

export function LobbyCodeSwitch({ enabled, disabled, onChange }: {
  enabled: boolean; disabled: boolean; onChange: (enabled: boolean) => void;
}) {
  const { t } = useLocale();
  const tooltipId = useId();
  const [dismissed, setDismissed] = useState(false);
  return <span className="lobby-icon-action" data-tooltip-dismissed={dismissed}
    onPointerEnter={() => setDismissed(false)} onFocusCapture={() => setDismissed(false)}
    onKeyDown={event => { if (event.key === 'Escape') setDismissed(true); }}>
    <button type="button" role="switch" aria-checked={enabled} aria-label={t('groupLobbyCode')}
      aria-describedby={tooltipId} disabled={disabled} className="lobby-code-switch"
      onClick={() => { setDismissed(true); onChange(!enabled); }}>
      <span className="lobby-code-switch-thumb"><LobbyIcon name={enabled ? 'unlock' : 'lock'} /></span>
    </button>
    <span id={tooltipId} className="captain-tooltip lobby-icon-tooltip" role="tooltip">
      <strong>{t(enabled ? 'groupDisableCode' : 'groupEnableCode')}</strong>
    </span>
  </span>;
}

export function LobbyActions({ lobby, onJoined, characterReady = true }: {
  lobby: GroupLobby; onJoined: () => void; characterReady?: boolean;
}) {
  const { t } = useLocale();
  const { group, busy, loading } = lobby;
  const [joinFailed, setJoinFailed] = useState(false);
  const id = useId();
  return <div className="play-lobby-actions">
    <div className="lobby-action-list" role="group" aria-label={t('playLobbyActions')}>
      <form className="lobby-join-inline" onSubmit={async event => {
        event.preventDefault();
        const code = lobby.joinCode.trim();
        if (busy || loading || !/^[A-HJ-NP-Z2-9]{8}$/.test(code)) return;
        setJoinFailed(false);
        if (await lobby.action('/api/v1/groups/join', { code })) onJoined();
        else setJoinFailed(true);
      }}>
        <input aria-label={t('groupJoinCode')} placeholder={t('groupJoinCode')} value={lobby.joinCode}
          onChange={event => { lobby.setJoinCode(event.target.value.toUpperCase()); setJoinFailed(false); }}
          aria-describedby={joinFailed && lobby.error ? `${id}-error` : undefined}
          required minLength={8} maxLength={8} pattern="[A-HJ-NP-Z2-9]{8}" autoCapitalize="characters"
          autoComplete="off" spellCheck={false} disabled={busy || loading} />
        <LobbyActionButton type="submit" label={t('groupJoin')} icon="join"
          disabled={busy || loading || !/^[A-HJ-NP-Z2-9]{8}$/.test(lobby.joinCode.trim())} />
      </form>
      {group ? <>
        <LobbyActionButton label={t('groupLeave')} icon="leave"
          danger disabled={busy} onClick={() => void lobby.command('members/remove', { accountId: lobby.accountId })} />
      </> : <>
        <LobbyActionButton label={t('groupCreate')} icon="create" disabled={busy || loading || !characterReady} onClick={() => void lobby.action('/api/v1/groups', {})} />
      </>}
    </div>
    {joinFailed && lobby.error && <p id={`${id}-error`} className="lobby-join-error" role="alert">{t(lobby.error)}</p>}
    <span className="sr-only" role="status">{busy ? t('groupSaving') : ''}</span>
  </div>;
}
