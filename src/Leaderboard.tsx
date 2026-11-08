import { useEffect, useState, type CSSProperties } from 'react';
import { useLocale } from './locales';
import { languageLocales } from './locale-routing';
import { PlayerCard, characterRaceIcon } from './PlayerCard';
import { PlayerCardPopover } from './PlayerCardPopover';
import { Link } from './LocalizedLink';
import { useSearchParams } from 'react-router-dom';
import { ArrowIcon } from './ArrowIcon';
import { localStandings, standingsApi, standingsEnabled } from './leaderboard-config';
import { ratingTier } from './rating-tier';

const classColors = {
  Druid: '#ff9c45',
  Warrior: '#c69b6d',
  Paladin: '#f48cba',
  Mage: '#69ccf0',
  Rogue: '#fff0a1',
  Shaman: '#578fff',
  Warlock: '#b49cf2',
  Priest: '#eeeeee',
  Hunter: '#abd473',
};

const players: { name: string; className: keyof typeof classColors; raceIcon: string; raceLabel: string }[] = [
  { name: 'Moonveil', className: 'Druid', raceIcon: 'tauren_female', raceLabel: 'Tauren female' },
  { name: 'Ironcrest', className: 'Warrior', raceIcon: 'orc_male', raceLabel: 'Orc male' },
  { name: 'Lightwarden', className: 'Paladin', raceIcon: 'human_female', raceLabel: 'Human female' },
  { name: 'Frostwhisper', className: 'Mage', raceIcon: 'gnome_female', raceLabel: 'Gnome female' },
  { name: 'Shadowstep', className: 'Rogue', raceIcon: 'scourge_male', raceLabel: 'Undead male' },
  { name: 'Stormcaller', className: 'Shaman', raceIcon: 'troll_female', raceLabel: 'Troll female' },
  { name: 'Soulweaver', className: 'Warlock', raceIcon: 'scourge_female', raceLabel: 'Undead female' },
  { name: 'Dawnmender', className: 'Priest', raceIcon: 'dwarf_female', raceLabel: 'Dwarf female' },
  { name: 'Wildarrow', className: 'Hunter', raceIcon: 'nightelf_female', raceLabel: 'Night elf female' },
  { name: 'Thornheart', className: 'Druid', raceIcon: 'tauren_male', raceLabel: 'Tauren male' },
  { name: 'Steelguard', className: 'Warrior', raceIcon: 'human_male', raceLabel: 'Human male' },
  { name: 'Holyglow', className: 'Paladin', raceIcon: 'human_female', raceLabel: 'Human female' },
];
const records = {
  solo: players.map((player, index) => ({ ...player, rating: 2458 - index * 47, wins: 94 - index * 4, losses: 28 + index * 2 })),
  premade: [...players].reverse().map((player, index) => ({ ...player, rating: 2386 - index * 53, wins: 68 - index * 3, losses: 16 + index * 2 })),
};

export function Leaderboard({ preview = false }: { preview?: boolean }) {
  return !preview && standingsEnabled
    ? <RatedLeaderboard />
    : <DemoLeaderboard preview={preview} />;
}

type Queue = 'solo' | 'premade';
type Entry = { rank: number; name: string; rating: number; wins: number; losses: number; draws?: number; realm?: string; profileRef?: string;
  className?: keyof typeof classColors; raceIcon?: string; raceLabel?: string; region?: string; uniqueName?: boolean };
type Season = { id: string; name: string; subjectType: 'ACCOUNT' | 'CHARACTER' };
type RatedEntry = Omit<Entry, 'className' | 'raceIcon' | 'raceLabel'> & {
  draws: number; characterClass?: string | null; race?: string | null; gender?: string | null;
};
type Page = { seasonId: string | null; seasons: Season[]; entries: RatedEntry[]; nextOffset: number | null; totalPages: number };

function classColor(player: Entry): CSSProperties {
  return { '--class-color': player.className ? classColors[player.className] : undefined } as CSSProperties;
}

function ratedEntry(row: RatedEntry): Entry {
  return {
    ...row,
    className: (Object.keys(classColors) as (keyof typeof classColors)[])
      .find(name => name.toUpperCase() === row.characterClass?.trim().toUpperCase()),
    raceIcon: characterRaceIcon(row.race, row.gender),
    raceLabel: row.race ?? undefined,
  };
}

