import { useEffect, useRef } from 'react';
import { useLocale } from './locales';
import { BrandText } from './BrandText';
import { CheetahRunner } from './CheetahRunner';

const steps = [
  ['journeyLogin', 'guideLogin'], ['journeyInstall', 'guideInstall'],
  ['journeyQueue', 'guideQueue'], ['journeyAccept', 'guideAccept'],
  ['journeyWargame', 'guideWargame'], ['journeyResults', 'guideResults'],
] as const;

export function MatchJourney() {
  const { t } = useLocale();
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const section = ref.current;
    if (!section || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: .2 });
    section.classList.add('journey-animated');
    section.querySelectorAll('.journey-step').forEach(step => observer.observe(step));
    return () => { observer.disconnect(); section.classList.remove('journey-animated'); };
  }, []);
  return <section className="match-journey" id="how-it-works" ref={ref} aria-labelledby="journey-heading">
    <div className="journey-layout">
      <div className="journey-heading"><h2 id="journey-heading">{t('journeyHeading')}</h2><CheetahRunner /></div>
      <ol className="journey-list">{steps.map(([title, description], index) => <li className="journey-step" key={title}>
        <span className="journey-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
        <div><h3><BrandText text={t(title)} /></h3><p><BrandText text={t(description)} /></p></div>
      </li>)}</ol>
    </div>
  </section>;
}

