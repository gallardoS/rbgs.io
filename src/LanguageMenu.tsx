import { useEffect, useRef, useState } from 'react';
import { useLocale } from './locales';
import { Link, useLocation } from 'react-router-dom';
import { localizedPath } from './locale-routing';

export function LanguageMenu() {
  const { language, t } = useLocale();
  const location = useLocation();
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
    <div className="mobile-language-options">
      {(['en', 'es'] as const).map(code => <Link key={code} to={localizedPath(location.pathname, code) + location.search + location.hash} className="language-flag" aria-label={code === 'en' ? 'English' : 'Español'} title={code === 'en' ? 'English' : 'Español'} aria-current={language === code ? 'page' : undefined}>
        <img src={`/flag-${code}.svg`} width="20" height="14" alt="" />
      </Link>)}
    </div>
    <button ref={trigger} type="button" className="language-flag" aria-label={`${t('languageLabel')}: ${language === 'en' ? 'English' : 'Español'}`} aria-expanded={open} aria-controls="language-options" onClick={() => setOpen(!open)}>
      <img src={`/flag-${language}.svg`} width="20" height="14" alt="" />
    </button>
    {open && <div id="language-options" className="language-options">
      <Link to={localizedPath(location.pathname, other) + location.search + location.hash} className="language-flag language-alternative" aria-label={other === 'en' ? 'English' : 'Español'} title={other === 'en' ? 'English' : 'Español'} onClick={() => {
        setOpen(false); trigger.current?.focus();
      }}><img src={`/flag-${other}.svg`} width="20" height="14" alt="" /></Link>
    </div>}
  </div>;
}