function DemoLeaderboard({ preview }: { preview: boolean }) {
  const { t } = useLocale();
  const [queue, setQueue] = useState<Queue>('solo');
  const [search, setSearch] = useState('');
  const ranked = records[queue].map((player, index) => ({ ...player, rank: index + 1 }));
  const visible = preview ? ranked.slice(0, 9) : ranked.filter(player => `${player.name} ${player.className}`.toLowerCase().includes(search.trim().toLowerCase()));
  const Container = preview ? 'section' : 'main';
  const Heading = preview ? 'h2' : 'h1';

  return <Container className={`content leaderboard-page ${preview ? 'leaderboard-preview' : 'info-page'}`}>
    <div className="leaderboard-heading"><div><Heading>{t('leaderboardHeading')}</Heading><p>{t('leaderboardIntro')}</p></div>{!preview && <span className="demo-badge">{t('leaderboardDemo')}</span>}</div>
    <div className="leaderboard-toolbar">
      <QueueSwitch queue={queue} onChange={setQueue} />
      {preview && <span className="demo-badge">{t('leaderboardPreviewSeason')}</span>}
      {!preview && <label className="player-search"><span className="sr-only">{t('leaderboardSearch')}</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder={t('leaderboardSearch')} /></label>}
    </div>
    <StandingsTable entries={visible} queue={queue} showCards={!preview}
      caption={t('leaderboardDemo') + ' · ' + t(queue === 'solo' ? 'soloHeading' : 'premadeHeading')} empty={t('leaderboardEmpty')} />
    <p className="demo-note">{t('leaderboardDemoNote')}</p>
  </Container>;
}

function QueueSwitch({ queue, onChange }: { queue: Queue; onChange: (queue: Queue) => void }) {
  const { t } = useLocale();
  return <div className="queue-switch" role="group" aria-label={t('leaderboardQueue')}>
    <button aria-pressed={queue === 'solo'} onClick={() => onChange('solo')}>{t('soloHeading')}</button>
    <button aria-pressed={queue === 'premade'} onClick={() => onChange('premade')}>{t('premadeHeading')}</button>
  </div>;
}

function StandingsTable({ entries, queue, caption, empty, seasonId, showDraws = false, busy = false, showCards = true }: {
  entries: Entry[]; queue: Queue; caption: string; empty: string; showDraws?: boolean; busy?: boolean; showCards?: boolean;
  seasonId?: string | null;
}) {
  const { t, language } = useLocale();
  const columns = ['leaderboardPlayer', 'leaderboardRating', 'leaderboardWins', 'leaderboardLosses',
    ...(showDraws ? ['leaderboardDraws' as const] : []), 'leaderboardWinRate'] as const;
  return <div className="standings-scroll" tabIndex={0} role="region" aria-label={t('navigationLeaderboard')} aria-busy={busy}>
      <table className="standings"><caption className="sr-only">{caption}</caption>
        <thead><tr><th scope="col"><span className="sr-only">{t('leaderboardRank')}</span></th>{columns.map(key => <th scope="col" key={key}>{t(key)}</th>)}</tr></thead>
        <tbody>{entries.map(player => <tr key={`${queue}:${player.rank}:${player.name}:${player.realm ?? ''}`} className={player.rank <= 3 ? 'top-ranked' : ''}>
          <td className="rank-cell">#{player.rank}</td>
          <th scope="row">{showCards ? <StandingPlayer player={player} queue={queue} seasonId={seasonId} />
            : <div className="player-identity" style={classColor(player)}><StandingIdentity player={player} /></div>}</th>
          <td className="rating-cell" data-rating-tier={ratingTier(player.rating)}>{player.rating.toLocaleString(languageLocales[language])}</td>
          <td className="wins-cell">{player.wins}</td><td>{player.losses}</td>{showDraws && <td>{player.draws}</td>}
          <td>{Math.round(player.wins / (player.wins + player.losses + (player.draws ?? 0)) * 100)}%</td>
        </tr>)}</tbody>
      </table>
      {entries.length === 0 && <p className="leaderboard-empty" role="status">{empty}</p>}
  </div>;
}

