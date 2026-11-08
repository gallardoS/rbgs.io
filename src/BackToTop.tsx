import { useEffect, useState } from 'react';
import { useLocale } from './locales';
import { ArrowIcon } from './ArrowIcon';

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
    <ArrowIcon />
  </button>;
}
