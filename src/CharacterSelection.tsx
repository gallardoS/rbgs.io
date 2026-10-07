import { useEffect, useRef, useState } from 'react';
import { CharacterAvatar, CharacterIcons, PlayerCard, PlayerCardSkeleton, type Character } from './PlayerCard';
import { useLocale } from './locales';
import type { MessageKey } from './locales/en';

type AccountProfile = { wow_accounts: { id: number; characters: Character[] }[] };
type Choice = { key: string; character: Character };

export function CharacterSelection({ accountId }: { accountId: string }) {
  const { t } = useLocale();
  const [characters, setCharacters] = useState<Choice[]>([]);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<MessageKey | null>(null);
  const [attempt, setAttempt] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const storageKey = `rbgs.character.classic1x.eu.${accountId}`;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(null); setCharacters([]); setSelected('');
    fetch('/api/v1/characters/me', { credentials: 'same-origin', signal: controller.signal })
      .then(async response => {
        if (!response.ok) {
          const message: MessageKey = response.status === 401 || response.status === 403
            ? 'charactersAuthorization' : response.status === 404 ? 'charactersUnavailable' : 'charactersError';
          if (!controller.signal.aborted) setError(message);
          return;
        }
        const data = await response.json() as AccountProfile;
        const choices = data.wow_accounts.flatMap(account => account.characters.filter(character => character.level >= 60).map(character => ({
          key: character.namespace === 'profile-classic-eu'
            ? `${character.namespace}:${account.id}:${character.realm.id}:${character.id}`
            : `${account.id}:${character.realm.id}:${character.id}`, character,
        }))).sort((a, b) => a.character.name.localeCompare(b.character.name));
        if (controller.signal.aborted) return;
        setCharacters(choices);
        setSelected(choices[0]?.key ?? '');
        try {
          const saved = localStorage.getItem(storageKey);
          setSelected(choices.some(choice => choice.key === saved) ? saved! : choices[0]?.key ?? '');
          if (saved && !choices.some(choice => choice.key === saved)) localStorage.removeItem(storageKey);
        } catch { /* Selection remains available when storage is disabled. */ }
      })
      .catch(() => { if (!controller.signal.aborted) setError('charactersError'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [storageKey, attempt]);

  function select(key: string) {
    setSelected(key);
    dialog.current?.close();
    try {
      if (key) localStorage.setItem(storageKey, key);
      else localStorage.removeItem(storageKey);
    } catch { /* Keep the current selection in memory. */ }
  }

  const current = characters.find(choice => choice.key === selected)?.character;
  return <section className="character-selection" aria-label={t('charactersHeading')}>
    {loading ? <PlayerCardSkeleton /> : error ? <>
      <p role="alert">{t(error)}</p>
      {error === 'charactersAuthorization'
        ? <a className="button" href="/oauth2/authorization/battle-net">{t('login')}</a>
        : <button type="button" onClick={() => setAttempt(value => value + 1)}>{t('charactersRetry')}</button>}
    </> : characters.length === 0 ? <p role="status">{t('charactersEmpty')}</p> : <>
      <div className="character-picker">
        <button type="button" className="player-card-trigger" aria-haspopup="dialog"
          aria-label={`${current?.name ?? ''} · ${t('charactersChange')}`} onClick={() => dialog.current?.showModal()}>
          {current && <PlayerCard character={current} tilt />}
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
        <ul className="character-selection-list" aria-label={t('charactersLabel')}>
          {characters.map(({ key, character }) => <li key={key}>
            <button type="button" className={`character-selection-row${key === selected ? ' is-selected' : ''}`}
              aria-pressed={key === selected} onClick={() => select(key)}>
              <CharacterAvatar character={character} />
              <span className="character-row-details">
                <span className="character-row-name"><strong>{character.name}</strong>
                  {character.guild?.name && <span className="character-row-guild" title={character.guild.name}>{`< ${character.guild.name} >`}</span>}
                </span>
                <span>EU · {character.realm.name || character.realm.slug} · {t('charactersLevel')} {character.level}</span>
              </span>
              <CharacterIcons character={character} />
              <span className="character-row-check" aria-hidden="true">{key === selected ? '✓' : ''}</span>
            </button>
          </li>)}
        </ul>
        <p className="character-selection-note">{t('charactersBetaNotice')}</p>
      </dialog>
    </>}
  </section>;
}