function StandingIdentity({ player }: { player: Entry }) {
  return <>
    <span className="character-icons">
      {player.className
        ? <img src={`/media/character/class_${player.className.toLowerCase()}.jpg`} alt={player.className} title={player.className} width="28" height="28" loading="lazy" decoding="async" />
        : <span aria-hidden="true" />}
      {player.raceIcon
        ? <img src={`/media/character/race_${player.raceIcon}.jpg`} alt={player.raceLabel} title={player.raceLabel} width="28" height="28" loading="lazy" decoding="async" />
        : <span aria-hidden="true" />}
    </span>
    <span className="player-name">{player.name}{player.realm && <small className="standings-realm"> · {player.realm}</small>}</span>
  </>;
}

function playerProfileHref(player: Entry, queue: Queue, season?: string | null) {
  if (!season || !player.profileRef) return undefined;
  const params = new URLSearchParams({ season, queue });
  if (player.uniqueName && player.region && player.realm
    && [player.realm, player.name].every(segment => segment !== '.' && segment !== '..' && !/[%/\\]/.test(segment))) {
    const path = [player.region.toLowerCase(), player.realm, player.name].map(encodeURIComponent).join('/');
    return '/player/' + path + '?' + params;
  }
  params.set('character', player.profileRef);
  return '/leaderboard/player?' + params;
}

function StandingPlayer({ player, queue, seasonId }: { player: Entry; queue: Queue; seasonId?: string | null }) {
  const { t } = useLocale();
  const profileHref = playerProfileHref(player, queue, seasonId);
  const games = player.wins + player.losses + (player.draws ?? 0);
  const classIcon = player.className && `/media/character/class_${player.className.toLowerCase()}.jpg`;
  return <PlayerCardPopover triggerClassName="player-identity standings-player-trigger"
    triggerStyle={classColor(player)} interactiveLabel={profileHref ? player.name : undefined}
    card={<PlayerCard compact tilt character={{ name: player.name }}
      locationLabel={player.realm || t('leaderboardDemo')}
      avatarFallback={classIcon ? <img src={classIcon} alt="" width="48" height="48" /> : undefined}
      competitive={{ [queue]: player.rating, games, winRate: Math.round(player.wins / games * 100) }}
      footer={profileHref && <Link className="standings-profile-link" to={profileHref}>{t('leaderboardViewProfile')}</Link>} />}>
    <StandingIdentity player={player} />
  </PlayerCardPopover>;
}

const pageSize = 20;

function validPage(value: unknown): value is Page {
  if (!value || typeof value !== 'object') return false;
  const page = value as Page;
  return Array.isArray(page.seasons) && page.seasons.length <= 50
    && page.seasons.every(s => s && typeof s.id === 'string' && typeof s.name === 'string'
      && (s.subjectType === 'ACCOUNT' || s.subjectType === 'CHARACTER'))
    && (page.seasonId === null ? page.seasons.length === 0 : page.seasons.some(s => s.id === page.seasonId))
    && (page.nextOffset === null || Number.isSafeInteger(page.nextOffset) && page.nextOffset > 0 && page.nextOffset <= 10_000)
    && Number.isSafeInteger(page.totalPages) && page.totalPages >= 0
    && Array.isArray(page.entries) && page.entries.length <= pageSize
    && page.entries.every(row => row && typeof row.name === 'string' && typeof row.realm === 'string'
      && typeof row.profileRef === 'string'
      && [row.characterClass, row.race, row.gender].every(value => value == null || typeof value === 'string')
      && [row.rank, row.rating, row.wins, row.losses, row.draws].every(n => Number.isSafeInteger(n) && n >= 0)
      && row.rank > 0 && row.wins + row.losses + row.draws > 0);
}

