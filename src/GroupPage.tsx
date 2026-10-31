import { useEffect, useRef, useState } from 'react';
import { Link } from './LocalizedLink';
import { useLocale } from './locales';
import type { MessageKey } from './locales/en';
import './GroupPage.css';
import { useLobbyEvents } from './useLobbyEvents';
import type { Character } from './PlayerCard';

export const LOBBY_REMOVAL_NOTICE_MS = 15_000;

export type GroupMember = {
  accountId: string; displayName: string; captain: boolean; characterName: string | null; realm: string | null;
  role: 'FC' | 'HEALER' | 'DPS' | null; roleVersion: number; selectionVersion: number | null; confirmed: boolean;
  companionConnected: boolean; addonStatus: string; gamePresence: string; blockers: string[]; character?: Character | null;
};
type Invitation = { id: string; groupId: string; captainName: string; recipientName: string; expiresAt: string };
export type PremadeGroup = { id: string; captainId: string; revision: number; region: 'EU' | 'NA'; lobbyCode: string | null; members: GroupMember[]; invitations: Invitation[]; queueReady: boolean; blockers: string[] };
type Context = { season: { id: string; version: number } | null };
export const groupBlockerMessages: Record<string, MessageKey> = {
  REGION_MISMATCH: 'groupRegionMismatch', PLAY_CHARACTER_REQUIRED: 'groupCharacterRequired',
  TEN_PLAYERS_REQUIRED: 'groupNeedTen', MEMBERS_NOT_ELIGIBLE: 'groupNeedSetup',
  FOREVER_COMPATIBILITY_UNVERIFIED: 'groupForeverPending', MATCHMAKING_UNAVAILABLE: 'queuePending',
  ACCOUNT_UNAVAILABLE: 'groupAccountUnavailable', SEASON_UNAVAILABLE: 'groupSeasonUnavailable',
  SELECTION_REQUIRED: 'groupSelectionRequired', SELECTION_INVALID: 'groupSelectionInvalid',
  COMPANION_DISCONNECTED: 'companionPresenceDisconnected', CAPTURE_PERMISSION_REQUIRED: 'groupCaptureRequired',
  ADDON_STATUS_UNVERIFIED: 'groupAddonUnknown', MATCH_UNRESOLVED: 'groupMatchUnresolved',
};
function validInvitation(v: any): v is Invitation {
  return v && typeof v.id === 'string' && typeof v.groupId === 'string' && typeof v.captainName === 'string'
    && typeof v.recipientName === 'string' && typeof v.expiresAt === 'string' && Number.isFinite(Date.parse(v.expiresAt));
}
function validMemberCharacter(v: any): v is Character | null | undefined {
  if (v == null) return true; // Older snapshots and selections still have a neutral card.
  const named = (ref: any) => ref == null || (typeof ref === 'object'
    && (ref.name == null || typeof ref.name === 'string') && (ref.id == null || Number.isSafeInteger(ref.id))
    && (ref.type == null || typeof ref.type === 'string'));
  const image = (url: unknown) => {
    if (url == null) return true;
    if (typeof url !== 'string') return false;
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:' && !parsed.username && !parsed.password
        && ['.worldofwarcraft.com', '.blizzard.com', '.blizzardstatic.com', '.battle.net'].some(host => parsed.hostname.endsWith(host));
    } catch { return false; }
  };
  return Number.isSafeInteger(v.id) && v.id > 0 && typeof v.name === 'string' && Number.isSafeInteger(v.level) && v.level >= 60
    && v.realm && Number.isSafeInteger(v.realm.id) && typeof v.realm.slug === 'string' && (v.realm.name == null || typeof v.realm.name === 'string')
    && typeof v.namespace === 'string' && /^profile-classic(1x|ann)?-(eu|us)$/.test(v.namespace)
    && [v.playable_class, v.playable_race, v.faction, v.guild, v.gender].every(named) && image(v.avatarUrl) && image(v.insetUrl);
}
function validGroup(v: any): v is PremadeGroup | null {
  return v === null || v && typeof v.id === 'string' && typeof v.captainId === 'string' && Number.isSafeInteger(v.revision)
    && ['EU', 'NA'].includes(v.region) && v.revision >= 0 && (v.lobbyCode === null || typeof v.lobbyCode === 'string' && /^[A-HJ-NP-Z2-9]{8}$/.test(v.lobbyCode))
    && typeof v.queueReady === 'boolean' && Array.isArray(v.blockers) && v.blockers.every((r: unknown) => typeof r === 'string')
    && Array.isArray(v.invitations) && v.invitations.every(validInvitation) && Array.isArray(v.members) && v.members.length <= 10
    && v.members.every((m: any) => m && typeof m.accountId === 'string' && typeof m.displayName === 'string' && typeof m.captain === 'boolean'
      && (m.characterName === null || typeof m.characterName === 'string') && (m.realm === null || typeof m.realm === 'string')
      && [null, 'FC', 'HEALER', 'DPS'].includes(m.role) && Number.isSafeInteger(m.roleVersion) && m.roleVersion >= 0 && (m.selectionVersion === null || Number.isSafeInteger(m.selectionVersion))
      && validMemberCharacter(m.character) && typeof m.confirmed === 'boolean' && typeof m.companionConnected === 'boolean' && typeof m.addonStatus === 'string'
      && typeof m.gamePresence === 'string' && Array.isArray(m.blockers) && m.blockers.every((r: unknown) => typeof r === 'string'));
}
class GroupError extends Error { constructor(public status: number, public detail = '') { super('Group request failed'); } }
async function request(path: string, signal: AbortSignal, body?: unknown) {
  const headers: Record<string, string> = {};
  if (body !== undefined) {
    const token = document.cookie.split('; ').find(c => c.startsWith('XSRF-TOKEN='))?.slice(11);
    if (!token) throw new GroupError(0);
    headers['X-XSRF-TOKEN'] = decodeURIComponent(token); headers['Content-Type'] = 'application/json';
  }
  const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', signal,
    method: body === undefined ? 'GET' : 'POST', headers, body: body === undefined ? undefined : JSON.stringify(body) });
  if (!response.ok) {
    let detail = '';
    try { detail = (await response.json()).detail ?? ''; } catch { /* Status still provides a safe fallback. */ }
    throw new GroupError(response.status, detail);
  }
  const value = await response.text();
  return value ? JSON.parse(value) : null;
}

