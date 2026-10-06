import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlayerCard, PlayerCardSkeleton, type Character } from './PlayerCard';
import { useLocale } from './locales';
import type { MessageKey } from './locales/en';

type AccountProfile = { wow_accounts: { id: number; characters: Character[] }[] };
type Choice = { key: string; character: Character };

export function CharacterSelection({ accountId, editable = true }: { accountId: string; editable?: boolean }) {
  const { t } = useLocale();
  const [characters, setCharacters] = useState<Choice[]>([]);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<MessageKey | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const drag = useRef<{ x: number; scroll: number; moved: boolean } | null>(null);
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
        setSelected(editable ? choices[0]?.key ?? '' : '');
        try {
          const saved = localStorage.getItem(storageKey);
          setSelected(choices.some(choice => choice.key === saved) ? saved! : editable ? choices[0]?.key ?? '' : '');
          if (saved && !choices.some(choice => choice.key === saved)) localStorage.removeItem(storageKey);
        } catch { /* Selection remains available when storage is disabled. */ }
      })
      .catch(() => { if (!controller.signal.aborted) setError('charactersError'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [storageKey, attempt, editable]);

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
    {loading ? <PlayerCardSkeleton /> : error ? <>
      <p role="alert">{t(error)}</p>
      {error === 'charactersAuthorization'
        ? <a className="button" href="/oauth2/authorization/battle-net">{t('login')}</a>
        : <button type="button" onClick={() => setAttempt(value => value + 1)}>{t('charactersRetry')}</button>}
    </> : characters.length === 0 ? <p role="status">{t('charactersEmpty')}</p> : !editable ? current
      ? <div className="character-picker"><PlayerCard character={current} tilt /></div>
      : <Link className="button" to="/account">{t('charactersSelectProfile')}</Link> : <>
      <details className="character-picker" open={expanded} onToggle={event => setExpanded(event.currentTarget.open)}>
        <summary className="player-card-trigger" aria-label={`${current?.name ?? ''} · ${t('charactersChange')}`}>{current && <PlayerCard character={current} />}</summary>
      <fieldset className="character-options"
        onPointerDown={event => {
          if (event.pointerType !== 'mouse' || event.button !== 0) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          if (event.clientY >= bounds.top + event.currentTarget.clientTop + event.currentTarget.clientHeight) return;
          drag.current = { x: event.clientX, scroll: event.currentTarget.scrollLeft, moved: false };
        }}
        onPointerMove={event => {
          const state = drag.current;
          if (!state || event.buttons !== 1) return;
          const distance = event.clientX - state.x;
          if (Math.abs(distance) > 5) {
            state.moved = true;
            event.currentTarget.setPointerCapture(event.pointerId);
            event.currentTarget.scrollLeft = state.scroll - distance;
            event.currentTarget.classList.add('is-dragging');
          }
        }}
        onPointerUp={event => event.currentTarget.classList.remove('is-dragging')}
        onPointerCancel={event => { drag.current = null; event.currentTarget.classList.remove('is-dragging'); }}
        onClickCapture={event => {
          if (drag.current?.moved) { event.preventDefault(); event.stopPropagation(); }
          drag.current = null;
        }}><legend>{t('charactersLabel')}</legend>
        {characters.map(({ key, character }) => <label key={key} className={`character-option${key === selected ? ' is-selected' : ''}`}>
          <input type="radio" name="profile-character" value={key} checked={selected === key} onChange={() => select(key)} />
          <PlayerCard character={character} compact />
        </label>)}
      </fieldset>
      </details>
    </>}
  </section>;
}