function RatedLeaderboard() {
  const { t, language } = useLocale();
  const [paramsFromUrl] = useSearchParams();
  const [queue, setQueue] = useState<Queue>(() => paramsFromUrl.get('queue') === 'premade' ? 'premade' : 'solo');
  const [season, setSeason] = useState(() => paramsFromUrl.get('season') ?? '');
  const [search, setSearch] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [offset, setOffset] = useState(0);
  const [loaded, setLoaded] = useState<{ key: string; scope: string; page: Page; offset: number } | null>(null);
  const [failed, setFailed] = useState('');
  const scope = queue + ':' + season;
  const params = new URLSearchParams({ queue: queue.toUpperCase(), search: searchTerm, offset: String(offset), limit: String(pageSize) });
  if (season) params.set('season', season);
  const query = params.toString();
  const page = loaded?.key === query ? loaded.page : null;
  const failedRequest = !page && failed === query;
  const searchPending = search.trim() !== searchTerm;
  const busy = searchPending || (!page && !failedRequest);
  const displayed = !failedRequest && loaded?.scope === scope ? loaded : null;
  const entries = displayed?.page.entries.map(ratedEntry) ?? [];
  const totalPages = Math.max(1, displayed?.page.totalPages ?? 0);
  const currentPage = (displayed?.offset ?? 0) / pageSize + 1;
  const pageCount = t('leaderboardPageCount')
    .replace('{current}', currentPage.toLocaleString(languageLocales[language]))
    .replace('{total}', totalPages.toLocaleString(languageLocales[language]));
  const selected = loaded?.page.seasons.find(item => item.id === (season || loaded.page.seasonId));

  useEffect(() => {
    const term = search.trim();
    if (term === searchTerm) return;
    const timeout = window.setTimeout(() => {
      setOffset(0);
      setSearchTerm(term);
    }, 200);
    return () => window.clearTimeout(timeout);
  }, [search, searchTerm]);

  useEffect(() => {
    if (searchPending) return;
    setFailed('');
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setFailed(query);
      controller.abort();
    }, 10000);
    async function load() {
      try {
        const response = await fetch(standingsApi + '?' + query, { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) throw Error();
        const payload: unknown = await response.json();
        if (!validPage(payload)) throw Error();
        if (controller.signal.aborted) return;
        const lastOffset = Math.max(0, payload.totalPages - 1) * pageSize;
        if (offset > lastOffset) {
          setOffset(lastOffset);
          return;
        }
        setLoaded({ key: query, scope, page: payload, offset });
      } catch {
        if (!controller.signal.aborted) setFailed(query);
      } finally { window.clearTimeout(timeout); }
    }
    void load();
    return () => { controller.abort(); window.clearTimeout(timeout); };
  }, [query, scope, offset, searchPending]);

  return <main className="content leaderboard-page info-page">
    <div className="leaderboard-heading"><div><h1>{t('leaderboardHeading')}</h1><p>{t('leaderboardIntro')}</p></div>
      {localStandings && <span className="demo-badge">{t('leaderboardLocal')}</span>}</div>
    <div className="leaderboard-toolbar">
      <QueueSwitch queue={queue} onChange={value => { setQueue(value); setOffset(0); }} />
      <div className="player-search">
        <select aria-label={t('leaderboardSeason')} value={selected?.id ?? ''} disabled={!loaded?.page.seasons.length}
          onChange={event => { setSeason(event.target.value); setOffset(0); }}>
          {!loaded?.page.seasons.length && <option value="">{t('leaderboardSeason')}</option>}
          {loaded?.page.seasons.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </div>
      <label className="player-search"><span className="sr-only">{t('leaderboardSearchName')}</span>
        <input type="search" value={search} maxLength={100} placeholder={t('leaderboardSearchName')}
          onChange={event => setSearch(event.target.value)} /></label>
    </div>
    {selected && <p className="demo-note">{t(selected.subjectType === 'ACCOUNT' ? 'leaderboardAccountSeason' : 'leaderboardCharacterSeason')}</p>}
    <StandingsTable entries={entries} queue={queue} showDraws busy={busy} caption={selected?.name ?? t('leaderboardHeading')}
      seasonId={loaded?.scope === scope ? loaded.page.seasonId : undefined}
      empty={t(busy ? 'leaderboardLoading' : failedRequest ? 'leaderboardLoadError'
        : searchTerm ? 'leaderboardEmpty' : 'leaderboardNoRatedPlayers')} />
    <div className="standings-pagination">
      <button type="button" className="standings-page-button" aria-label={t('leaderboardPrevious')} title={t('leaderboardPrevious')}
        disabled={busy || !page || offset === 0} onClick={() => setOffset(value => Math.max(0, value - pageSize))}>
        <ArrowIcon direction="left" />
      </button>
      <span className="standings-page-count" role="status">{pageCount}</span>
      <button type="button" className="standings-page-button" aria-label={t('leaderboardNext')} title={t('leaderboardNext')}
        disabled={busy || page?.nextOffset == null} onClick={() => page?.nextOffset != null && setOffset(page.nextOffset)}>
        <ArrowIcon direction="right" />
      </button>
    </div>
  </main>;
}
