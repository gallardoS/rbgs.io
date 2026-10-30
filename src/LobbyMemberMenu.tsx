import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { CaptainCrown } from './CaptainConsent';
import type { GroupLobby, GroupMember } from './GroupPage';
import { useLocale } from './locales';

export function LobbyMemberMenu({ id, anchorRef, member, lobby, onOpenChange }: {
  id: string; anchorRef: RefObject<HTMLButtonElement | null>; member: GroupMember;
  lobby: GroupLobby; onOpenChange: (open: boolean) => void;
}) {
  const { t } = useLocale();
  const titleId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const positioned = position !== null;

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const anchor = anchorRef.current, menu = menuRef.current;
      if (!anchor || !menu) return;
      const card = anchor.getBoundingClientRect(), bounds = menu.getBoundingClientRect();
      const preferredLeft = card.right + bounds.width + 20 <= window.innerWidth ? card.right + 8 : card.left - bounds.width - 8;
      const left = Math.max(12, Math.min(preferredLeft, window.innerWidth - bounds.width - 12));
      const top = Math.max(12, Math.min(card.top, window.innerHeight - bounds.height - 12));
      setPosition(previous => previous?.left === left && previous.top === top ? previous : { left, top });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open, anchorRef, lobby.captain, lobby.busy, lobby.error, attempted, member.characterName, member.displayName]);

  useLayoutEffect(() => {
    if (open && positioned) menuRef.current?.querySelector<HTMLButtonElement>('[role=menuitem]')?.focus({ preventScroll: true });
  }, [open, positioned]);

  function close() {
    menuRef.current?.hidePopover();
    anchorRef.current?.focus({ preventScroll: true });
  }
  function navigate(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') { event.preventDefault(); close(); return; }
    if (event.key === 'Tab') { close(); return; }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role=menuitem]:not(:disabled)')];
    if (!items.length) return;
    const current = items.findIndex(item => item === document.activeElement);
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
      : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    items[index]?.focus();
  }
  async function act(command: 'captain' | 'members/remove') {
    if (!lobby.captain || lobby.busy || member.accountId === lobby.accountId) return;
    const anchor = anchorRef.current;
    const stage = anchor?.closest('.play-roster-stage');
    setAttempted(true);
    if (await lobby.command(command, { accountId: member.accountId })) {
      menuRef.current?.hidePopover();
      window.requestAnimationFrame(() => {
        const target = anchor?.isConnected ? anchor : stage?.querySelector<HTMLButtonElement>('.player-card-trigger');
        target?.focus({ preventScroll: true });
      });
    }
  }

  return <div id={id} ref={menuRef} popover="auto" role="menu" className="lobby-member-menu" aria-labelledby={titleId}
    aria-busy={lobby.busy} data-positioned={positioned} style={{ left: position?.left ?? 0, top: position?.top ?? 0 }}
    onKeyDown={navigate} onToggle={event => {
      const visible = event.newState === 'open';
      setOpen(visible); onOpenChange(visible);
      if (!visible) { setPosition(null); setAttempted(false); }
    }}>
    <strong id={titleId} className="lobby-member-menu-title">{member.characterName ?? member.displayName}</strong>
    <button type="button" role="menuitem" tabIndex={-1} aria-disabled="true">
      <MemberMenuIcon kind="profile" /><span>{t('playViewProfile')}</span><small>{t('playComingSoon')}</small>
    </button>
    <button type="button" role="menuitem" tabIndex={-1} aria-disabled="true">
      <MemberMenuIcon kind="friend" /><span>{t('playAddFriend')}</span><small>{t('playComingSoon')}</small>
    </button>
    {lobby.captain && member.accountId !== lobby.accountId && <>
      <span className="lobby-member-menu-divider" role="separator" />
      <button type="button" role="menuitem" tabIndex={-1} aria-disabled={lobby.busy} onClick={() => void act('captain')}>
        <CaptainCrown size={18} className="lobby-member-menu-crown" /><span>{t('playPromoteToCaptain')}</span>
      </button>
      <button type="button" role="menuitem" tabIndex={-1} className="is-danger" aria-disabled={lobby.busy} onClick={() => void act('members/remove')}>
        <MemberMenuIcon kind="kick" /><span>{t('playKickPlayer')}</span>
      </button>
    </>}
    {lobby.busy && <p role="status">{t('groupSaving')}</p>}
    {attempted && lobby.error && <p role="alert">{t(lobby.error)}</p>}
  </div>;
}

function MemberMenuIcon({ kind }: { kind: 'profile' | 'friend' | 'kick' }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="9" cy="7" r="4" /><path d="M2 21v-2a7 7 0 0 1 14 0v2" />
    {kind === 'friend' && <path d="M19 7v6m-3-3h6" />}
    {kind === 'kick' && <path d="M17 10h6" />}
  </svg>;
}
