import { useState, type ReactNode } from 'react';
import { useLocale } from './locales';
import { languageLocales } from './locale-routing';
import { useAvatarPreference, type AvatarStyle } from './avatar-preference';
import { ratingTier } from './rating-tier';

export type Character = {
  id: number; name: string; level: number;
  namespace?: 'profile-classic1x-eu' | 'profile-classic-eu' | 'profile-classic1x-us' | 'profile-classic-us' | 'profile-classicann-eu' | 'profile-classicann-us' | 'profile-forever-eu' | 'profile-forever-us';
  realm: { id: number; name: string; slug: string };
  playable_class?: { id?: number; name: string }; playable_race?: { name: string }; faction?: { name: string };
  avatarUrl?: string | null;
  avatarSdUrl?: string | null;
  avatarHdUrl?: string | null;
  insetUrl?: string | null;
  guild?: { name: string | null } | null;
  gender?: { type: string | null; name?: string | null } | null;
};
export function characterRegion(character: Pick<Character, 'namespace'>): 'EU' | 'NA' {
  return character.namespace?.endsWith('-us') ? 'NA' : 'EU';
}
export function isPickerCharacter(character: Pick<Character, 'namespace' | 'level'>): boolean {
  return /^profile-forever-(eu|us)$/.test(character.namespace ?? '') && character.level >= 1;
}
export function PlayerCardSkeleton({ small = false }: { small?: boolean }) {
  const { t } = useLocale();
  return <div className="character-picker" role="status" aria-label={t('charactersLoading')}>
    <div className={`profile-card player-card player-card-skeleton${small ? ' player-card-small' : ''}`} aria-hidden="true">
      <span className="profile-card-header"><span className="skeleton-block skeleton-realm" /><span className="skeleton-block skeleton-icons" /></span>
      <span className="character-avatar skeleton-block" />
      <span className="skeleton-block skeleton-name" />
      <span className="profile-card-guild skeleton-block skeleton-guild" />
      <span className="profile-card-stats">{[0, 1, 2].map(column => <span key={column}><span className="skeleton-block skeleton-stat-label" /><span className="skeleton-block skeleton-stat-value" /></span>)}</span>
      <span className="profile-card-ratings">{[0, 1].map(column => <span className="profile-card-rating" key={column}><span className="skeleton-block skeleton-rating" /></span>)}</span>
    </div>
  </div>;
}

