import { useEffect, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Link } from './LocalizedLink';
import { useLocale } from './locales';
import { languageLocales, localizedPath } from './locale-routing';
import { CharacterAvatar, CharacterIcons, PlayerCard, playableClassFromToken, type Character } from './PlayerCard';
import { PlayerCardPopover } from './PlayerCardPopover';
import { localStandings, standingsApi, standingsEnabled } from './leaderboard-config';
import { useLobbySession } from './LobbySession';
import { playerProfilePath } from './player-profile-path';
import { ratingTier } from './rating-tier';
import { preseasonId, SeasonPicker, type StandingsSeason } from './SeasonPicker';
import './LeaderboardProfile.css';

type RatingPoint = { rating: number; playedAt: string };
type QueueRating = {
  rating: number; games: number; wins: number; losses: number; draws: number;
  peak: number; initialRating: number; progression: RatingPoint[];
};
type ProfileMatch = {
  queue: 'SOLO' | 'PREMADE';
  character: string;
  realm: string;
  playedAt: string;
  outcome: 'WIN' | 'LOSS' | 'DRAW';
  rating: number;
};
type Season = StandingsSeason;
type Profile = {
  season: Season;
  seasons?: Season[];
  name: string;
  realm: string;
  appearance: { characterClass: string | null; race: string | null; gender: string | null; region: string };
  solo: QueueRating | null;
  premade: QueueRating | null;
  matches: ProfileMatch[];
};
type SelectedCharacter = { name: string; realm: string; region: string; character: Character | null };

const outcomes = { WIN: 'historyWin', LOSS: 'historyLoss', DRAW: 'historyDraw' } as const;
const queues = { SOLO: 'soloHeading', PREMADE: 'premadeHeading' } as const;
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

function validRating(value: QueueRating | null) {
  return value === null || value
    && [value.rating, value.games, value.wins, value.losses, value.draws, value.peak, value.initialRating]
      .every(number => Number.isSafeInteger(number) && number >= 0)
    && value.games > 0 && Array.isArray(value.progression) && value.progression.length === value.games
    && value.progression.every(point => point && Number.isSafeInteger(point.rating) && point.rating >= 0
      && typeof point.playedAt === 'string' && Number.isFinite(Date.parse(point.playedAt)));
}

function validSeason(season: Season) {
  return typeof season?.id === 'string' && uuid.test(season.id) && typeof season.name === 'string'
    && (season.subjectType === 'ACCOUNT' || season.subjectType === 'CHARACTER');
}

function validProfile(value: unknown, season: string): value is Profile {
  if (!value || typeof value !== 'object') return false;
  const profile = value as Profile;
  return validSeason(profile.season) && (!season || profile.season.id === season)
    && (profile.seasons === undefined || Array.isArray(profile.seasons) && profile.seasons.length <= 51
      && profile.seasons.every(validSeason) && profile.seasons.some(option => option.id === profile.season.id))
    && typeof profile.name === 'string' && typeof profile.realm === 'string'
    && profile.appearance && [profile.appearance.characterClass, profile.appearance.race, profile.appearance.gender]
      .every(value => value === null || typeof value === 'string')
    && typeof profile.appearance.region === 'string'
    && validRating(profile.solo) && validRating(profile.premade)
    && Array.isArray(profile.matches) && profile.matches.length > 0 && profile.matches.length <= 40
    && profile.matches.every(match => match && Object.hasOwn(queues, match.queue) && Object.hasOwn(outcomes, match.outcome)
      && typeof match.character === 'string' && typeof match.realm === 'string'
      && typeof match.playedAt === 'string' && Number.isFinite(Date.parse(match.playedAt))
      && Number.isSafeInteger(match.rating) && match.rating >= 0);
}

