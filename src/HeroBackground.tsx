import { useEffect, useRef, type CSSProperties } from 'react';

// Stable random positions prevent the field jumping when React renders again.
let seed = 731;
const random = () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};
const layers = [
  { count: 42, size: 1, opacity: .3, duration: 65 },
  { count: 30, size: 1.5, opacity: .5, duration: 45 },
  { count: 18, size: 2.2, opacity: .7, duration: 30 },
].map((layer) => Array.from({ length: layer.count }, () => {
  const x = random() * 100;
  const duration = layer.duration + random() * 20;
  return {
    left: `${x}%`, '--rest-y': `${random() * 100}%`,
    '--drift': `${(50 - x) * (.25 + random() * .25)}cqw`,
    '--size': `${layer.size + random() * .6}px`, '--opacity': layer.opacity,
    '--duration': `${duration}s`, '--delay': `${-random() * duration}s`,
    '--color': random() > .5 ? '#FACC15' : '#EAB308',
  } as CSSProperties;
}));

export function HeroBackground() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      element.style.setProperty('--rise', `${-entry.contentRect.height - 32}px`);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const element = ref.current;
    const hero = element?.parentElement;
    if (!element || !hero) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const pointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    let frame = 0;
    let x = 0;
    let y = 0;
    const update = () => {
      frame = 0;
      element.style.setProperty('--pointer-x', `${x}px`);
      element.style.setProperty('--pointer-y', `${y}px`);
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    const reset = () => { x = 0; y = 0; schedule(); };
    const move = (event: PointerEvent) => {
      if (motion.matches || !pointer.matches || event.pointerType !== 'mouse') return;
      const bounds = hero.getBoundingClientRect();
      x = Math.max(-1, Math.min(1, (event.clientX - bounds.left) / bounds.width * 2 - 1)) * 16;
      y = Math.max(-1, Math.min(1, (event.clientY - bounds.top) / bounds.height * 2 - 1)) * 12;
      schedule();
    };
    hero.addEventListener('pointermove', move);
    hero.addEventListener('pointerleave', reset);
    window.addEventListener('blur', reset);
    motion.addEventListener('change', reset);
    pointer.addEventListener('change', reset);
    return () => {
      window.cancelAnimationFrame(frame);
      hero.removeEventListener('pointermove', move);
      hero.removeEventListener('pointerleave', reset);
      window.removeEventListener('blur', reset);
      motion.removeEventListener('change', reset);
      pointer.removeEventListener('change', reset);
      element.style.removeProperty('--pointer-x');
      element.style.removeProperty('--pointer-y');
    };
  }, []);
  return <div ref={ref} className="hero-background" aria-hidden="true">
    <div className="hero-glow" />
    <div className="particle-field">
      {layers.map((particles, layer) => <div className={`particle-layer particle-layer-${layer}`} key={layer}>
        {particles.map((style, index) => <span className="particle" style={style} key={index} />)}
      </div>)}
    </div>
  </div>;
}