export function setPlayerCardTilt(card: HTMLElement, pointer: { pointerType: string; clientX: number; clientY: number }, anchor = card.parentElement) {
  if (pointer.pointerType !== 'mouse' || !anchor || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const bounds = anchor.getBoundingClientRect();
  const x = Math.max(0, Math.min(1, (pointer.clientX - bounds.left) / bounds.width));
  const y = Math.max(0, Math.min(1, (pointer.clientY - bounds.top) / bounds.height));
  card.style.setProperty('--card-rotate-x', `${(0.5 - y) * 16}deg`);
  card.style.setProperty('--card-rotate-y', `${(x - 0.5) * 16}deg`);
}
export function resetPlayerCardTilt(card: HTMLElement) {
  card.style.setProperty('--card-rotate-x', '0deg'); card.style.setProperty('--card-rotate-y', '0deg');
}

type CardCharacter = Pick<Character, 'name' | 'namespace' | 'playable_class' | 'playable_race' | 'gender'
  | 'avatarUrl' | 'avatarSdUrl' | 'avatarHdUrl' | 'guild'> & { level?: number };
type CompetitiveSummary = { solo?: number; premade?: number; games?: number; winRate?: number };

export function PlayerCard({ character, compact = false, tilt = false, size = 'normal', showLevel = true,
  locationLabel, competitive, avatarFallback, footer, headerIcon, avatarBadge, ownerAvatar = false }: {
  character: CardCharacter; compact?: boolean; tilt?: boolean; size?: 'normal' | 'small';
  locationLabel?: string; competitive?: CompetitiveSummary;
  ownerAvatar?: boolean; showLevel?: boolean; avatarFallback?: ReactNode; footer?: ReactNode; headerIcon?: ReactNode; avatarBadge?: ReactNode;
}) {
  return <div className={`profile-card player-card${compact ? ' player-card-compact' : ''}${tilt ? ' lobby-card' : ''}${size === 'small' ? ' player-card-small' : ''}`}
    onPointerMove={event => { if (tilt) setPlayerCardTilt(event.currentTarget, event); }} onPointerLeave={event => resetPlayerCardTilt(event.currentTarget)}>
    <span className="profile-card-header"><span className="profile-card-realm">{locationLabel ??
      (showLevel && character.level != null ? `${characterRegion(character)} · ${character.level}` : characterRegion(character))}</span><CharacterIcons character={character} leadingIcon={headerIcon} /></span>
    {avatarBadge ? <span className="player-card-avatar-with-badge"><span className="player-card-avatar-badge">{avatarBadge}</span><CharacterAvatar character={character} fallback={avatarFallback} ownerAvatar={ownerAvatar} /></span> : <CharacterAvatar character={character} fallback={avatarFallback} ownerAvatar={ownerAvatar} />}
    <strong className="profile-card-name">{character.name}</strong>
    {character.guild?.name && <span className="profile-card-guild">{`< ${character.guild.name} >`}</span>}
    <CharacterStats competitive={competitive} />
    <span className="profile-card-ratings"><CharacterRating rating={competitive?.solo} /><CharacterRating premade rating={competitive?.premade} /></span>
    {footer && <span className="player-card-footer">{footer}</span>}
  </div>;
}

function CharacterRating({ premade = false, rating }: { premade?: boolean; rating?: number }) {
  const { t, language } = useLocale();
  const label = t(premade ? 'premadeHeading' : 'soloHeading');
  const value = rating?.toLocaleString(languageLocales[language]) ?? '—';
  return <span className="profile-card-rating" title={label} aria-label={`${label}: ${value}`}>
    <strong data-rating-tier={ratingTier(rating)}>{value}</strong>
    <svg width="18" height="18" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {premade && <><circle cx="6" cy="12" r="3.5" /><circle cx="26" cy="12" r="3.5" />
        <path d="M9 19a6 6 0 0 0-8 6v2h7M23 19a6 6 0 0 1 8 6v2h-7" /></>}
      <circle cx="16" cy="9" r="5" />
      <path d="M7 28v-3a9 9 0 0 1 18 0v3Z" />
    </svg>
  </span>;
}

function CharacterStats({ competitive }: { competitive?: CompetitiveSummary }) {
  const { t, language } = useLocale();
  return <span className="profile-card-stats">
    <span><span>{t('charactersGamesPlayed')}</span><strong>{competitive?.games?.toLocaleString(languageLocales[language]) ?? '—'}</strong></span>
    <span><span>{t('charactersWinrate')}</span><strong>{competitive?.winRate == null ? '—' : `${competitive.winRate}%`}</strong></span>
    <span><span>{t('charactersLastMatches')}</span><strong>—</strong></span>
  </span>;
}

const classAvatars: Record<number, [string, string]> = {
  1: ['warrior', '#c79c6e'], 2: ['paladin', '#f58cba'], 3: ['hunter', '#abd473'],
  4: ['rogue', '#fff569'], 5: ['priest', '#ffffff'], 7: ['shaman', '#0070de'],
  8: ['mage', '#69ccf0'], 9: ['warlock', '#9482c9'], 11: ['druid', '#ff7d0a'],
};

export function playableClassFromToken(token?: string | null): Character['playable_class'] {
  const className = token?.trim().toLowerCase();
  const entry = Object.entries(classAvatars).find(([, [name]]) => name === className);
  if (!entry) return undefined;
  const [id, [name]] = entry;
  return { id: Number(id), name: name[0].toUpperCase() + name.slice(1) };
}

const raceIcons: Record<string, string> = {
  Human: 'human', Orc: 'orc', Dwarf: 'dwarf', 'Night Elf': 'nightelf', Undead: 'scourge',
  Tauren: 'tauren', Gnome: 'gnome', Troll: 'troll', Skyborne: 'skyborne',
};

export function characterRaceIcon(race?: string | null, gender?: string | null): string | undefined {
  if (!race || !Object.hasOwn(raceIcons, race) || (gender !== 'MALE' && gender !== 'FEMALE')) return undefined;
  return `${raceIcons[race]}_${gender.toLowerCase()}`;
}

export function CharacterIcons({ character, leadingIcon }: {
  character: Pick<Character, 'playable_class' | 'playable_race' | 'gender'>; leadingIcon?: ReactNode;
}) {
  const className = classAvatars[character.playable_class?.id ?? 0]?.[0];
  const race = character.playable_race?.name;
  const raceIcon = characterRaceIcon(race, character.gender?.type);
  return <span className="profile-card-icons">
    {leadingIcon}
    {raceIcon && <img src={`/media/character/race_${raceIcon}.jpg`} width="18" height="18" alt={race} title={race} />}
    {className && <img src={`/media/character/class_${className}.jpg`} width="18" height="18" alt={character.playable_class?.name} title={character.playable_class?.name} />}
  </span>;
}

export function CharacterAvatar({ character, fallback, style, ownerAvatar = false }: {
  character: Pick<Character, 'playable_class' | 'avatarUrl' | 'avatarSdUrl' | 'avatarHdUrl'>;
  fallback?: ReactNode; style?: AvatarStyle; ownerAvatar?: boolean;
}) {
  const preference = useAvatarPreference();
  const [failedUrls, setFailedUrls] = useState<string[]>([]);
  const [className, color] = classAvatars[character.playable_class?.id ?? 0] ?? ['', '#b6b7bb'];
  const classIcon = className ? `/media/character/class_${className}.jpg` : null;
  const portraits = ownerAvatar && !style ? [character.avatarUrl, character.avatarSdUrl, character.avatarHdUrl] : (style ?? preference.style) === 'sd'
    ? [character.avatarSdUrl, character.avatarUrl, character.avatarHdUrl]
    : [character.avatarHdUrl, character.avatarUrl, character.avatarSdUrl];
  const source = [...portraits, classIcon]
    .find((url): url is string => !!url && !failedUrls.includes(url));
  return <span className={`character-avatar${source === classIcon ? ' is-class-icon' : ''}`} style={{ color }} aria-hidden="true">
    {source
      ? <img src={source} width="48" height="48" alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer"
          onError={() => setFailedUrls(urls => [...urls, source])} />
      : fallback ?? <span>✦</span>}
  </span>;
}