export function MyProfile({ accountId }: { accountId: string }) {
  const { t } = useLocale();
  const [selected, setSelected] = useState<SelectedCharacter | null>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let request: AbortController;
    async function load() {
      request?.abort();
      const controller = new AbortController();
      request = controller;
      setSelected(undefined);
      setFailed(false);
      try {
        const response = await fetch('/api/v1/me/play-character', { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error();
        const body = await response.text();
        const selection: SelectedCharacter | null = body ? JSON.parse(body) : null;
        if (!controller.signal.aborted) setSelected(selection);
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      }
    }
    const change = (event: Event) => {
      if ((event as CustomEvent<{ accountId: string }>).detail?.accountId === accountId) void load();
    };
    void load();
    window.addEventListener('rbgs-play-character-selected', change);
    return () => {
      request.abort();
      window.removeEventListener('rbgs-play-character-selected', change);
    };
  }, [accountId]);

  if (selected) return <LeaderboardProfile selected={selected} />;
  return <main className="content info-page">
    <h1>{t('navigationProfile')}</h1>
    {failed ? <p role="alert">{t('charactersError')}</p>
      : selected === undefined ? <p role="status">{t('charactersLoading')}</p>
      : <Link className="button" to="/play">{t('playChooseCharacter')}</Link>}
  </main>;
}

