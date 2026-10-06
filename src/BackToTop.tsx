import { useEffect, useState } from 'react';
import { useLocale } from './locales';

export function BackToTop() {
  const { t } = useLocale();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const scroller = document.getElementById('page-scroll');
    const update = () => setVisible((scroller?.scrollTop ?? 0) > Math.max(600, scroller?.clientHeight ?? window.innerHeight));
    update();
    scroller?.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      scroller?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);
  if (!visible) return null;
  return <button className="back-to-top" type="button" aria-label={t('backToTop')} title={t('backToTop')} onClick={() => {
    document.getElementById('page-scroll')?.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }}>
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5m-7 7 7-7 7 7" /></svg>
  </button>;
}
