import { useEffect, useRef, useState } from 'react';
import { RoleSelection, type MatchRole as Role } from './RoleSelection';
import { CaptainConsent } from './CaptainConsent';
import { useFcIconPreference } from './fc-icon-preference';
import { CharacterSelection } from './CharacterSelection';
import { PlayerCardSkeleton, type Character } from './PlayerCard';
import { useLocale } from './locales';
import type { MessageKey } from './locales/en';
import './SeasonSelection.css';

type Selection = {
  characterId: string; name: string; realm: string; source: 'DECLARED' | 'BLIZZARD_VERIFIED';
  ratingSubjectType: 'ACCOUNT' | 'CHARACTER'; ratingSubjectId: string; role: Role;
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
    && ['FC', 'HEALER', 'DPS'].includes(data.role) && typeof data.captainConsent === 'boolean'
    && ['DECLARED', 'BLIZZARD_VERIFIED'].includes(data.source)
    && ['ACCOUNT', 'CHARACTER'].includes(data.ratingSubjectType)
    && typeof data.ratingSubjectId === 'string' && typeof data.validForSeason === 'boolean';
}

export function SeasonSelection({ accountId }: { accountId: string }) {
  const { t } = useLocale();
  const { icon: fcIcon } = useFcIconPreference(accountId);
  const [context, setContext] = useState<Context | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<MessageKey | null>(null);
  const [saved, setSaved] = useState(false);
  const [character, setCharacter] = useState<Character | null>(null);
  const [role, setRole] = useState<Role | ''>('');
  const [captainConsent, setCaptainConsent] = useState(false);
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
        setRole(data.selection?.role ?? '');
        setCaptainConsent(data.selection?.captainConsent ?? false);
      })
      .catch(() => { if (!disposed) { setContext(null); setError('selectionLoadError'); } })
      .finally(() => { window.clearTimeout(timeout); if (!disposed) setLoading(false); });
    return () => { disposed = true; controller.abort(); window.clearTimeout(timeout); };
  }, [accountId, attempt]);

  const canSave = !loading && !saving && context?.season?.ratingSubjectType === 'ACCOUNT'
    && !!character && !!role && error !== 'selectionConflict';
  async function findMatch() {
    if (!canSave || !context?.season || !character || !role || saveController.current) return;
    const controller = new AbortController();
    saveController.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    setSaving(true); setError(null); setSaved(false);
    try {
      const cookie = document.cookie.split('; ').find(value => value.startsWith('XSRF-TOKEN='))?.slice('XSRF-TOKEN='.length);
      if (!cookie) throw new Error('Missing CSRF');
      const response = await fetch('/api/v1/me/selection', {
        method: 'PUT', credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': decodeURIComponent(cookie) },
        body: JSON.stringify({
          seasonId: context.season.id, seasonVersion: context.season.version,
          expectedVersion: context.selection?.version ?? null,
          declaration: { name: character.name, realm: character.realm.name || character.realm.slug },
          role, captainConsent,
        }),
      });
      if (controller.signal.aborted) return;
      if (!response.ok) {
        setError(response.status === 409 ? 'selectionConflict' : 'selectionSaveError');
        return;
      }
      const selection: unknown = await response.json();
      if (controller.signal.aborted) return;
      if (!validSelection(selection)) throw new Error('Invalid saved selection');
      setContext({ ...context, selection });
      setCaptainConsent(selection.captainConsent);
      setSaved(true);
      // Queue admission must follow confirmed persistence when its feature is implemented.
    } catch {
      if (saveController.current === controller) setError('selectionSaveError');
    } finally {
      window.clearTimeout(timeout);
      if (saveController.current === controller) { saveController.current = null; setSaving(false); }
    }
  }

  let content;
  if (loading) content = <PlayerCardSkeleton />;
  else if (!context) content = <>
    <p role="alert">{t(error ?? 'selectionLoadError')}</p>
    <button type="button" onClick={() => setAttempt(value => value + 1)}>{t('charactersRetry')}</button>
  </>;
  else if (context.season?.ratingSubjectType === 'CHARACTER') content = <>
    <h2>{context.season.name}</h2>
    {context.selection && <p>{context.selection.name} {"\u00b7"} {context.selection.realm}</p>}
    <p role="status">{t('selectionVerificationPending')}</p>
  </>;
  else content = <section className="season-selection" aria-label={t('selectionHeading')}>
    <CaptainConsent selected={captainConsent} disabled={saving || !character}
      onChange={value => { setCaptainConsent(value); setSaved(false); }} />
    <CharacterSelection accountId={accountId} preferred={context.selection ?? undefined} disabled={saving}
      onChange={value => { setCharacter(value); setSaved(false); }} />
    <RoleSelection fcIcon={fcIcon} value={role} disabled={saving || !character}
      onChange={value => { setRole(value); setSaved(false); }} />
    {error && <p role="alert">{t(error)}</p>}
    {error === 'selectionConflict' && <button type="button" onClick={() => setAttempt(value => value + 1)}>{t('selectionReload')}</button>}
  </section>;
  return <>
    <div className="play-character-stage">{content}</div>
    <div className="play-match-action">
      <button type="button" className="find-match" disabled={!canSave} onClick={() => void findMatch()} aria-describedby="queue-availability">
        {t(saving ? 'selectionSaving' : 'findMatch')}
      </button>
      <p id="queue-availability" className="availability" role={saved ? 'status' : undefined}>
        {t(saved ? 'selectionSavedQueuePending' : 'queuePending')}
      </p>
    </div>
  </>;
}
