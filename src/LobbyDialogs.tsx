import { useId, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useLocale } from './locales';
import { type GroupLobby } from './GroupPage';
import type { LobbyPanel } from './LobbyActions';

function LobbyPopup({ dialogRef, title, children, focusClose = true, className = '' }: {
  dialogRef: RefObject<HTMLDialogElement | null>; title: string; children: ReactNode; focusClose?: boolean; className?: string;
}) {
  const { t } = useLocale();
  const headingId = useId();
  return <dialog ref={dialogRef} className={`play-lobby-dialog ${className}`} aria-labelledby={headingId} onClick={event => {
    if (event.target !== event.currentTarget) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialogRef.current?.close();
  }}>
    <header className="character-selection-heading"><h2 id={headingId}>{title}</h2>
      <button type="button" className="character-selection-close" aria-label={t('charactersClose')} onClick={() => dialogRef.current?.close()} autoFocus={focusClose}>×</button>
    </header>
    <div className="play-lobby-dialog-body">{children}</div>
  </dialog>;
}

export function useLobbyDialogs(lobby: GroupLobby, onJoined: () => void) {
  const { t } = useLocale();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inviteRef = useRef<HTMLDialogElement>(null);
  const [invited, setInvited] = useState<string | null>(null);
  const openSlot = () => {
    setInvited(null);
    inviteRef.current?.showModal();
    inviteRef.current?.querySelector<HTMLInputElement>('input')?.focus();
  };
  const openPanel = (_next: LobbyPanel) => {
    dialogRef.current?.showModal();
    dialogRef.current?.querySelector<HTMLInputElement>('input')?.focus();
  };
  async function invite() {
    const recipient = lobby.battleTag.trim();
    setInvited(null);
    if (!lobby.group) {
      if (!await lobby.action('/api/v1/groups', {})) return;
      lobby.setBattleTag(recipient);
    }
    if (await lobby.command('invitations', { battleTag: recipient })) setInvited(recipient);
  }
  const error = lobby.error && <p role="alert">{t(lobby.error)}</p>;
  const dialogs = <>
    <LobbyPopup dialogRef={inviteRef} title={t('groupInvite')} focusClose={false} className="play-invite-dialog">
      {error}
      {lobby.group && !lobby.captain ? <p>{t('playOnlyCaptainInvite')}</p> : <>
          <p>{t('groupInviteHelp')}</p>
          <form onSubmit={event => { event.preventDefault(); void invite(); }}>
            <label htmlFor="play-invite-battletag">BattleTag</label>
            <input id="play-invite-battletag" value={lobby.battleTag} onChange={event => { lobby.setBattleTag(event.target.value); setInvited(null); }}
              autoFocus required maxLength={100} pattern="[^#]+#[0-9]+" placeholder="Player#1234" autoComplete="off" spellCheck={false}
              disabled={lobby.busy || (lobby.group?.members.length ?? 0) >= 10} />
            <button className="lobby-primary-action" disabled={lobby.busy || (lobby.group?.members.length ?? 0) >= 10 || !lobby.battleTag.trim()}>{t('groupInvite')}</button>
          </form>
          {(lobby.group?.members.length ?? 0) >= 10 && <p>{t('groupFull')}</p>}
          {invited && <p className="lobby-success" role="status">{t('playInviteSent')} <strong>{invited}</strong>.</p>}
        </>}
      <section className="lobby-pending-invitations">
        <h3>{t('playInvitations')}</h3>
        {!lobby.incoming.length && !lobby.group?.invitations.length && <p>{t('playNoInvitations')}</p>}
        {lobby.incoming.length > 0 && <section><h3>{t('groupInvitations')}</h3><ul className="lobby-invitation-list">
          {lobby.incoming.map(item => <li key={item.id}><div><strong>{item.captainName}</strong><span>{t('groupExpires')} <time dateTime={item.expiresAt}>{lobby.expires(item.expiresAt)}</time></span></div>
            <div className="group-member-actions"><button disabled={lobby.busy || !!lobby.group} onClick={async () => {
              if (await lobby.action(`/api/v1/me/group-invitations/${item.id}/accept`, {})) { onJoined(); inviteRef.current?.close(); }
            }}>{t('groupAccept')}</button>
              <button disabled={lobby.busy} onClick={() => void lobby.action(`/api/v1/me/group-invitations/${item.id}/decline`, {})}>{t('groupDecline')}</button></div></li>)}
        </ul></section>}
        {!!lobby.group?.invitations.length && <section><h3>{t('playSentInvitations')}</h3><ul className="lobby-invitation-list">
          {lobby.group.invitations.map(item => <li key={item.id}><div><strong>{item.recipientName}</strong><span>{t('groupExpires')} <time dateTime={item.expiresAt}>{lobby.expires(item.expiresAt)}</time></span></div>
            <button disabled={lobby.busy} onClick={() => void lobby.command(`invitations/${item.id}/cancel`)}>{t('groupCancelInvite')}</button></li>)}
        </ul></section>}
      </section>
    </LobbyPopup>
    <LobbyPopup dialogRef={dialogRef} title={t('groupJoinCode')} focusClose={false} className="play-join-dialog">
      {error}
      <form className="play-join-code-form" onSubmit={async event => {
        event.preventDefault();
        if (await lobby.action('/api/v1/groups/join', { code: lobby.joinCode.trim() })) { onJoined(); dialogRef.current?.close(); }
      }}>
        <input id="play-join-code" aria-label={t('groupLobbyCode')} placeholder={t('playJoinPlaceholder')} value={lobby.joinCode} onChange={event => lobby.setJoinCode(event.target.value.toUpperCase())}
          autoFocus required minLength={8} maxLength={8} pattern="[A-HJ-NP-Z2-9]{8}" autoCapitalize="characters" autoComplete="off" spellCheck={false} disabled={lobby.busy} />
        <button className="lobby-primary-action" disabled={lobby.busy || lobby.joinCode.length !== 8}>{t('playJoinShort')}</button>
      </form>
      {lobby.busy && <p role="status">{t('groupSaving')}</p>}
    </LobbyPopup>
  </>;
  return { dialogRef, openSlot, openPanel, dialogs };
}
