import { useEffect, useRef, useState } from 'react';
import { useLocale } from './locales';

export function LanguageMenu() {
  const { language, setLanguage, t } = useLocale();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const other = language === 'en' ? 'es' : 'en';
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  return <div className="language-switch" ref={ref} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <button ref={trigger} type="button" className="language-flag" aria-label={`${t('languageLabel')}: ${language === 'en' ? 'English' : 'Español'}`} aria-expanded={open} aria-controls="language-options" onClick={() => setOpen(!open)}>
      <img src={`/flag-${language}.svg`} width="20" height="14" alt="" />
    </button>
    {open && <div id="language-options" className="language-options">
      <button type="button" className="language-flag language-alternative" aria-label={other === 'en' ? 'English' : 'Español'} title={other === 'en' ? 'English' : 'Español'} onClick={() => {
        setLanguage(other); setOpen(false); trigger.current?.focus();
      }}><img src={`/flag-${other}.svg`} width="20" height="14" alt="" /></button>
    </div>}
  </div>;
}
