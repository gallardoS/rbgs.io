import { useEffect, useId, useState } from 'react';
import { useAvatarPreference, type AvatarStyle } from './avatar-preference';
import { CharacterAvatar, type Character } from './PlayerCard';
import { useLocale } from './locales';

export function AvatarStyleSelect({ accountId }: { accountId: string }) {
  const { t } = useLocale();
  const { style, setStyle } = useAvatarPreference();
  const id = useId();
  const [character, setCharacter] = useState<Character | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const options = { credentials: 'same-origin' as const, cache: 'no-store' as const, signal: controller.signal };
    setLoading(true); setError(false); setCharacter(null);
    async function load() {
      const savedResponse = await fetch('/api/v1/me/play-character', options);
      if (!savedResponse.ok) throw new Error('Character unavailable');
      const text = await savedResponse.text();
      const saved = text ? JSON.parse(text)?.character as Character | undefined : undefined;
      if (saved?.avatarSdUrl && saved.avatarHdUrl) return saved;
      const response = await fetch('/api/v1/characters/me', options);
      if (!response.ok) throw new Error('Characters unavailable');
      const data = await response.json() as { wow_accounts: { characters: Character[] }[] };
      const characters = data.wow_accounts.flatMap(account => account.characters);
      const current = characters.find(c => c.id === saved?.id && c.namespace === saved.namespace && c.realm.id === saved.realm.id);
      return current ?? characters.find(c => c.avatarSdUrl && c.avatarHdUrl) ?? saved ?? null;
    }
    load().then(value => { if (!controller.signal.aborted) setCharacter(value); })
      .catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [accountId, attempt]);

  return <section className="profile-settings-section" aria-labelledby={`${id}-title`}>
    <div className="profile-section-heading">
      <h2 id={`${id}-title`}>{t('settingsAvatar')}</h2>
      <p>{t('settingsAvatarDescription')}</p>
    </div>
    <div>
      <fieldset className="fc-icon-options avatar-style-options">
        <legend className="fc-icon-legend">{t('settingsAvatar')}</legend>
        {(['sd', 'hd'] as AvatarStyle[]).map(option => <label className="fc-icon-option avatar-style-option" key={option}>
          <input type="radio" name={id} value={option} checked={style === option} onChange={() => setStyle(option)} />
          {character && <CharacterAvatar character={character} style={option} />}
          <span>{option.toUpperCase()}</span>
        </label>)}
      </fieldset>
      {loading && <p role="status">{t('charactersLoading')}</p>}
      {error && <p role="status">{t('charactersError')} <button type="button" onClick={() => setAttempt(value => value + 1)}>{t('charactersRetry')}</button></p>}
      {!loading && !error && (!character?.avatarSdUrl || !character.avatarHdUrl) && <p>{t('settingsAvatarPreviewUnavailable')}</p>}
    </div>
  </section>;
}
