import { useState, type CSSProperties } from 'react';
import { t } from './locales/en';

const players = [
  { name: 'Moonveil', className: 'Druid', color: '#ff9c45', raceIcon: 'tauren_female', raceLabel: 'Tauren female' },
  { name: 'Ironcrest', className: 'Warrior', color: '#c69b6d', raceIcon: 'orc_male', raceLabel: 'Orc male' },
  { name: 'Lightwarden', className: 'Paladin', color: '#f48cba', raceIcon: 'human_female', raceLabel: 'Human female' },
  { name: 'Frostwhisper', className: 'Mage', color: '#69ccf0', raceIcon: 'gnome_female', raceLabel: 'Gnome female' },
  { name: 'Shadowstep', className: 'Rogue', color: '#fff0a1', raceIcon: 'scourge_male', raceLabel: 'Undead male' },
  { name: 'Stormcaller', className: 'Shaman', color: '#578fff', raceIcon: 'troll_female', raceLabel: 'Troll female' },
  { name: 'Soulweaver', className: 'Warlock', color: '#b49cf2', raceIcon: 'scourge_female', raceLabel: 'Undead female' },
  { name: 'Dawnmender', className: 'Priest', color: '#eeeeee', raceIcon: 'dwarf_female', raceLabel: 'Dwarf female' },
  { name: 'Wildarrow', className: 'Hunter', color: '#abd473', raceIcon: 'nightelf_female', raceLabel: 'Night elf female' },
  { name: 'Thornheart', className: 'Druid', color: '#ff9c45', raceIcon: 'tauren_male', raceLabel: 'Tauren male' },
  { name: 'Steelguard', className: 'Warrior', color: '#c69b6d', raceIcon: 'human_male', raceLabel: 'Human male' },
  { name: 'Holyglow', className: 'Paladin', color: '#f48cba', raceIcon: 'human_female', raceLabel: 'Human female' },
];
const records = {
  solo: players.map((player, index) => ({ ...player, rating: 2458 - index * 47, wins: 94 - index * 4, losses: 28 + index * 2 })),
  premade: [...players].reverse().map((player, index) => ({ ...player, rating: 2386 - index * 53, wins: 68 - index * 3, losses: 16 + index * 2 })),
};

export function Leaderboard({ preview = false }: { preview?: boolean }) {
  const [queue, setQueue] = useState<'solo' | 'premade'>('solo');
  const [search, setSearch] = useState('');
  const ranked = records[queue].map((player, index) => ({ ...player, rank: index + 1 }));
  const visible = preview ? ranked.slice(0, 9) : ranked.filter(player => `${player.name} ${player.className}`.toLowerCase().includes(search.trim().toLowerCase()));
  const Container = preview ? 'section' : 'main';
  const Heading = preview ? 'h2' : 'h1';

  return <Container className={`content leaderboard-page ${preview ? 'leaderboard-preview' : 'info-page'}`}>
    <div className="leaderboard-heading"><div><Heading>{t('leaderboardHeading')}</Heading><p>{t('leaderboardIntro')}</p></div>{!preview && <span className="demo-badge">{t('leaderboardDemo')}</span>}</div>
    <div className="leaderboard-toolbar">
      <div className="queue-switch" role="group" aria-label={t('leaderboardQueue')}>
        <button aria-pressed={queue === 'solo'} onClick={() => setQueue('solo')}>{t('soloHeading')}</button>
        <button aria-pressed={queue === 'premade'} onClick={() => setQueue('premade')}>{t('premadeHeading')}</button>
      </div>
      {preview && <span className="demo-badge">{t('leaderboardPreviewSeason')}</span>}
      {!preview && <label className="player-search"><span className="sr-only">{t('leaderboardSearch')}</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder={t('leaderboardSearch')} /></label>}
    </div>
    <div className="standings-scroll" tabIndex={0} role="region" aria-label={t('navigationLeaderboard')}>
      <table className="standings"><caption className="sr-only">{t('leaderboardDemo')} · {t(queue === 'solo' ? 'soloHeading' : 'premadeHeading')}</caption>
        <thead><tr><th scope="col"><span className="sr-only">{t('leaderboardRank')}</span></th>{(['leaderboardPlayer', 'leaderboardRating', 'leaderboardWins', 'leaderboardLosses', 'leaderboardWinRate'] as const).map(key => <th scope="col" key={key}>{t(key)}</th>)}</tr></thead>
        <tbody>{visible.map(player => <tr key={player.name} className={player.rank <= 3 ? 'top-ranked' : ''}>
          <td className="rank-cell">#{player.rank}</td>
          <th scope="row"><div className="player-identity" style={{ '--class-color': player.color } as CSSProperties}>
            <div className="character-icons"><img src={`/media/character/class_${player.className.toLowerCase()}.jpg`} alt={player.className} title={player.className} width="28" height="28" /><img src={`/media/character/race_${player.raceIcon}.jpg`} alt={player.raceLabel} title={player.raceLabel} width="28" height="28" /></div>
            <span className="player-name">{player.name}</span>
          </div></th>
          <td className="rating-cell">{player.rating.toLocaleString('en-US')}</td><td className="wins-cell">{player.wins}</td><td>{player.losses}</td><td>{Math.round(player.wins / (player.wins + player.losses) * 100)}%</td>
        </tr>)}</tbody>
      </table>
      {visible.length === 0 && <p className="leaderboard-empty" role="status">{t('leaderboardEmpty')}</p>}
    </div>
    <p className="demo-note">{t('leaderboardDemoNote')}</p>
  </Container>;
}