export function useGroupLobby(accountId: string, active = true, receiveInvitations = false) {
  const { language } = useLocale();
  const [group, setGroup] = useState<PremadeGroup | null>(null);
  const [incoming, setIncoming] = useState<Invitation[]>([]);
  const [context, setContext] = useState<Context | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const [battleTag, setBattleTag] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [removalNotice, setRemovalNotice] = useState<{ expiresAt: string } | null>(null);
  const controller = useRef<AbortController | null>(null);
  const mutating = useRef(false);
  const refreshing = useRef<AbortController | null>(null);
  const lastSnapshotAt = useRef(0);
  const initialized = useRef(false);
  const fullSnapshotPending = useRef(false);
  const eventPending = useRef(false);
  const eventTimer = useRef<number | null>(null);
  const mounted = useRef(true);
  const groupRef = useRef(group); groupRef.current = group;
  const me = group?.members.find(m => m.accountId === accountId);
  const captain = group?.captainId === accountId;

  function failure(reason: unknown, mutation: boolean) {
    if (!mounted.current) return;
    if (reason instanceof GroupError && [401, 403].includes(reason.status)) {
      groupRef.current = null; setGroup(null); setIncoming([]); setContext(null); setError('groupAccessError');
    } else setError(reason instanceof GroupError && reason.status === 429 ? 'groupCodeRateLimit'
      : reason instanceof GroupError && reason.detail === 'This player has selected a character from a different lobby region' ? 'groupRegionMismatch'
      : reason instanceof GroupError && ['This player needs to select a character in Play first', 'Select a character in Play first'].includes(reason.detail) ? 'groupCharacterRequired'
      : reason instanceof GroupError && reason.detail === 'This group already has ten players' ? 'groupFull'
      : reason instanceof GroupError && reason.detail === 'This player already belongs to a group' ? 'groupAlreadyMember'
      : reason instanceof GroupError && reason.detail === 'Could not invite this BattleTag. Check that the player has signed in to rbgs.io' ? 'groupInviteUnknown'
      : reason instanceof GroupError && reason.detail === 'This invitation has expired' ? 'groupInviteExpired'
      : reason instanceof GroupError && ['Resolve the current match before joining a group', 'Resolve your current match before preparing for another one'].includes(reason.detail) ? 'groupMatchBlocked'
      : reason instanceof GroupError && reason.status === 409 ? 'groupConflict'
      : reason instanceof GroupError && reason.status === 404 ? 'groupGone' : mutation ? 'groupActionError' : 'groupLoadError');
  }
  async function snapshot(signal: AbortSignal, invitationsOnly = false) {
    if (invitationsOnly && !fullSnapshotPending.current) {
      const invites = await request('/api/v1/me/group-invitations', signal);
      // Keep acceptance eligibility current across tabs/devices whenever an invite is pending.
      const owned = !initialized.current || (Array.isArray(invites) && invites.length > 0)
        ? await request('/api/v1/me/group', signal) : undefined;
      if (!Array.isArray(invites) || !invites.every(validInvitation) || (owned !== undefined && !validGroup(owned))) throw new Error('Invalid invitation response');
      if (!signal.aborted && mounted.current) {
        setIncoming(invites); lastSnapshotAt.current = Date.now(); initialized.current = true;
        if (owned !== undefined) { groupRef.current = owned; setGroup(owned); }
      }
      return groupRef.current;
    }
    const [next, invites, play] = await Promise.all([
      request('/api/v1/me/group', signal), request('/api/v1/me/group-invitations', signal), request('/api/v1/play/context', signal),
    ]);
    if (!validGroup(next) || !Array.isArray(invites) || !invites.every(validInvitation)
      || !play || !(play.season === null || play.season && typeof play.season.id === 'string' && Number.isSafeInteger(play.season.version)))
      throw new Error('Invalid group response');
    if (!signal.aborted && mounted.current) {
      groupRef.current = next; lastSnapshotAt.current = Date.now(); initialized.current = true; fullSnapshotPending.current = false;
      setGroup(next); setIncoming(invites); setContext(play);
    }
    return next as PremadeGroup | null;
  }
  function queueEventRefresh() {
    eventPending.current = true;
    if (eventTimer.current !== null || !mounted.current) return;
    eventTimer.current = window.setTimeout(() => {
      eventTimer.current = null;
      if (!mounted.current || mutating.current || (refreshing.current && !refreshing.current.signal.aborted)) return;
      eventPending.current = false;
      void reload(false, true);
    }, 75);
  }
  async function reload(manual = false, eventDriven = false) {
    if (mutating.current || (refreshing.current && !refreshing.current.signal.aborted)) return;
    if (!manual && !eventDriven && Date.now() - lastSnapshotAt.current < 1000) return;
    controller.current?.abort();
    const current = new AbortController(); controller.current = current;
    refreshing.current = current;
    const timeout = window.setTimeout(() => current.abort(), 10000);
    if (manual) setError(null);
    try {
      await snapshot(current.signal, receiveInvitations && !active);
      if (!current.signal.aborted && mounted.current) setError(previous => previous === 'groupLoadError' ? null : previous);
    }
    catch (reason) { if (controller.current === current) failure(reason, false); }
    finally {
      window.clearTimeout(timeout);
      if (refreshing.current === current) refreshing.current = null;
      if (mounted.current && controller.current === current) setLoading(false);
      if (mounted.current && eventPending.current) queueEventRefresh();
    }
  }
  const streamConnected = useLobbyEvents(accountId, (active || receiveInvitations) && error !== 'groupAccessError', queueEventRefresh, () => {
    if (!mounted.current) return;
    setRemovalNotice({ expiresAt: new Date(Date.now() + LOBBY_REMOVAL_NOTICE_MS).toISOString() });
    fullSnapshotPending.current = true;
  });
  useEffect(() => {
    mounted.current = true;
    lastSnapshotAt.current = 0; initialized.current = false;
    void reload();
    return () => {
      mounted.current = false; controller.current?.abort(); eventPending.current = false;
      if (eventTimer.current !== null) window.clearTimeout(eventTimer.current);
      eventTimer.current = null;
    };
  }, [accountId]);
  // Outside Premade only invitation delivery stays active; the roster resumes on entering Premade.
  const pollDelay = streamConnected ? 60000 : !active && receiveInvitations ? 15000 : (group?.members.length ?? 0) > 1 || incoming.length > 0 || (group?.invitations.length ?? 0) > 0 ? 15000 : 60000;
  useEffect(() => {
    if (active && !document.hidden && lastSnapshotAt.current > 0) { fullSnapshotPending.current = true; queueEventRefresh(); }
    const timer = active || receiveInvitations ? window.setInterval(() => { if (!document.hidden) void reload(); }, pollDelay) : null;
    const focus = () => { if (!document.hidden) void reload(); };
    document.addEventListener('visibilitychange', focus);
    window.addEventListener('focus', focus);
    return () => {
      if (timer !== null) window.clearInterval(timer);
      document.removeEventListener('visibilitychange', focus);
      window.removeEventListener('focus', focus);
    };
  }, [accountId, active, receiveInvitations, pollDelay]);
  useEffect(() => { setCopied(false); }, [group?.id, group?.captainId, group?.lobbyCode]);

  async function action(path: string, body: unknown) {
    if (mutating.current) return false;
    mutating.current = true; setBusy(true); setError(null);
    controller.current?.abort();
    const current = new AbortController(); controller.current = current;
    const timeout = window.setTimeout(() => current.abort(), 10000);
    try {
      const response = await request(path, current.signal, body);
      // Read again after each command; never infer queue entry from a successful preparation command.
      if (path.endsWith('/role')) {
        if (!validGroup(response) || !response) throw new Error('Invalid lobby role response');
        if (!current.signal.aborted && mounted.current) {
          groupRef.current = response; lastSnapshotAt.current = Date.now(); setGroup(response);
        }
      } else await snapshot(current.signal);
      if (mounted.current) { setBattleTag(''); setJoinCode(''); }
      return !current.signal.aborted && mounted.current;
    } catch (reason) {
      if (path === '/api/v1/groups' && reason instanceof GroupError && reason.status === 409) {
        // Recover an existing group created in another tab or by an earlier successful request.
        try { if (await snapshot(current.signal)) { if (mounted.current) setError(null); return true; } }
        catch (refreshError) { failure(refreshError, true); return false; }
      }
      if (mounted.current && path === '/api/v1/groups/join' && reason instanceof GroupError && reason.status === 404) setError('groupCodeUnavailable');
      else {
        failure(reason, true);
        if (path.endsWith('/role') && reason instanceof GroupError && reason.status === 409) {
          try { await snapshot(current.signal); } catch { /* Keep the original conflict visible. */ }
        }
      }
      return false;
    }
    finally {
      window.clearTimeout(timeout); mutating.current = false;
      if (mounted.current) { setBusy(false); if (eventPending.current) queueEventRefresh(); }
    }
  }
  const command = (suffix: string, body: object = {}) => {
    const current = groupRef.current;
    return current ? action(`/api/v1/groups/${current.id}/${suffix}`, { expectedRevision: current.revision, ...body }) : Promise.resolve(false);
  };
  const updateRole = (role: 'FC' | 'HEALER' | 'DPS') => {
    const current = groupRef.current;
    const member = current?.members.find(item => item.accountId === accountId);
    return current && member ? action(`/api/v1/groups/${current.id}/role`, { role, expectedRoleVersion: member.roleVersion }) : Promise.resolve(false);
  };
  const expires = (at: string) => new Date(at).toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' });
  async function copyCode() {
    if (!group?.lobbyCode) return;
    try { await navigator.clipboard.writeText(group.lobbyCode); if (mounted.current) setCopied(true); }
    catch { if (mounted.current) setError('groupCopyError'); }
  }

  return { accountId, group, incoming, context, loading, busy, error, battleTag, setBattleTag, joinCode, setJoinCode,
    copied, me, captain, reload, action, command, updateRole, expires, copyCode,
    removalNotice, dismissRemovalNotice: () => setRemovalNotice(null) };
}