export function LeaderboardProfile({ selected }: { selected?: SelectedCharacter }) {
  const { t, language } = useLocale();
  const [params] = useSearchParams();
  const { region, realm, name } = useParams();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const lobby = useLobbySession();
  const group = lobby?.group;
  const namedPath = playerProfilePath(region, realm, name)?.toLowerCase();
  // A character with no public rating can still be viewed by their current lobby.
  const lobbyMatches = namedPath && group?.members.filter(member =>
    playerProfilePath(group.region, member.realm, member.characterName)?.toLowerCase() === namedPath);
  const lobbyMember = lobbyMatches && lobbyMatches.length === 1 ? lobbyMatches[0] : undefined;
  const rosterCharacter = group && lobbyMember?.characterName && lobbyMember.realm ? {
    name: lobbyMember.characterName, region: group.region, realm: lobbyMember.realm, character: lobbyMember.character ?? null,
  } : undefined;
  const season = params.get('season')?.toLowerCase() ?? '';
  const character = params.get('character') ?? '';
  const request = new URLSearchParams();
  if (standingsEnabled && (!season || uuid.test(season))) {
    if (selected) {
      request.set('region', selected.region);
      request.set('realm', selected.realm);
      request.set('name', selected.name);
    } else if (region && realm && name) {
      request.set('region', region);
      request.set('realm', realm);
      request.set('name', name);
    } else if (season && uuid.test(character)) {
      request.set('character', character);
    }
  }
  const identity = request.toString();
  if (identity && season) request.set('season', season);
  const query = request.toString();
  const [loaded, setLoaded] = useState<{ identity: string; query: string; profile: Profile }>();
  const [failedQuery, setFailedQuery] = useState('');
  const [publicSeasons, setPublicSeasons] = useState<Season[]>();
  const preseason = publicSeasons?.find(option => option.id === preseasonId);
  const profile = loaded?.query === query && failedQuery !== query ? loaded.profile : undefined;
  const lastProfile = loaded?.identity === identity ? loaded.profile : undefined;
  const isLoading = !!query && !profile && failedQuery !== query;
  const isWaitingForLobby = !!namedPath && lobby?.loading;
  const loadMessage = isLoading ? 'leaderboardProfileLoading'
    : query && !profile && (!(selected || rosterCharacter) || !!season && season !== preseason?.id)
      ? 'leaderboardProfileUnavailable' : 'leaderboardProfileNoRating';
  const requestedQueue = params.get('queue');
  const queue = requestedQueue === 'premade' || (!requestedQueue && !profile?.solo && profile?.premade) ? 'premade' : 'solo';

  useEffect(() => {
    if (!standingsEnabled || localStandings) return;
    const controller = new AbortController();
    fetch(standingsApi + '?queue=SOLO&limit=1', { signal: controller.signal, cache: 'no-store' })
      .then(response => response.ok ? response.json() : null)
      .then(payload => {
        if (!controller.signal.aborted && Array.isArray(payload?.seasons) && payload.seasons.every(validSeason))
          setPublicSeasons(payload.seasons);
      }).catch(() => { /* The profile's own season list still works. */ });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!query) return;
    setFailedQuery('');
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setFailedQuery(query);
      controller.abort();
    }, 10000);
    async function load() {
      try {
        const response = await fetch(standingsApi + '/profile?' + query, { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) throw Error();
        const payload: unknown = await response.json();
        if (!validProfile(payload, season)) throw Error();
        if (!controller.signal.aborted) setLoaded({ identity, query, profile: payload });
      } catch {
        if (!controller.signal.aborted) setFailedQuery(query);
      } finally {
        window.clearTimeout(timeout);
      }
    }
    void load();
    return () => { controller.abort(); window.clearTimeout(timeout); };
  }, [identity, query, season]);

  const locale = languageLocales[language];
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' });
  const bannerProfile = profile ?? lastProfile;
  const bannerSelection = selected ?? (bannerProfile ? undefined : rosterCharacter);
  const bannerCharacter = bannerSelection ? { ...bannerSelection.character, name: bannerSelection.name } : bannerProfile && {
    name: bannerProfile.name,
    playable_class: playableClassFromToken(bannerProfile.appearance.characterClass),
    playable_race: bannerProfile.appearance.race ? { name: bannerProfile.appearance.race } : undefined,
    gender: { type: bannerProfile.appearance.gender },
  };
  const ratedSeasons = bannerProfile?.seasons ?? (bannerProfile ? [bannerProfile.season] : []);
  const availableSeasons = preseason && !ratedSeasons.some(option => option.id === preseason.id)
    ? [...ratedSeasons, preseason] : ratedSeasons;
  const upcomingSeason = publicSeasons?.every(option => option.id === preseasonId) === true;
  const selectedSeason = availableSeasons.find(option => option.id === (season || profile?.season.id || preseason?.id));
  const selectedRating = profile?.[queue];
  const recentMatches = profile?.matches.filter(match => match.queue === (queue === 'solo' ? 'SOLO' : 'PREMADE')) ?? [];
  return <main className="content leaderboard-page info-page leaderboard-player-profile">
    {!bannerCharacter ? <>
      <h1>{t('leaderboardViewProfile')}</h1>
      <p role="status">{t(isLoading || isWaitingForLobby ? 'leaderboardProfileLoading' : 'leaderboardProfileUnavailable')}</p>
    </> : <>
      <ProfileBanner key={query} character={bannerCharacter} ownerAvatar={!!bannerSelection}
        region={bannerSelection?.region ?? bannerProfile?.appearance.region ?? ''} realm={bannerSelection?.realm ?? bannerProfile?.realm ?? ''} profile={profile} />
      {(availableSeasons.length > 0 || upcomingSeason) && <div className="leaderboard-profile-season">
        <SeasonPicker seasons={availableSeasons} selected={selectedSeason} upcoming={upcomingSeason}
          onChange={id => {
            const next = new URLSearchParams(params);
            next.set('season', id);
            navigate(localizedPath(pathname, language) + '?' + next, { preventScrollReset: true });
          }} />
        {selectedSeason && <span className="demo-note">{t(selectedSeason.subjectType === 'ACCOUNT' ? 'leaderboardAccountSeason' : 'leaderboardCharacterSeason')}</span>}
        {localStandings && <span className="demo-badge">{t('leaderboardLocal')}</span>}
      </div>}
      <div className="leaderboard-profile-details">
        <div className="leaderboard-profile-overview" role="group" aria-label={t('leaderboardQueue')}>
          {(['solo', 'premade'] as const).map(key => {
            const record = profile?.[key];
            return <button key={key} type="button" className="leaderboard-rating-option"
              aria-pressed={queue === key} aria-controls="season-rating-chart"
              onClick={() => {
                const next = new URLSearchParams(params);
                next.set('queue', key);
                navigate(localizedPath(pathname, language) + '?' + next, { replace: true, preventScrollReset: true });
              }}>
              <span className="leaderboard-rating-queue">{t(key === 'solo' ? 'soloHeading' : 'premadeHeading')}</span>
              <strong className="leaderboard-rating-number" data-rating-tier={ratingTier(record?.rating)}>
                {record?.rating.toLocaleString(locale) ?? '—'}
              </strong>
              {record ? <span className="leaderboard-rating-record">
                <span className="sr-only">
                  {t('leaderboardWins')} {record.wins.toLocaleString(locale)} · {t('leaderboardLosses')} {record.losses.toLocaleString(locale)}
                  {record.draws > 0 && ` · ${t('leaderboardDraws')} ${record.draws.toLocaleString(locale)}`}
                </span>
                <span aria-hidden="true" title={record.draws > 0 ? `${t('leaderboardDraws')}: ${record.draws.toLocaleString(locale)}` : undefined}>
                  <span className="leaderboard-rating-wins">{record.wins.toLocaleString(locale)}</span>
                  {' - '}
                  <span className="leaderboard-rating-losses">{record.losses.toLocaleString(locale)}</span>
                </span>
              </span> : <span className="leaderboard-rating-record">{t(profile ? 'leaderboardProfileNoRating' : loadMessage)}</span>}
              <span className="leaderboard-rating-stat">
                <span>{t('leaderboardProfilePeak')}</span>
                <strong data-rating-tier={ratingTier(record?.peak)}>{record?.peak.toLocaleString(locale) ?? '—'}</strong>
              </span>
              <span className="leaderboard-rating-stat">
                <span>{t('charactersGamesPlayed')}</span>
                <strong>{record?.games.toLocaleString(locale) ?? '—'}</strong>
              </span>
            </button>;
          })}
        </div>
        <section id="season-rating-chart" className="leaderboard-rating-chart" aria-labelledby="season-rating-heading">
          <h2 id="season-rating-heading">{t('leaderboardProfileProgression')} · {t(queue === 'solo' ? 'soloHeading' : 'premadeHeading')}</h2>
          {selectedRating
            ? <RatingChart key={query + queue} record={selectedRating} locale={locale} />
            : <p className="leaderboard-chart-empty" role="status">
              {t(profile ? 'leaderboardProfileNoRating' : loadMessage)}
            </p>}
          {recentMatches.length > 0 && <div className="leaderboard-profile-history">
            <h2 id="profile-history-heading">{t('leaderboardProfileMatches')}</h2>
            <div className="standings-scroll" tabIndex={0} role="region" aria-labelledby="profile-history-heading">
              <table className="standings">
                <thead><tr><th scope="col">{t('leaderboardMatchDate')}</th><th scope="col">{t('historyFilter')}</th>
                  <th scope="col">{t('leaderboardRating')}</th></tr></thead>
                <tbody>{recentMatches.map((match, index) => <tr key={index}>
                  <th scope="row"><time dateTime={match.playedAt}>{date.format(new Date(match.playedAt))}</time>
                    <small className="standings-realm">{match.character} · {match.realm}</small></th>
                  <td>{t(outcomes[match.outcome])}</td>
                  <td className="rating-cell" data-rating-tier={ratingTier(match.rating)}>{match.rating.toLocaleString(locale)}</td>
                </tr>)}</tbody>
              </table>
            </div>
          </div>}
        </section>
      </div>
    </>}
  </main>;
}

