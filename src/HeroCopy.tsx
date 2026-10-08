import { useLayoutEffect, useRef } from 'react';
import { BrandText } from './BrandText';
import { useLocale } from './locales';
import { messages, type MessageKey } from './locales/en';

// Use the English composition as a line budget at the current viewport width.
export function HeroCopy({ as: Tag, message, className, id }: {
  as: 'h1' | 'p'; message: MessageKey; className?: string; id?: string;
}) {
  const { t, language } = useLocale();
  const ref = useRef<HTMLHeadingElement & HTMLParagraphElement>(null);
  const text = t(message);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    let frame = 0;
    let disposed = false;
    const fit = () => {
      element.style.removeProperty('font-size');
      if (language === 'en') return;
      const style = getComputedStyle(element);
      const originalSize = parseFloat(style.fontSize);
      const reference = element.cloneNode(false) as HTMLElement;
      reference.removeAttribute('id');
      reference.setAttribute('aria-hidden', 'true');
      Object.assign(reference.style, {
        position: 'absolute', visibility: 'hidden', pointerEvents: 'none',
        width: `${element.getBoundingClientRect().width}px`, maxWidth: 'none',
      });
      for (const part of messages[message].split(/(rbgs\.io)/g)) {
        if (part === 'rbgs.io') {
          const brand = document.createElement('span');
          brand.className = 'brand';
          brand.textContent = part;
          reference.append(brand);
        } else reference.append(document.createTextNode(part));
      }
      element.parentElement!.append(reference);
      const lineCount = (node: HTMLElement) => Math.round(node.getBoundingClientRect().height / parseFloat(getComputedStyle(node).lineHeight));
      const target = lineCount(reference);
      reference.remove();
      if (lineCount(element) <= target) return;

      // Keep a readable floor for unusually long translations or narrow screens.
      const mobile = window.matchMedia('(max-width: 600px)').matches;
      let low = Math.min(originalSize, Math.max(Tag === 'h1' ? 32 : 14, originalSize * (mobile ? .8 : .6)));
      let high = originalSize;
      element.style.fontSize = `${low}px`;
      if (lineCount(element) > target) return;
      for (let step = 0; step < 12; step++) {
        const size = (low + high) / 2;
        element.style.fontSize = `${size}px`;
        if (lineCount(element) <= target) low = size;
        else high = size;
      }
      element.style.fontSize = `${low}px`;
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    };
    let width = -1;
    const observer = new ResizeObserver(entries => {
      const next = entries[0].contentRect.width;
      if (next !== width) { width = next; schedule(); }
    });
    observer.observe(element);
    window.addEventListener('resize', schedule);
    document.fonts.addEventListener('loadingdone', schedule);
    void document.fonts.ready.then(() => { if (!disposed) schedule(); });
    fit();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', schedule);
      document.fonts.removeEventListener('loadingdone', schedule);
    };
  }, [language, text, message, Tag]);

  return <Tag ref={ref} id={id} className={className}><BrandText text={text} /></Tag>;
}
