import { useEffect, useState } from 'react';
import { useLocale } from './locales';
import type { MessageKey } from './locales/en';

type Character = {
  id: number; name: string; level: number;
  realm: { id: number; name: string; slug: string };
  playable_class?: { id?: number; name: string }; playable_race?: { name: string }; faction?: { name: string };
  avatarUrl?: string | null;
  insetUrl?: string | null;
};
type AccountProfile = { wow_accounts: { id: number; characters: Character[] }[] };
type Choice = { key: string; character: Character };

export function CharacterSelection({ accountId }: { accountId: string }) {
  const { t } = useLocale();
  const [characters, setCharacters] = useState<Choice[]>([]);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<MessageKey | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [expanded, setExpanded] = useState(false);
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
        const choices = data.wow_accounts.flatMap(account => account.characters.filter(character => character.level === 60).map(character => ({
          key: `${account.id}:${character.realm.id}:${character.id}`, character,
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
    setExpanded(false);
    try {
      if (key) localStorage.setItem(storageKey, key);
      else localStorage.removeItem(storageKey);
    } catch { /* Keep the current selection in memory. */ }
  }

  const current = characters.find(choice => choice.key === selected)?.character;
  return <section className="character-selection" aria-label={t('charactersHeading')}>
    {loading ? <p role="status">{t('charactersLoading')}</p> : error ? <>
      <p role="alert">{t(error)}</p>
      {error === 'charactersAuthorization'
        ? <a className="button" href="/oauth2/authorization/battle-net">{t('login')}</a>
        : <button type="button" onClick={() => setAttempt(value => value + 1)}>{t('charactersRetry')}</button>}
    </> : characters.length === 0 ? <p role="status">{t('charactersEmpty')}</p> : <>
      <details className="character-picker" open={expanded} onToggle={event => setExpanded(event.currentTarget.open)}>
        <summary className="profile-card" aria-label={`${current?.name ?? ''} · ${t('charactersChange')}`}>
          {current && <><span className="profile-card-header">
            <strong className="profile-card-name">{current.name}</strong>
            <CharacterIcons character={current} />
            </span>
            <CharacterAvatar character={current} />
            <span className="profile-card-realm">{current.realm.name || current.realm.slug} · EU</span>
            <span className="profile-card-ratings">
              <span className="profile-card-rating"><strong>1500</strong><span>{t('soloHeading')}</span></span>
              <span className="profile-card-rating"><strong>1500</strong><span>{t('premadeHeading')}</span></span>
            </span>
          </>}
        </summary>
      <p className="character-note">{t('charactersBetaNotice')}</p>
      <fieldset className="character-options"><legend>{t('charactersLabel')}</legend>
        {characters.map(({ key, character }) => <label key={key} className={`character-option${key === selected ? ' is-selected' : ''}`}>
          <input type="radio" name="profile-character" value={key} checked={selected === key} onChange={() => select(key)} />
          <CharacterAvatar character={character} />
          <span className="character-option-details"><strong>{character.name}</strong>
            <span>{character.realm.name || character.realm.slug}</span>
            <span>{[character.playable_race?.name, character.playable_class?.name].filter(Boolean).join(' ')} · {t('charactersLevel')} 60</span>
          </span>
        </label>)}
      </fieldset>
      </details>
    </>}
  </section>;
}

const classAvatars: Record<number, [string, string]> = {
  1: ['warrior', '#c79c6e'], 2: ['paladin', '#f58cba'], 3: ['hunter', '#abd473'],
  4: ['rogue', '#fff569'], 5: ['priest', '#ffffff'], 7: ['shaman', '#0070de'],
  8: ['mage', '#69ccf0'], 9: ['warlock', '#9482c9'], 11: ['druid', '#ff7d0a'],
};

const raceIcons: Record<string, string> = {
  Human: 'human', Orc: 'orc', Dwarf: 'dwarf', 'Night Elf': 'nightelf', Undead: 'scourge',
  Tauren: 'tauren', Gnome: 'gnome', Troll: 'troll',
};

function CharacterIcons({ character }: { character: Character }) {
  const className = classAvatars[character.playable_class?.id ?? 0]?.[0];
  const race = character.playable_race?.name;
  const raceIcon = race ? raceIcons[race] : undefined;
  return <span className="profile-card-icons">
    {className && <img src={`/media/character/class_${className}.jpg`} width="18" height="18" alt={character.playable_class?.name} title={character.playable_class?.name} />}
    {raceIcon && <img src={`/media/character/race_${raceIcon}_male.jpg`} width="18" height="18" alt={race} title={race} />}
  </span>;
}

function CharacterAvatar({ character }: { character: Character }) {
  const [failedUrls, setFailedUrls] = useState<string[]>([]);
  const [className, color] = classAvatars[character.playable_class?.id ?? 0] ?? ['', '#b6b7bb'];
  const classIcon = className ? `/media/character/class_${className}.jpg` : null;
  const source = [character.avatarUrl, classIcon]
    .find((url): url is string => !!url && !failedUrls.includes(url));
  return <span className={`character-avatar${source === classIcon ? ' is-class-icon' : ''}`} style={{ color }} aria-hidden="true">
    {source
      ? <img src={source} width="48" height="48" alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer"
          onError={() => setFailedUrls(urls => [...urls, source])} />
      : <span>✦</span>}
  </span>;
}