function ProfileBanner({ character, region, realm, profile, ownerAvatar }: {
  character: Pick<Character, 'name'> & Partial<Character>; region: string; realm: string;
  profile?: Profile | null; ownerAvatar: boolean;
}) {
  const { t } = useLocale();
  region = region === 'US' ? 'NA' : region;
  const appearance = [character.playable_class?.name, region, character.playable_race?.name].filter(Boolean).join(' · ');
  const games = (profile?.solo?.games ?? 0) + (profile?.premade?.games ?? 0);
  const wins = (profile?.solo?.wins ?? 0) + (profile?.premade?.wins ?? 0);
  return <header className="leaderboard-profile-banner">
    <CharacterAvatar character={character} ownerAvatar={ownerAvatar} />
    <div className="leaderboard-banner-identity">
      <h1>{character.name}</h1>
      <p className="leaderboard-banner-realm">{realm}</p>
      {appearance && <p className="leaderboard-banner-appearance">{appearance}</p>}
    </div>
    <CharacterIcons character={character} />
    <PlayerCardPopover triggerClassName="leaderboard-banner-trigger" placement="pointer"
      triggerLabel={t('leaderboardShowCard').replace('{name}', character.name)}
      card={<PlayerCard compact tilt character={character} ownerAvatar={ownerAvatar} locationLabel={`${region} · ${realm}`}
        competitive={{
          solo: profile?.solo?.rating,
          premade: profile?.premade?.rating,
          games,
          winRate: games > 0 ? Math.round(100 * wins / games) : undefined,
        }} />} />
  </header>;
}

