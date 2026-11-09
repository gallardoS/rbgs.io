import { useEffect, useId, useRef } from 'react';
import { useLocale } from './locales';
import './SeasonPicker.css';

export type StandingsSeason = { id: string; name: string; subjectType: 'ACCOUNT' | 'CHARACTER' };
export const preseasonId = '45b0ddbd-7bae-46f3-acb3-56b8f2adfa85';

export function SeasonPicker({ seasons, selected, upcoming, onChange }: {
  seasons: StandingsSeason[]; selected?: StandingsSeason; upcoming: boolean; onChange: (id: string) => void;
}) {
  const { t } = useLocale();
  const picker = useRef<HTMLDetailsElement>(null);
  const trigger = useRef<HTMLElement>(null);
  const label = useId();

  useEffect(() => {
    if (!upcoming) return;
    function dismiss(event: PointerEvent) {
      const details = picker.current;
      if (details?.open && event.target instanceof Node && !details.contains(event.target)) details.open = false;
    }
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [upcoming]);

  function close() {
    if (picker.current) picker.current.open = false;
    trigger.current?.focus();
  }

  if (!upcoming) return <div className="player-search">
    <select aria-label={t('leaderboardSeason')} value={selected?.id ?? ''} disabled={seasons.length === 0}
      onChange={event => onChange(event.target.value)}>
      {!selected && <option value="" disabled>{t('leaderboardSeason')}</option>}
      {seasons.map(season => <option key={season.id} value={season.id}>{season.name}</option>)}
    </select>
  </div>;

  return <details className="season-picker" ref={picker} onKeyDown={event => {
    if (event.key === 'Escape' && picker.current?.open) { event.preventDefault(); close(); }
  }}>
    <summary ref={trigger} aria-labelledby={label}><span id={label}>{selected?.name ?? t('leaderboardSeason')}</span></summary>
    <ul className="season-picker-options" aria-label={t('leaderboardSeason')}>
      {seasons.map(season => <li key={season.id}><button type="button" aria-pressed={season.id === selected?.id}
        onClick={() => { close(); if (season.id !== selected?.id) onChange(season.id); }}>{season.name}</button></li>)}
      <li className="season-picker-upcoming"><span>{t('leaderboardSeason')} 1</span><small className="coming-soon-label">{t('playComingSoon')}</small></li>
    </ul>
  </details>;
}
