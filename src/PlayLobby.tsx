import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useLocale } from './locales';
import type { GroupLobby, GroupMember } from './GroupPage';
import { PlayerCard, setPlayerCardTilt, resetPlayerCardTilt, type Character } from './PlayerCard';
import { fcIconAsset, useFcIconPreference, type FcIcon } from './fc-icon-preference';
import { LobbyActionButton } from './LobbyActions';
import { CaptainCrown } from './CaptainConsent';
import { LobbyMemberMenu } from './LobbyMemberMenu';
import './PlayLobby.css';

export function PlayModeButton({ mode, selected, disabled, onSelect }: {
  mode: 'solo' | 'premade'; selected: boolean; disabled: boolean; onSelect: () => void;
}) {
  const { t } = useLocale();
  const tooltipId = useId();
  const [dismissed, setDismissed] = useState(false);
  const heading = t(mode === 'solo' ? 'soloHeading' : 'premadeHeading');
  return <span className="play-mode-option" data-tooltip-dismissed={dismissed}
    onPointerEnter={() => setDismissed(false)}
    onKeyDown={event => { if (event.key === 'Escape') setDismissed(true); }}>
    <button type="button" className="play-mode-button" aria-pressed={selected} aria-describedby={tooltipId}
      disabled={disabled} onClick={onSelect} onFocus={() => setDismissed(false)}>{heading}</button>
    <span id={tooltipId} className="captain-tooltip" role="tooltip">{t(mode === 'solo' ? 'soloDescription' : 'premadeDescription')}</span>
  </span>;
}

export function PlayLobbyCode({ lobby }: { lobby: GroupLobby }) {
  const { t } = useLocale();
  if (!lobby.group) return null;
  const copyLabel = t(lobby.copied ? 'groupCodeCopied' : 'groupCopyCode');
  return <div className="play-lobby-code">
    <span className="play-lobby-code-main"><strong className="play-lobby-region" aria-label={`${t('playLobbyRegion')}: ${lobby.group.region}`}>{lobby.group.region}</strong><span className="play-lobby-code-label">{t('playLobbyCodeLabel')}</span>
    {lobby.group.lobbyCode ? <strong className="play-premade-code">{lobby.group.lobbyCode}</strong> : <span className="play-code-disabled">{t('groupCodeDisabled')}</span>}
    </span>
    <span className="play-code-actions">
      {lobby.group.lobbyCode && <LobbyActionButton label={copyLabel} icon={lobby.copied ? 'check' : 'copy'} active={lobby.copied}
        disabled={lobby.busy} onClick={() => void lobby.copyCode()} />}
      {lobby.captain && <>
      <LobbyActionButton label={t(lobby.group.lobbyCode ? 'groupRegenerateCode' : 'groupEnableCode')}
        icon={lobby.group.lobbyCode ? 'refresh' : 'unlock'} disabled={lobby.busy}
        onClick={() => void lobby.command('code', { enabled: true })} />
      {lobby.group.lobbyCode && <LobbyActionButton label={t('groupDisableCode')} icon="lock" disabled={lobby.busy}
        onClick={() => void lobby.command('code', { enabled: false })} />}
      </>}
    </span>
    <span className="sr-only" role="status">{lobby.copied ? t('groupCodeCopied') : ''}</span>
  </div>;
}

export function PlayLobbyStage({ children, premade, lobby, ownRole, onSlot }: {
  children: ReactNode; premade: boolean; lobby: GroupLobby; ownRole: GroupMember['role']; onSlot: () => void;
}) {
  const { t } = useLocale();
  const { icon: fcIcon } = useFcIconPreference(lobby.accountId);
  const counts = { FC: 0, HEALER: 0, DPS: 0 };
  const roster = lobby.group?.members ?? [];
  for (const member of roster) {
    const role = member.accountId === lobby.accountId ? ownRole : member.role;
    counts[role ?? 'DPS']++;
  }
  if (!roster.length) counts[ownRole ?? 'DPS']++;
  const others = lobby.group?.members.filter(member => member.accountId !== lobby.accountId) ?? [];
  const dense = premade && (lobby.group?.members.length ?? 1) >= 9;
  const ownRef = useRef<HTMLDivElement>(null);
  const previous = useRef<{ dense: boolean; rect: DOMRect; card: DOMRect } | null>(null);
  useLayoutEffect(() => {
    const own = ownRef.current;
    const card = own?.querySelector<HTMLElement>('.player-card-trigger > .player-card');
    if (!own || !card) return;
    const rect = own.getBoundingClientRect(), cardRect = card.getBoundingClientRect();
    const before = previous.current;
    if (premade && before && before.dense !== dense && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      own.animate([{ transform: `translateY(${before.rect.top - rect.top}px)`, opacity: .85 }, { transform: 'none', opacity: 1 }], { duration: 360, easing: 'cubic-bezier(.2, .7, .2, 1)' });
      card.animate([{ height: `${before.card.height}px` }, { height: `${cardRect.height}px` }], { duration: 360, easing: 'cubic-bezier(.2, .7, .2, 1)' });
    }
    previous.current = { dense, rect, card: cardRect };
  });
  function slot(index: number) {
    const member = others[index];
    return <PremadeSlot key={member?.accountId ?? `empty-${index}`} member={member} index={index} lobby={lobby} fcIcon={fcIcon} onInvite={onSlot} />;
  }

  return <div className={`play-character-stage play-roster-stage${premade ? ' is-premade' : ''}${dense ? ' is-dense' : ''}`}>
    <div className="premade-wing premade-wing-left" hidden={!premade}>{premade && Array.from({ length: 4 }, (_, i) => slot(i))}</div>
    <div ref={ownRef} className="play-own-character">{children}</div>
    <div className="premade-wing premade-wing-right" hidden={!premade}>
      {premade && Array.from({ length: 4 }, (_, i) => slot(i + 4))}
    {premade && <div className="premade-roster-summary" role="status">
      <span className="premade-player-total"><strong>{roster.length || 1}/10</strong> {t('playLobbyPlayers')}</span>
      <span className="premade-role-counts" role="group" aria-label={t('playRoleDistribution')}>
        {(['FC', 'HEALER', 'DPS'] as const).map(role => <span className="premade-role-count" key={role}><strong>{counts[role]}</strong><LobbyRoleIcon role={role} fcIcon={fcIcon} /></span>)}
      </span>
    </div>}
    </div>
    {dense && <div className="premade-final-slot">{slot(8)}</div>}

  </div>;
}