export type GroupLobby = ReturnType<typeof useGroupLobby>;

export function GroupPage({ accountId }: { accountId: string }) {
  const { t } = useLocale();
  const lobby = useGroupLobby(accountId);
  return <main className="content group-page">
    <header><h1>{t('navigationGroup')}</h1><p>{t('groupIntro')}</p></header>
    <Link to="/play?mode=premade">{t('groupEditSelection')}</Link>
    <GroupControls lobby={lobby} />
  </main>;
}

export function GroupControls({ lobby, showRoster = true, selectionDirty = false }: {
  lobby: GroupLobby; showRoster?: boolean; selectionDirty?: boolean;
}) {
  const { t } = useLocale();
  const { accountId, group, incoming, loading, busy, error, battleTag, setBattleTag, joinCode, setJoinCode,
    copied, captain, reload, action, command, expires, copyCode } = lobby;

  return <div className="group-page group-controls">
    <div className="group-toolbar"><button disabled={busy} onClick={() => void reload(true)}>{t('groupRefresh')}</button>
      </div>
    {error && <p role="alert">{t(error)}</p>}
    {error === 'groupMatchBlocked' && <Link to="/match-history">{t('navigationHistory')}</Link>}
    {loading ? <p role="status">{t('groupLoading')}</p> : <>
      {incoming.length > 0 && <section aria-labelledby="group-incoming"><h2 id="group-incoming">{t('groupInvitations')}</h2>
        <ul className="group-invitations">{incoming.map(invite => <li key={invite.id}>
          <span>{invite.captainName} · {t('groupExpires')} <time dateTime={invite.expiresAt}>{expires(invite.expiresAt)}</time></span>
          <div><button disabled={busy || !!group} onClick={() => void action(`/api/v1/me/group-invitations/${invite.id}/accept`, {})}>{t('groupAccept')}</button>
            <button disabled={busy} onClick={() => void action(`/api/v1/me/group-invitations/${invite.id}/decline`, {})}>{t('groupDecline')}</button></div>
        </li>)}</ul></section>}
      {group ? <>
        <section aria-labelledby="group-code-heading"><h2 id="group-code-heading">{t('groupLobbyCode')}</h2>
          <p>{t('groupCodeHelp')}</p>
          {group.lobbyCode ? <div className="group-invite-control">
            <label className="group-code-label" htmlFor="group-share-code">{t('groupLobbyCode')}</label>
            <input id="group-share-code" value={group.lobbyCode} readOnly onFocus={event => event.target.select()} autoComplete="off" spellCheck={false} />
            <button disabled={busy} onClick={() => void copyCode()}>{t(copied ? 'groupCodeCopied' : 'groupCopyCode')}</button>
          </div> : <p>{t('groupCodeDisabled')}</p>}
          {captain && <div className="group-member-actions">
            <button disabled={busy} onClick={() => command('code', { enabled: true })}>{t(group.lobbyCode ? 'groupRegenerateCode' : 'groupEnableCode')}</button>
            {group.lobbyCode && <button disabled={busy} onClick={() => command('code', { enabled: false })}>{t('groupDisableCode')}</button>}
          </div>}
        </section>
        {showRoster && <section aria-labelledby="group-roster"><h2 id="group-roster">{t('groupRoster')} · {group.members.length}/10</h2>
          <ul className="group-roster">{group.members.map(member => <li key={member.accountId}>
            <div className="group-member-heading"><strong>{member.displayName}</strong>{member.captain && <span>{t('groupCaptain')}</span>}
              {member.accountId === accountId && <span>{t('groupYou')}</span>}</div>
            <p>{member.characterName ? `${member.characterName} · ${member.realm} · ${member.role}` : t('groupSelectionRequired')}</p>
            <details><summary>{t('groupSetupDetails')}</summary>
              <p>{t(member.companionConnected ? 'companionPresenceConnected' : 'companionPresenceDisconnected')}</p>
              <p>{t('groupGameUnknown')}</p>
              <ul>{member.blockers.map(reason => <li key={reason}>{t(groupBlockerMessages[reason] ?? 'groupNeedSetup')}</li>)}</ul>
            </details>
            {captain && member.accountId !== accountId && <div className="group-member-actions">
              <button disabled={busy} onClick={() => command('captain', { accountId: member.accountId })}>{t('groupTransfer')}</button>
              <button disabled={busy} onClick={() => command('members/remove', { accountId: member.accountId })}>{t('groupRemove')}</button>
            </div>}
          </li>)}</ul>
        </section>}
        {captain && <section aria-labelledby="group-invite"><h2 id="group-invite">{t('groupInvite')}</h2>
          <form onSubmit={event => { event.preventDefault(); command('invitations', { battleTag: battleTag.trim() }); }}>
            <label htmlFor="group-battletag">BattleTag</label>
            <div className="group-invite-control"><input id="group-battletag" value={battleTag} onChange={event => setBattleTag(event.target.value)}
              required maxLength={100} pattern="[^#]+#[0-9]+" placeholder="Player#1234" disabled={busy || group.members.length >= 10} />
              <button disabled={busy || group.members.length >= 10 || !battleTag.trim()}>{t('groupInvite')}</button></div>
            <p>{t('groupInviteHelp')}</p>
          </form>
          {group.invitations.length > 0 && <ul className="group-invitations">{group.invitations.map(invite => <li key={invite.id}>
            <span>{invite.recipientName} · {t('groupExpires')} <time dateTime={invite.expiresAt}>{expires(invite.expiresAt)}</time></span>
            <button disabled={busy} onClick={() => command(`invitations/${invite.id}/cancel`)}>{t('groupCancelInvite')}</button>
          </li>)}</ul>}
        </section>}
        <section className="group-preparation" aria-labelledby="group-preparation"><h2 id="group-preparation">{t('playLobbyRequirements')}</h2>
          <p>{t('playLobbyRequirementsHelp')}</p>
          {selectionDirty && <p>{t('playSaveBeforeMatch')}</p>}
          <ul>{group.blockers.map(reason => <li key={reason}>{t(groupBlockerMessages[reason] ?? 'groupNeedSetup')}</li>)}</ul>
          {showRoster && <button disabled>{t('groupQueue')}</button>}
        </section>
        <button disabled={busy} onClick={() => command('members/remove', { accountId })}>{t('groupLeave')}</button>
      </> : <>
        <section><h2>{t('groupNoGroup')}</h2><p>{t('groupCreateHelp')}</p>
          <button disabled={busy || error === 'groupAccessError' || error === 'groupLoadError'} onClick={() => void action('/api/v1/groups', {})}>{t('groupCreate')}</button></section>
        <section aria-labelledby="group-join-heading"><h2 id="group-join-heading">{t('groupJoinCode')}</h2>
          <form onSubmit={event => { event.preventDefault(); void action('/api/v1/groups/join', { code: joinCode.trim() }); }}>
            <label htmlFor="group-join-code">{t('groupLobbyCode')}</label>
            <div className="group-invite-control"><input id="group-join-code" value={joinCode} onChange={event => setJoinCode(event.target.value.toUpperCase())}
              required minLength={8} maxLength={8} pattern="[A-HJ-NP-Z2-9]{8}" autoCapitalize="characters" autoComplete="off" spellCheck={false} disabled={busy} />
              <button disabled={busy || !joinCode.trim()}>{t('groupJoin')}</button></div>
          </form>
        </section>
      </>}
    </>}
    {busy && <p role="status">{t('groupSaving')}</p>}
  </div>;
}
