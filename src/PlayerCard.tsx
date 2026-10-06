import { useState } from 'react';
import { useLocale } from './locales';

export type Character = {
  id: number; name: string; level: number;
  namespace?: 'profile-classic1x-eu' | 'profile-classic-eu';
  realm: { id: number; name: string; slug: string };
  playable_class?: { id?: number; name: string }; playable_race?: { name: string }; faction?: { name: string };
  avatarUrl?: string | null;
  insetUrl?: string | null;
};
export function PlayerCardSkeleton() {
  const { t } = useLocale();
  return <div className="character-picker" role="status" aria-label={t('charactersLoading')}>
    <div className="profile-card player-card player-card-skeleton" aria-hidden="true">
      <span className="profile-card-header"><span className="skeleton-block skeleton-name" /><span className="skeleton-block skeleton-icons" /></span>
      <span className="character-avatar skeleton-block" />
      <span className="skeleton-block skeleton-realm" />
      <span className="profile-card-stats">{[0, 1, 2].map(column => <span key={column}><span className="skeleton-block skeleton-stat-label" /><span className="skeleton-block skeleton-stat-value" /></span>)}</span>
      <span className="profile-card-ratings">{[0, 1].map(column => <span className="profile-card-rating" key={column}><span className="skeleton-block skeleton-rating" /></span>)}</span>
    </div>
  </div>;
}

export function PlayerCard({ character, compact = false, tilt = false }: { character: Character; compact?: boolean; tilt?: boolean }) {
  const ratings = <span className="profile-card-ratings">
    <CharacterRating />
    <CharacterRating premade />
  </span>;
  return <>
    <div className={`profile-card player-card${compact ? ' player-card-compact' : ''}${tilt ? ' lobby-card' : ''}`} onPointerMove={event => {
      if (!tilt || event.pointerType !== 'mouse' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const card = event.currentTarget;
      const bounds = card.parentElement!.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
      const y = Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height));
      card.style.setProperty('--card-rotate-x', `${(0.5 - y) * 16}deg`);
      card.style.setProperty('--card-rotate-y', `${(x - 0.5) * 16}deg`);
    }} onPointerLeave={event => {
      const card = event.currentTarget;
      card.style.setProperty('--card-rotate-x', '0deg');
      card.style.setProperty('--card-rotate-y', '0deg');
    }}>
      <span className="profile-card-header"><strong className="profile-card-name">{character.name}</strong><CharacterIcons character={character} /></span>
      <CharacterAvatar character={character} />
      <span className="profile-card-realm">{character.realm.name || character.realm.slug} · EU</span>
      <CharacterStats />
      {ratings}
    </div>
  </>;
}

function CharacterRating({ premade = false }: { premade?: boolean }) {
  const { t } = useLocale();
  const label = t(premade ? 'premadeHeading' : 'soloHeading');
  return <span className="profile-card-rating" title={label} aria-label={`${label}: 1500`}>
    <strong>1500</strong>
    <svg width="18" height="18" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {premade && <><circle cx="6" cy="12" r="3.5" /><circle cx="26" cy="12" r="3.5" />
        <path d="M9 19a6 6 0 0 0-8 6v2h7M23 19a6 6 0 0 1 8 6v2h-7" /></>}
      <circle cx="16" cy="9" r="5" />
      <path d="M7 28v-3a9 9 0 0 1 18 0v3Z" />
    </svg>
  </span>;
}

function CharacterStats() {
  const { t } = useLocale();
  return <span className="profile-card-stats">
    <span><span>{t('charactersGamesPlayed')}</span><strong>0</strong></span>
    <span><span>{t('charactersWinrate')}</span><strong>—</strong></span>
    <span><span>{t('charactersLastMatches')}</span><strong>—</strong></span>
  </span>;
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
