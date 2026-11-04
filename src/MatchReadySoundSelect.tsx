import { useEffect, useId, useRef, useState } from 'react';
import { useLocale } from './locales';
import { matchReadySounds, useMatchReadySound, type MatchReadySound } from './match-ready-sound-preference';
import { previewMatchReadySound } from './match-ready-sound';
import './MatchReadySoundSelect.css';

export function MatchReadySoundSelect() {
  const { t } = useLocale();
  const { sound, setSound } = useMatchReadySound();
  const id = useId();
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const stopPreview = useRef<(() => void) | undefined>(undefined);
  useEffect(() => () => stopPreview.current?.(), []);
  useEffect(() => {
    if (!open) return;
    container.current?.querySelector<HTMLButtonElement>('.match-ready-sound-choice[aria-pressed=true]')?.focus();
    const outside = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setOpen(false); trigger.current?.focus(); }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  return <div className="match-ready-sound-select" ref={container} onBlur={event => {
    if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <span id={`${id}-label`}>{t('matchReadySoundLabel')}</span>
    <button ref={trigger} type="button" className="match-ready-sound-trigger" aria-labelledby={`${id}-label ${id}-value`}
      aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? `${id}-menu` : undefined} onClick={() => setOpen(value => !value)}>
      <span id={`${id}-value`}>{matchReadySounds[sound]}</span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
    </button>
    {open && <div id={`${id}-menu`} className="match-ready-sound-menu" role="dialog" aria-labelledby={`${id}-label`}>
        {(Object.keys(matchReadySounds) as MatchReadySound[]).map(option => {
          const name = matchReadySounds[option];
          return <div className="match-ready-sound-option" key={option}>
            <button type="button" className="match-ready-sound-choice" aria-pressed={sound === option} onClick={() => {
              stopPreview.current?.();
              setSound(option);
              stopPreview.current = previewMatchReadySound(option);
              setOpen(false);
              trigger.current?.focus();
            }}>{name}</button>
            <button type="button" className="match-ready-sound-preview" aria-label={`${t('matchReadySoundPreview')}: ${name}`}
              onClick={() => {
                stopPreview.current?.(); stopPreview.current = previewMatchReadySound(option);
              }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M11 5 6 9H3v6h3l5 4V5Z" /><path d="M15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14" />
              </svg>
            </button>
          </div>;
        })}
    </div>}
  </div>;
}
