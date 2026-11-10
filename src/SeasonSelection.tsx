import { useEffect, useId, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Link } from './LocalizedLink';
import { RoleSelection, type MatchRole as Role } from './RoleSelection';
import { CaptainConsent } from './CaptainConsent';
import { useFcIconPreference } from './fc-icon-preference';
import { CharacterSelection } from './CharacterSelection';
import { CompanionStatus } from './CompanionStatus';
import { PlayerCardSkeleton, type Character } from './PlayerCard';
import { useLocale } from './locales';
import type { MessageKey } from './locales/en';
import './SeasonSelection.css';
import { groupBlockerMessages, useGroupLobby, type GroupLobby } from './GroupPage';
import { PlayLobbyStage, PlayLobbyCode, PlayModeButton, LobbyRoleIcon } from './PlayLobby';
import { LobbyActions } from './LobbyActions';
import { useLobbySession } from './LobbySession';
import { LobbyInvitationNotifications } from './LobbyInvitationNotifications';
import { useLobbyDialogs } from './LobbyDialogs';
import { MessageNotification } from './FloatingNotifications';
import { usePremadeQueueSession, useSoloQueueSession } from './SoloQueueSession';
import { SoloQueuePanel } from './SoloQueuePanel';

type Selection = {
  characterId: string; name: string; realm: string; source: 'DECLARED' | 'BLIZZARD_VERIFIED';
  ratingSubjectType: 'ACCOUNT' | 'CHARACTER'; ratingSubjectId: string; role: Role | null;
  captainConsent: boolean; version: number; validForSeason: boolean;
};
type Context = {
  season: { id: string; name: string; kind: 'BETA' | 'PUBLIC'; ratingSubjectType: 'ACCOUNT' | 'CHARACTER'; version: number } | null;
  selection: Selection | null; ownershipVerification: string; matchmakingAvailable: boolean;
};

function validContext(value: unknown): value is Context {
  if (!value || typeof value !== 'object') return false;
  const data = value as Context;
  return typeof data.matchmakingAvailable === 'boolean' && typeof data.ownershipVerification === 'string'
    && (data.season === null ? data.selection === null : (!!data.season && typeof data.season.id === 'string'
    && typeof data.season.name === 'string' && Number.isInteger(data.season.version)
    && ['ACCOUNT', 'CHARACTER'].includes(data.season.ratingSubjectType)
    && (data.selection === null || validSelection(data.selection))));
}
function validSelection(value: unknown): value is Selection {
  if (!value || typeof value !== 'object') return false;
  const data = value as Selection;
  return typeof data.characterId === 'string' && typeof data.name === 'string'
    && typeof data.realm === 'string' && Number.isInteger(data.version) && data.version >= 0
    && (data.role === null || ['FC', 'HEALER', 'DPS'].includes(data.role)) && typeof data.captainConsent === 'boolean'
    && ['DECLARED', 'BLIZZARD_VERIFIED'].includes(data.source)
    && ['ACCOUNT', 'CHARACTER'].includes(data.ratingSubjectType)
    && typeof data.ratingSubjectId === 'string' && typeof data.validForSeason === 'boolean';
}

function storedPremadeRole(accountId: string): Role {
  try {
    const value = localStorage.getItem(`rbgs.premade-role.${accountId}`);
    return value === 'FC' || value === 'HEALER' || value === 'DPS' ? value : 'DPS';
  } catch { return 'DPS'; }
}