function RatingChart({ record, locale }: { record: QueueRating; locale: string }) {
  const { t } = useLocale();
  const [inspected, setInspected] = useState<number | null>(null);
  const values = [record.initialRating, ...record.progression.map(point => point.rating)];
  const [minimum, maximum] = values.reduce(([low, high], value) => [Math.min(low, value), Math.max(high, value)],
    [record.initialRating, record.initialRating]);
  const step = Math.max(1, Math.ceil((maximum - minimum) / 4));
  const bottom = Math.max(0, minimum - step);
  const top = maximum + step;
  const x = (index: number) => 2 + 96 * index / record.games;
  const y = (value: number) => 100 * (top - value) / (top - bottom);
  const active = inspected ?? record.games;
  const date = record.progression[active - 1]?.playedAt;
  const caption = date ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(date))
    : t('leaderboardProfileStart');
  const points = values.map((value, index) => `${x(index)},${y(value)}`).join(' ');

  function inspect(event: PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const position = 100 * (event.clientX - bounds.left) / bounds.width;
    setInspected(Math.min(record.games, Math.max(0, Math.round((position - 2) * record.games / 96))));
  }

  function inspectWithKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    let next: number;
    switch (event.key) {
      case 'ArrowLeft': case 'ArrowDown': next = Math.max(0, active - 1); break;
      case 'ArrowRight': case 'ArrowUp': next = Math.min(record.games, active + 1); break;
      case 'Home': next = 0; break;
      case 'End': next = record.games; break;
      default: return;
    }
    event.preventDefault();
    setInspected(next);
  }

  return <figure className="leaderboard-chart">
    <figcaption>{caption} <strong data-rating-tier={ratingTier(values[active])}>{values[active].toLocaleString(locale)}</strong></figcaption>
    <div className="leaderboard-chart-body">
      <div className="leaderboard-chart-scale" aria-hidden="true">
        {[top, Math.round((top + bottom) / 2), bottom].map((tick, index) => <span key={index}>{tick.toLocaleString(locale)}</span>)}
      </div>
      <div className="leaderboard-chart-plot" role="slider" tabIndex={0} aria-labelledby="season-rating-heading"
        aria-valuemin={0} aria-valuemax={record.games} aria-valuenow={active}
        aria-valuetext={`${caption} · ${values[active].toLocaleString(locale)}`}
        onKeyDown={inspectWithKeyboard} onPointerDown={inspect}
        onPointerMove={event => { if (event.pointerType === 'mouse') inspect(event); }}
        onPointerLeave={event => { if (event.pointerType === 'mouse') setInspected(null); }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 0H100 M0 50H100 M0 100H100" className="leaderboard-chart-grid" vectorEffect="non-scaling-stroke" />
          <polygon points={`2,100 ${points} 98,100`} className="leaderboard-chart-area" />
          <polyline points={points} className="leaderboard-chart-line" vectorEffect="non-scaling-stroke" />
        </svg>
        <span className="leaderboard-chart-dot" style={{ left: `${x(active)}%`, top: `${y(values[active])}%` }} aria-hidden="true" />
      </div>
    </div>
    <div className="leaderboard-chart-axis" aria-hidden="true">
      <span>0</span><span>{t('charactersGamesPlayed')}</span><span>{record.games.toLocaleString(locale)}</span>
    </div>
  </figure>;
}
