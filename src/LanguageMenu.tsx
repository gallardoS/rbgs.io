import { useEffect, useRef, useState } from 'react';
import { useLocale } from './locales';
import { Link, useLocation } from 'react-router-dom';
import { languages, languageNames, localizedPath } from './locale-routing';

export function LanguageMenu() {
  const { language, t } = useLocale();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const alternatives = languages.filter(code => code !== language);
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
    <div className="mobile-language-options">
      {languages.map(code => <Link key={code} to={localizedPath(location.pathname, code) + location.search + location.hash} className="language-flag" aria-label={languageNames[code]} title={languageNames[code]} aria-current={language === code ? 'page' : undefined}>
        <img src={`/flag-${code}.svg`} width="20" height="14" alt="" />
      </Link>)}
    </div>
    <button ref={trigger} type="button" className="language-flag" aria-label={`${t('languageLabel')}: ${languageNames[language]}`} aria-expanded={open} aria-controls="language-options" onClick={() => setOpen(!open)}>
      <img src={`/flag-${language}.svg`} width="20" height="14" alt="" />
    </button>
    {open && <div id="language-options" className="language-options">
      {alternatives.map(code => <Link key={code} to={localizedPath(location.pathname, code) + location.search + location.hash} className="language-flag language-alternative" aria-label={languageNames[code]} title={languageNames[code]} onClick={() => {
        setOpen(false); trigger.current?.focus();
      }}><img src={`/flag-${code}.svg`} width="20" height="14" alt="" /></Link>)}
    </div>}
  </div>;
}
