import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CharacterAvatar, CharacterIcons, PlayerCard, PlayerCardSkeleton, characterRegion, setPlayerCardTilt, resetPlayerCardTilt, type Character } from './PlayerCard';
import { BattleNetLoginButton } from './BattleNetLoginButton';
import { useLocale } from './locales';
import type { MessageKey } from './locales/en';

type AccountProfile = { wow_accounts: { id: number; characters: Character[] }[] };
type Reference = { namespace: string; wowAccountId: number; realmId: number; characterId: number };
type SavedCharacter = Reference & { region: 'EU' | 'NA'; name: string; realm: string; character?: Character | null };
type Choice = { key: string; character: Character; reference: Reference };
const sameReference = (a: Reference, b: Reference) => a.namespace === b.namespace && a.wowAccountId === b.wowAccountId && a.realmId === b.realmId && a.characterId === b.characterId;
class ChoiceError extends Error { constructor(public messageKey: MessageKey) { super(messageKey); } }
async function persistChoice(choice: Choice, signal: AbortSignal) {
  const token = document.cookie.split('; ').find(c => c.startsWith('XSRF-TOKEN='))?.slice(11);
  if (!token) throw new ChoiceError('playCharacterSaveError');
  const response = await fetch('/api/v1/me/play-character', { method: 'PUT', credentials: 'same-origin', cache: 'no-store', signal,
    headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': decodeURIComponent(token) }, body: JSON.stringify(choice.reference) });
  if (!response.ok) throw new ChoiceError(response.status === 409 ? 'playCharacterRegionMismatch' : response.status === 401 || response.status === 403 ? 'charactersAuthorization' : 'playCharacterSaveError');
  const saved = await response.json() as SavedCharacter;
  if (!saved || !sameReference(saved, choice.reference) || saved.region !== characterRegion(choice.character)) throw new ChoiceError('playCharacterSaveError');
}


export function CharacterSelection({ accountId, onChange, preferred, disabled = false, small = false, smallFooter }: {
  accountId: string; onChange?: (character: Character | null) => void;
  preferred?: { name: string; realm: string }; disabled?: boolean; small?: boolean; smallFooter?: ReactNode;
}) {
  const { t } = useLocale();
  const [characters, setCharacters] = useState<Choice[]>([]);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<MessageKey | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [choiceError, setChoiceError] = useState<MessageKey | null>(null);
  const [choosing, setChoosing] = useState(false);
  const choosingRef = useRef(false);
  const writeController = useRef<AbortController | null>(null);
  const persistedKey = useRef('');
  const dialog = useRef<HTMLDialogElement>(null);
  const changeListener = useRef(onChange);
  changeListener.current = onChange;
  const preferredChoice = useRef(preferred);
  preferredChoice.current = preferred;
  // Retain the legacy key so existing EU choices survive; other namespaces have distinct choice keys.
  const storageKey = `rbgs.character.classic1x.eu.${accountId}`;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(null); setCharacters([]); setSelected('');
    changeListener.current?.(null);
    persistedKey.current = ''; setChoiceError(null);
    Promise.all([
      fetch('/api/v1/characters/me', { credentials: 'same-origin', signal: controller.signal }),
      fetch('/api/v1/me/play-character', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal }),
    ]).then(async ([response, preference]) => {
        if (!response.ok || !preference.ok) {
          const status = !response.ok ? response.status : preference.status;
          throw new ChoiceError(status === 401 || status === 403 ? 'charactersAuthorization' : status === 404 ? 'charactersUnavailable' : 'charactersError');
        }
        const data = await response.json() as AccountProfile;
        const text = await preference.text();
        const saved = text ? JSON.parse(text) as SavedCharacter | null : null;
        const choices = data.wow_accounts.flatMap(account => account.characters.filter(character => character.level >= 60).map(character => ({
          key: character.namespace && character.namespace !== 'profile-classic1x-eu'
            ? `${character.namespace}:${account.id}:${character.realm.id}:${character.id}`
            : `${account.id}:${character.realm.id}:${character.id}`, character,
          reference: { namespace: character.namespace ?? 'profile-classic1x-eu', wowAccountId: account.id, realmId: character.realm.id, characterId: character.id },
        }))).sort((a, b) => a.character.name.localeCompare(b.character.name));
        if (controller.signal.aborted) return;
        setCharacters(choices);
        const matching = choices.filter(choice => choice.character.name === preferredChoice.current?.name
          && (choice.character.realm.name || choice.character.realm.slug) === preferredChoice.current?.realm);
        let chosen = saved ? choices.find(choice => sameReference(choice.reference, saved)) : undefined;
        chosen ??= matching.length === 1 ? matching[0] : undefined;
        try {
          const local = localStorage.getItem(storageKey);
          chosen ??= matching.find(choice => choice.key === local) ?? matching[0] ?? choices.find(choice => choice.key === local);
          if (local && !choices.some(choice => choice.key === local)) localStorage.removeItem(storageKey);
        } catch { /* Selection remains available when storage is disabled. */ }
        chosen ??= matching[0] ?? choices[0];
        if (!chosen) return;
        setSelected(chosen.key);
        try {
          // The catalog is already loaded; refresh only this selected profile, with no extra provider fan-out.
          await persistChoice(chosen, controller.signal);
          if (controller.signal.aborted) return;
          persistedKey.current = chosen.key;
          changeListener.current?.(chosen.character);
        } catch (reason) {
          if (!controller.signal.aborted) setChoiceError(reason instanceof ChoiceError ? reason.messageKey : 'playCharacterSaveError');
        }
      })
      .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof ChoiceError ? reason.messageKey : 'charactersError'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); writeController.current?.abort(); };
  }, [storageKey, attempt]);

  async function select(key: string) {
    if (choosingRef.current) return;
    const choice = characters.find(item => item.key === key);
    if (!choice) return;
    choosingRef.current = true; setChoosing(true); setChoiceError(null);
    const controller = new AbortController(); writeController.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    try {
      if (persistedKey.current !== key) await persistChoice(choice, controller.signal);
      if (controller.signal.aborted) return;
      persistedKey.current = key; setSelected(key);
      changeListener.current?.(choice.character);
      dialog.current?.close();
      try { localStorage.setItem(storageKey, key); } catch { /* Keep the accepted choice in memory. */ }
    } catch (reason) {
      if (writeController.current === controller) setChoiceError(reason instanceof ChoiceError ? reason.messageKey : 'playCharacterSaveError');
    } finally {
      window.clearTimeout(timeout); choosingRef.current = false;
      if (writeController.current === controller) { setChoosing(false); writeController.current = null; }
    }
  }

  const current = characters.find(choice => choice.key === selected)?.character;
  const choicesList = (
        <ul className="character-selection-list" aria-label={t('charactersLabel')}>
          {characters.map(({ key, character }) => <li key={key}>
            <button type="button" className={`character-selection-row${key === selected ? ' is-selected' : ''}`}
              disabled={disabled || choosing} aria-pressed={key === selected} onClick={() => void select(key)}>
              <CharacterAvatar character={character} />
              <span className="character-row-details">
                <span className="character-row-name"><strong>{character.name}</strong>
                  {character.guild?.name && <span className="character-row-guild" title={character.guild.name}>{`< ${character.guild.name} >`}</span>}
                </span>
                <span>{characterRegion(character)} · {character.realm.name || character.realm.slug} · {t('charactersLevel')} {character.level}</span>
              </span>
              <CharacterIcons character={character} />
              <span className="character-row-check" aria-hidden="true">{key === selected ? '✓' : ''}</span>
            </button>
          </li>)}
        </ul>
  );
  return <section className="character-selection" aria-label={t('charactersHeading')}>
    {choiceError && !dialog.current?.open && <p role="alert">{t(choiceError)}</p>}
    {loading ? <PlayerCardSkeleton /> : error ? <>
      <p role="alert">{t(error)}</p>
      {error === 'charactersAuthorization'
        ? <BattleNetLoginButton />
        : <button type="button" onClick={() => setAttempt(value => value + 1)}>{t('charactersRetry')}</button>}
    </> : characters.length === 0 ? <p role="status">{t('charactersEmpty')}</p> : <>
      <div className="character-picker">
        <button type="button" className={`player-card-trigger${small ? ' has-small-card' : ''}`} disabled={disabled || choosing} aria-haspopup="dialog"
          aria-label={`${current?.name ?? ''} · ${t('charactersChange')}`} onClick={() => dialog.current?.showModal()}
          onPointerMove={event => { const card = event.currentTarget.querySelector<HTMLElement>('.premade-card-preview .player-card'); if (card) setPlayerCardTilt(card, event, card.parentElement); }}
          onPointerLeave={event => { const card = event.currentTarget.querySelector<HTMLElement>('.premade-card-preview .player-card'); if (card) resetPlayerCardTilt(card); }}>

          {current && <PlayerCard character={current} tilt={!small} size={small ? 'small' : 'normal'} footer={small ? smallFooter ?? t('groupYou') : undefined} />}
          {current && small && <span className="premade-card-preview own-card-preview" aria-hidden="true"><PlayerCard character={current} tilt footer={smallFooter} /></span>}
        </button>
      </div>
      <dialog ref={dialog} className="character-selection-dialog" aria-labelledby="character-selection-title"
        aria-describedby="character-selection-description" onClick={event => {
          if (event.target !== event.currentTarget) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.current?.close();
        }}>
        <header className="character-selection-heading">
          <div><h2 id="character-selection-title">{t('charactersChange')}</h2>
            <p id="character-selection-description">{t('charactersIntro')}</p></div>
          <button type="button" className="character-selection-close" aria-label={t('charactersClose')} onClick={() => dialog.current?.close()} autoFocus>×</button>
        </header>
        {choiceError && <p role="alert">{t(choiceError)}</p>}
        {choicesList}
        <p className="character-selection-note">{t('charactersBetaNotice')}</p>
      </dialog>
    </>}
  </section>;
}