export function SeasonSelection({ accountId }: { accountId: string }) {
  const shared = useLobbySession();
  return shared ? <SeasonSelectionContent accountId={accountId} lobby={shared} /> : <StandaloneSeasonSelection accountId={accountId} />;
}
function StandaloneSeasonSelection({ accountId }: { accountId: string }) {
  const [params] = useSearchParams();
  const lobby = useGroupLobby(accountId, params.get('mode') === 'premade', true);
  return <><SeasonSelectionContent accountId={accountId} lobby={lobby} /><LobbyInvitationNotifications lobby={lobby} /></>;
}
function SeasonSelectionContent({ accountId, lobby }: { accountId: string; lobby: GroupLobby }) {
  const { t } = useLocale();
  const [params, setParams] = useSearchParams();
  const premade = params.get('mode') === 'premade';
  const modeChosen = useRef(false);
  function chooseMode(next: boolean) {
    if (lobby.loading || lobby.busy || queueBusy || queueActive) return;
    modeChosen.current = true;
    setParams(previous => { const nextParams = new URLSearchParams(previous); nextParams.set('mode', next ? 'premade' : 'solo'); return nextParams; }, { replace: true });
  }
  useEffect(() => {
    if (lobby.loading || modeChosen.current) return;
    modeChosen.current = true;
    if (lobby.group && !params.has('mode')) setParams(previous => { const next = new URLSearchParams(previous); next.set('mode', 'premade'); return next; }, { replace: true });
  }, [lobby.loading, lobby.group, params, setParams]);
  const { icon: fcIcon } = useFcIconPreference(accountId);
  const [context, setContext] = useState<Context | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<MessageKey | null>(null);
  const [saved, setSaved] = useState(false);
  const soloQueue = useSoloQueueSession(), premadeQueue = usePremadeQueueSession();
  const queue = premade ? premadeQueue : soloQueue;
  const queuedTicket = queue?.status?.ticket?.state === 'QUEUED' ? queue.status.ticket : null;
  const queueBusy = !!soloQueue?.busy || !!premadeQueue?.busy;
  const queueActive = !!soloQueue?.active || !!premadeQueue?.active;
  const queueChecking = !soloQueue?.status || !premadeQueue?.status;
  const [character, setCharacter] = useState<Character | null>(null);
  const [role, setRole] = useState<Role>('DPS');
  const [premadeRole, setPremadeRole] = useState<Role>(() => storedPremadeRole(accountId));
  const seededRoleGroup = useRef<string | null>(null);
  const draftPremadeRole = useRef<Role | null>(null);
  const lastSavedDevice = useRef<string | null>(null);
  const autoSaveAttempt = useRef<string | null>(null);
  const [captainConsent, setCaptainConsent] = useState(false);
  const [companionDeviceId, setCompanionDeviceId] = useState<string | null>(null);
  const saveController = useRef<AbortController | null>(null);

  useEffect(() => () => { saveController.current?.abort(); saveController.current = null; }, []);
  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    let disposed = false;
    setLoading(true); setError(null); setSaved(false); setCharacter(null);
    fetch('/api/v1/play/context', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Context unavailable');
        const data: unknown = await response.json();
        if (!validContext(data)) throw new Error('Invalid context');
        if (disposed || controller.signal.aborted) return;
        setContext(data);
        setRole(data.selection?.role ?? 'DPS');
        setCaptainConsent(data.selection?.captainConsent ?? false);
      })
      .catch(() => { if (!disposed) { setContext(null); setError('selectionLoadError'); } })
      .finally(() => { window.clearTimeout(timeout); if (!disposed) setLoading(false); });
    return () => { disposed = true; controller.abort(); window.clearTimeout(timeout); };
  }, [accountId, attempt]);

  const contextStale = !!context && (!!lobby.context && (lobby.context.season?.id !== context.season?.id
    || lobby.context.season?.version !== context.season?.version)
    || !!lobby.me && lobby.me.selectionVersion !== (context.selection?.version ?? null));
  const canSave = !queueActive && !queueBusy && !loading && !saving && !contextStale && context?.season?.ratingSubjectType === 'ACCOUNT'
    && !!character && (premade || !!role) && !!companionDeviceId && error !== 'selectionConflict';
  const selectionDirty = contextStale || !context?.selection || !character || context.selection.name !== character.name
    || context.selection.realm !== (character.realm.name || character.realm.slug)
    || (!premade && (context.selection.role !== role || context.selection.captainConsent !== captainConsent));
  const onJoined = () => {
    modeChosen.current = true;
    setParams(previous => { const next = new URLSearchParams(previous); next.set('mode', 'premade'); return next; }, { replace: true });
  };
  const { openSlot, dialogs } = useLobbyDialogs(lobby, onJoined);
  const premadeCount = lobby.group?.members.length ?? 1;
  const incompletePremade = premade && premadeCount < 10;
  const queueBlockers = queue?.status?.blockers ?? [];
  const seasonMessage = queueBlockers.includes('SEASON_NOT_STARTED') ? 'soloQueueSeasonPending'
    : queueBlockers.includes('SEASON_UNAVAILABLE') ? 'groupSeasonUnavailable' : null;
  const matchSteps: MessageKey[] = [];
  if (seasonMessage) {
    matchSteps.push(seasonMessage);
  } else if (premade) {
    if (incompletePremade) matchSteps.push('groupNeedTen');
    if (lobby.group && !lobby.captain) matchSteps.push('playLeaderStartsMatch');
    if (!character) matchSteps.push('playChooseCharacter');
    const reasons: Record<string,MessageKey> = {...groupBlockerMessages,
      GROUP_REQUIRED:'groupNeedTen', GROUPING_INCOMPATIBLE:'premadeGroupingIncompatible',
      GAME_PRESENCE_UNVERIFIED:'soloQueueGamePending', PREMADE_COMPETITIVE_DATA_UNAVAILABLE:'soloQueueDataPending',
      MATCH_ROOM_UNAVAILABLE:'soloQueueRoomPending'};
    for(const reason of queueBlockers)if(reasons[reason])matchSteps.push(reasons[reason]);
    const hasSetupIssue = lobby.group?.members.some(member => member.blockers.some(reason => reason !== 'ADDON_STATUS_UNVERIFIED'));
    if (hasSetupIssue) matchSteps.push('groupNeedSetup');
    for (const reason of lobby.me?.blockers ?? []) {
      if (reason !== 'ADDON_STATUS_UNVERIFIED' && groupBlockerMessages[reason]) matchSteps.push(reason === 'SELECTION_REQUIRED' ? 'playChooseCharacter' : groupBlockerMessages[reason]);
    }
  } else {
    const soloBlockerMessages: Record<string, MessageKey> = {
      ...groupBlockerMessages,
      GROUP_MEMBERSHIP_EXISTS: 'playLeaveForSolo',
      GAME_PRESENCE_UNVERIFIED: 'soloQueueGamePending',
      COMPETITIVE_DATA_UNAVAILABLE: 'soloQueueDataPending',
      MATCH_ROOM_UNAVAILABLE: 'soloQueueRoomPending',
    };
    for (const reason of queueBlockers) {
      matchSteps.push(reason === 'SELECTION_REQUIRED' ? 'playChooseCharacter' : soloBlockerMessages[reason] ?? 'queuePending');
    }
  }
  const matchMessages = [...new Set(matchSteps)];
  const hasMatchTooltip = matchMessages.length > 0;
  const matchTooltipId = useId();
  const [matchTooltipOpen, setMatchTooltipOpen] = useState(false);
  const [matchTooltipDismissed, setMatchTooltipDismissed] = useState(false);
  const preseasonPreview = context?.matchmakingAvailable === true;
  const canFind = !!character && !queueChecking && !seasonMessage && !queueActive && !loading && !saving && !queueBusy && !lobby.loading && !lobby.busy && !lobby.error && (premade
    ? premadeCount === 10 && !!lobby.captain
    : canSave && !lobby.group);
  async function findMatch() {
    if (!canFind) return;
    if (canSave) {
      const selection = await saveSelection();
      if (selection && context?.season && queue) {
        if(premade && lobby.group) await queue.enter({groupId:lobby.group.id,groupRevision:lobby.group.revision});
        else if(!premade) await queue.enter({seasonId: context.season.id, seasonVersion: context.season.version, selectionVersion: selection.version});
      }
    }
    else if (contextStale || error === 'selectionConflict') setError('selectionConflict');
    else if (!context?.season) setError('groupSeasonUnavailable');
    else if (!character || (!premade && !role)) setError('groupSelectionRequired');
    else if (!companionDeviceId) setError('selectionCompanionRequired');
  }
  async function saveSelection() {
    if (!canSave || !context?.season || !character || (!premade && !role) || saveController.current) return;
    const controller = new AbortController();
    saveController.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    setSaving(true); setError(null); setSaved(false);
    try {
      const cookie = document.cookie.split('; ').find(value => value.startsWith('XSRF-TOKEN='))?.slice('XSRF-TOKEN='.length);
      if (!cookie) throw new Error('Missing CSRF');
      const response = await fetch(premade ? '/api/v1/me/premade-selection' : '/api/v1/me/selection', {
        method: 'PUT', credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': decodeURIComponent(cookie) },
        body: JSON.stringify({
          seasonId: context.season.id, seasonVersion: context.season.version,
          expectedVersion: context.selection?.version ?? null,
          declaration: { name: character.name, realm: character.realm.name || character.realm.slug },
          ...(!premade ? { role, captainConsent } : {}), companionDeviceId,
        }),
      });
      if (controller.signal.aborted) return;
      if (!response.ok) {
        if (response.status === 412) {
          setCompanionDeviceId(null);
          setError('selectionCompanionRequired');
        } else setError(response.status === 409 ? 'selectionConflict' : 'selectionSaveError');
        return;
      }
      const selection: unknown = await response.json();
      if (controller.signal.aborted) return;
      if (!validSelection(selection)) throw new Error('Invalid saved selection');
      setContext({ ...context, selection });
      if (!premade) setCaptainConsent(selection.captainConsent);
      lastSavedDevice.current = companionDeviceId;
      setSaved(true);
      await lobby.reload(true);
      return selection;
    } catch {
      if (saveController.current === controller) setError('selectionSaveError');
    } finally {
      window.clearTimeout(timeout);
      if (saveController.current === controller) { saveController.current = null; setSaving(false); }
    }
  }

  function rememberPremadeRole(value: Role) {
    setPremadeRole(value);
    try {
      localStorage.setItem(`rbgs.premade-role.${accountId}`, value);
    } catch { /* The lobby role still works without browser storage. */ }
  }
  async function changePremadeRole(value: Role) {
    rememberPremadeRole(value);
    if (!lobby.group) { draftPremadeRole.current = value; return; }
    if (!await lobby.updateRole(value)) rememberPremadeRole(lobby.me?.role ?? 'DPS');
  }
  useEffect(() => {
    setPremadeRole(storedPremadeRole(accountId)); seededRoleGroup.current = null; draftPremadeRole.current = null;
    lastSavedDevice.current = null; autoSaveAttempt.current = null;
  }, [accountId]);
  useEffect(() => {
    if (!lobby.group) { seededRoleGroup.current = null; return; }
    if (!premade || lobby.loading || lobby.busy || seededRoleGroup.current === lobby.group.id) return;
    seededRoleGroup.current = lobby.group.id;
    const draft = draftPremadeRole.current;
    draftPremadeRole.current = null;
    if (draft && draft !== lobby.me?.role) void changePremadeRole(draft);
    else rememberPremadeRole(lobby.me?.role ?? 'DPS');
  }, [premade, lobby.group?.id, lobby.loading, lobby.busy, premadeRole]);
  useEffect(() => {
    if (!premade || !canSave || lobby.busy || (!selectionDirty && lastSavedDevice.current === companionDeviceId)) return;
    const key = JSON.stringify([accountId, context?.season, context?.selection?.version, character?.name, character?.realm, companionDeviceId]);
    if (autoSaveAttempt.current === key) return;
    const timer = window.setTimeout(() => { autoSaveAttempt.current = key; void saveSelection(); }, 350);
    return () => window.clearTimeout(timer);
  }, [premade, canSave, lobby.busy, selectionDirty, accountId, context, character, companionDeviceId]);

  const captainControl = <CaptainConsent selected={premade ? !!lobby.captain : captainConsent}
    disabled={loading || !character || saving || queueBusy || queueActive}
    readOnly={premade} label={premade ? t('playLobbyCaptain') : undefined}
    tooltip={premade ? t(lobby.captain ? 'playYouAreLobbyCaptain' : 'playLobbyCaptain') : undefined}
    onChange={value => { setCaptainConsent(value); setSaved(false); }} />;
  const roleControl = <RoleSelection fcIcon={fcIcon} legendLabel={premade ? 'playLobbyRole' : 'selectionRole'}
    value={premade ? lobby.me?.role ?? premadeRole : role}
    disabled={loading || !character || saving || queueBusy || queueActive || (premade && (lobby.loading || lobby.busy))}
    onChange={value => { if (premade) void changePremadeRole(value); else { setRole(value); setSaved(false); } }} />;
  let content;
  if (loading) content = <section className="season-selection" aria-label={t('selectionHeading')}>
    {captainControl}
    <PlayerCardSkeleton small={premade && premadeCount >= 9} />
    {roleControl}
  </section>;
  else if (!context) content = <>
    <MessageNotification message={error ?? 'selectionLoadError'} attempt={attempt} />
    <button type="button" onClick={() => setAttempt(value => value + 1)}>{t('charactersRetry')}</button>
  </>;
  else if (context.season?.ratingSubjectType === 'CHARACTER') content = <>
    <h2>{context.season.name}</h2>
    {context.selection && <p>{context.selection.name} {"\u00b7"} {context.selection.realm}</p>}
    <p role="status">{t('selectionVerificationPending')}</p>
  </>;
  else content = <section className="season-selection" aria-label={t('selectionHeading')}>
    {captainControl}
    <CharacterSelection small={premade && premadeCount >= 9} accountId={accountId} preferred={context.selection ?? undefined} disabled={saving || queueBusy || queueActive}
      previewHeaderIcon={premade ? <LobbyRoleIcon role={lobby.me?.role ?? premadeRole} fcIcon={fcIcon} /> : undefined}
      smallFooter={premade ? <span className="premade-member-role"><span>{t('groupYou')}</span><LobbyRoleIcon role={lobby.me?.role ?? premadeRole} fcIcon={fcIcon} /></span> : undefined}
      onChange={value => { setCharacter(value); setSaved(false); }} />
    {roleControl}
  </section>;
  return <>
    <div className={`play-lobby-header${premade ? ' has-premade' : ''}`}>
      <PlayLobbyCode lobby={lobby} />
      <div className="play-mode-toggle" role="group" aria-label={t('playQueueMode')}>
        <PlayModeButton mode="solo" selected={!premade} disabled={saving || queueBusy || queueActive || lobby.loading || lobby.busy} onSelect={() => chooseMode(false)} />
        <PlayModeButton mode="premade" selected={premade} disabled={saving || queueBusy || queueActive || lobby.loading || lobby.busy} onSelect={() => chooseMode(true)} />
      </div>
      <LobbyActions lobby={lobby} onJoined={onJoined} characterReady={!!character} />
    </div>
    <PlayLobbyStage premade={premade} lobby={lobby} ownRole={lobby.me?.role ?? premadeRole} onSlot={openSlot}>{content}</PlayLobbyStage>
    <SoloQueuePanel premade={premade} showSearch={false} />
    {context && <div className="play-selection-feedback">
    <MessageNotification message={error} attempt={attempt} />
    {premade && error === 'selectionSaveError' && <button type="button" disabled={!canSave} onClick={() => void saveSelection()}>{t('charactersRetry')}</button>}
    {error === 'selectionConflict' && <button type="button" onClick={() => setAttempt(value => value + 1)}>{t('selectionReload')}</button>}
    <MessageNotification message={contextStale && !error ? 'selectionConflict' : null} />
    {contextStale && !error && <button type="button" onClick={() => setAttempt(value => value + 1)}>{t('selectionReload')}</button>}
    </div>}
    {(!queueActive || queuedTicket) && <>
      <div className="play-match-action">
        <div className="play-match-control">
          <CompanionStatus accountId={accountId} matchAction onLinkedDeviceChange={setCompanionDeviceId} />
          {queuedTicket ? <button type="button" className="find-match is-queued" disabled>{t('playInQueue')}</button>
            : <span className="find-match-tooltip-trigger" data-tooltip-dismissed={matchTooltipDismissed} data-tooltip-open={matchTooltipOpen}
            tabIndex={hasMatchTooltip && !canFind ? 0 : undefined} aria-label={hasMatchTooltip && !canFind ? t('findMatch') : undefined}
            aria-describedby={hasMatchTooltip ? matchTooltipId : undefined}
            onPointerEnter={() => setMatchTooltipDismissed(false)} onFocusCapture={() => setMatchTooltipDismissed(false)}
            onPointerLeave={() => setMatchTooltipOpen(false)}
            onClick={() => { setMatchTooltipDismissed(false); setMatchTooltipOpen(true); }}
            onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setMatchTooltipOpen(false); }}
            onKeyDown={event => {
              if (event.key === 'Escape') { setMatchTooltipDismissed(true); setMatchTooltipOpen(false); }
              else if (!canFind && (event.key === 'Enter' || event.key === ' ')) {
                event.preventDefault(); setMatchTooltipDismissed(false); setMatchTooltipOpen(true);
              }
            }}>
            <button type="button" className={`find-match${premade ? ' is-premade' : ''}`} disabled={!canFind} onClick={() => void findMatch()}
              aria-describedby={hasMatchTooltip ? matchTooltipId : 'queue-availability'}>
              {t(saving || queueBusy ? 'selectionSaving' : 'findMatch')}
            </button>
            {hasMatchTooltip && <span id={matchTooltipId} className="captain-tooltip find-match-steps" role="tooltip">
              {matchMessages.map(message => <span key={message}>{t(message)}</span>)}
            </span>}
          </span>}
        </div>
        {queuedTicket && queue?.status && <div className="play-queue-search">
          <QueueElapsed key={queuedTicket.id} enteredAt={queuedTicket.enteredAt} serverTime={queue.status.serverTime} />
          {(!premade || queue.status.canControl)
            ? <button type="button" disabled={queue.busy} onClick={() => void queue.cancel()}>{t('soloQueueCancel')}</button>
            : <p>{t('playLeaderStartsMatch')}</p>}
        </div>}
        {!queuedTicket && !seasonMessage && !incompletePremade && <p id="queue-availability" className="availability" role={saved ? 'status' : undefined}>
          {t(!premade && lobby.group ? 'playLeaveForSolo' : premade && !lobby.captain ? 'playLeaderStartsMatch'
            : preseasonPreview ? 'preseasonQueueHelp' : saved ? 'selectionSavedQueuePending' : 'queuePending')}
        </p>}
        <MessageNotification message={premade ? lobby.error : null} />
        {premade && lobby.error && <button type="button" onClick={() => void lobby.reload(true)}>{t('groupRefresh')}</button>}
        {premade && lobby.error === 'groupMatchBlocked' && <Link to="/match-history">{t('navigationHistory')}</Link>}
      </div>
    </>}
    {dialogs}
  </>;
}

function QueueElapsed({ enteredAt, serverTime }: { enteredAt: string; serverTime: string }) {
  const elapsedAtSnapshot = Date.parse(serverTime) - Date.parse(enteredAt);
  const [seconds, setSeconds] = useState(() => Math.max(0, Math.floor(elapsedAtSnapshot / 1000)));

  useEffect(() => {
    const receivedAt = performance.now();
    const tick = () => setSeconds(previous => Math.max(previous,
      Math.floor((elapsedAtSnapshot + performance.now() - receivedAt) / 1000)));
    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [elapsedAtSnapshot]);

  return <time role="timer" dateTime={`PT${seconds}S`}>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</time>;
}
