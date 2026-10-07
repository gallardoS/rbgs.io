import { useEffect, useRef, useState } from 'react';
import './CheetahRunner.css';
import { useLocale } from './locales';

export function CheetahRunner() {
  const { t } = useLocale();
  const sectionRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let visible = false;
    const update = () => setPlaying(visible && !document.hidden && !motion.matches);
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      update();
    }, { rootMargin: '150px' });
    observer.observe(section);
    document.addEventListener('visibilitychange', update);
    motion.addEventListener('change', update);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', update);
      motion.removeEventListener('change', update);
    };
  }, []);

  return <div ref={sectionRef} className="cheetah-runner">
    <div className="cheetah-stage">
      <div className="cheetah-shadow" />
      <img className="cheetah-animation"
        src={playing ? '/media/cheetah/cheetah-run-60fps.webp?v=2' : '/media/cheetah/cheetah-still.webp?v=2'}
        alt={t('cheetahModelLabel')} width={640} height={520}
        loading="lazy" decoding="async" />
    </div>
  </div>;
}