function PremadeSlot({ member, index, lobby, fcIcon, onInvite }: {
  member?: GroupMember; index: number; lobby: GroupLobby; fcIcon: FcIcon; onInvite: () => void;
}) {
  const { t } = useLocale();
  const menuId = useId();
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  return <>
    <button ref={anchorRef} type="button" className={`premade-slot${member ? ' is-occupied' : ' is-empty'}`}
      disabled={lobby.loading || lobby.busy || lobby.error === 'groupAccessError' || lobby.error === 'groupLoadError'}
      popoverTarget={member ? menuId : undefined} aria-haspopup={member ? 'menu' : undefined}
      aria-expanded={member ? menuOpen : undefined} aria-controls={member ? menuId : undefined}
      onClick={member ? undefined : onInvite}
      onPointerMove={event => { const card = event.currentTarget.querySelector<HTMLElement>('.premade-card-preview .player-card'); if (card) setPlayerCardTilt(card, event, card.parentElement); }}
      onPointerLeave={event => { const card = event.currentTarget.querySelector<HTMLElement>('.premade-card-preview .player-card'); if (card) resetPlayerCardTilt(card); }}
      aria-label={member ? `${member.characterName ?? member.displayName} · ${t('playMemberOptions')}` : `${t('playOpenSlot')} ${index + 2}`}>
      {member ? <LobbyPlayerCard member={member} fcIcon={fcIcon} /> : <>
        <span className="premade-slot-plus" aria-hidden="true">+</span><span className="premade-slot-label">{t('groupInvite')}</span>
      </>}
    </button>
    {member && <LobbyMemberMenu id={menuId} anchorRef={anchorRef} member={member} lobby={lobby} onOpenChange={setMenuOpen} />}
  </>;
}

function LobbyPlayerCard({ member, fcIcon }: { member: GroupMember; fcIcon: FcIcon }) {
  const { t } = useLocale();
  const character: Character = member.character ?? { id: 0, name: member.characterName ?? member.displayName, level: 0,
    realm: { id: 0, name: member.realm ?? t('playSelectionPending'), slug: '' } };
  const avatar = <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="16" cy="10" r="5" /><path d="M6 29v-3a10 10 0 0 1 20 0v3" /></svg>;
  const roleIcon = <LobbyRoleIcon role={member.role} fcIcon={fcIcon} />;
  const crown = member.captain ? <span className="premade-captain-badge" role="img" aria-label={t('groupCaptain')} title={t('groupCaptain')}><CaptainCrown size={20} className="premade-captain-crown" /></span> : undefined;
  return <>
    <PlayerCard character={character} size="small" showLevel={!!member.character} avatarFallback={avatar} footer={roleIcon} avatarBadge={crown} />
    <span className="premade-card-preview" aria-hidden="true"><PlayerCard character={character} tilt showLevel={!!member.character} avatarFallback={avatar} headerIcon={roleIcon} footer={member.captain ? t('groupCaptain') : undefined} /></span>
  </>;
}

export function LobbyRoleIcon({ role, fcIcon }: { role: GroupMember['role']; fcIcon: FcIcon }) {
  const { t } = useLocale();
  role ??= 'DPS';
  const label = t(role === 'FC' ? 'selectionFc' : role === 'HEALER' ? 'selectionHealer' : 'selectionDps');
  const source = role === 'FC' ? fcIconAsset(fcIcon) : `/media/roles/${role === 'HEALER' ? 'heal' : 'dps'}.webp`;
  return <img className="premade-role-icon" src={source} width="24" height="24" alt={label} title={label} />;
}
