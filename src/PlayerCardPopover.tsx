import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { resetPlayerCardTilt, setPlayerCardTilt } from './PlayerCard';

export function PlayerCardPopover({ children, card, triggerClassName, triggerStyle, triggerLabel, interactiveLabel,
  placement = 'beside' }: {
  children?: ReactNode;
  card: ReactNode;
  triggerClassName: string;
  triggerStyle?: CSSProperties;
  triggerLabel?: string;
  interactiveLabel?: string;
  placement?: 'beside' | 'pointer';
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<number>(undefined);
  const openingPoint = useRef<{ x: number; y: number } | null>(null);
  const [open, setOpen] = useState(false);

  function cancelHide() {
    window.clearTimeout(hideTimer.current);
  }

  function show(point: { x: number; y: number } | null = null) {
    cancelHide();
    if (!popup.current?.matches(':popover-open')) {
      openingPoint.current = point;
      popup.current?.showPopover();
    }
  }

  function hideSoon() {
    cancelHide();
    hideTimer.current = window.setTimeout(() => {
      if (!trigger.current?.matches(':hover, :focus-visible') && !popup.current?.matches(':hover, :focus-within'))
        popup.current?.hidePopover();
    }, 180);
  }

  useEffect(() => () => window.clearTimeout(hideTimer.current), []);

  useLayoutEffect(() => {
    const card = popup.current;
    const button = trigger.current;
    if (!open || !card || !button) return;
    const table = button.closest('.standings-scroll');
    const gap = 8;
    const margin = 12;
    function place() {
      if (!card || !button || !card.matches(':popover-open')) return;
      const bounds = button.getBoundingClientRect();
      const viewport = table?.getBoundingClientRect();
      if (bounds.bottom <= Math.max(0, viewport?.top ?? 0)
        || bounds.top >= Math.min(window.innerHeight, viewport?.bottom ?? window.innerHeight)
        || bounds.right <= Math.max(0, viewport?.left ?? 0)
        || bounds.left >= Math.min(window.innerWidth, viewport?.right ?? window.innerWidth)) {
        card.hidePopover();
        return;
      }
      const width = card.offsetWidth;
      const height = card.offsetHeight;
      const fitsRight = placement === 'beside' && bounds.right + gap + width <= window.innerWidth - margin;
      const fitsLeft = placement === 'beside' && bounds.left - gap - width >= margin;
      let left: number;
      let top: number;
      const point = openingPoint.current;
      if (placement === 'pointer' && point) {
        const x = bounds.left + point.x;
        const y = bounds.top + point.y;
        left = x + gap + width <= window.innerWidth - margin ? x + gap : x - gap - width;
        top = y + gap + height <= window.innerHeight - margin ? y + gap : y - gap - height;
      } else {
        left = placement === 'pointer' ? bounds.left + (bounds.width - width) / 2
          : fitsRight ? bounds.right + gap : fitsLeft ? bounds.left - gap - width : bounds.left;
        const below = bounds.bottom + gap;
        top = fitsRight || fitsLeft ? bounds.top
          : below + height <= window.innerHeight - margin ? below : bounds.top - gap - height;
      }
      card.style.left = `${Math.max(margin, Math.min(left, window.innerWidth - width - margin))}px`;
      card.style.top = `${Math.max(margin, Math.min(top, window.innerHeight - height - margin))}px`;
      card.style.visibility = 'visible';
    }
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      card.style.visibility = '';
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, placement]);

  return <>
    <button ref={trigger} className={triggerClassName} type="button" popoverTarget={id}
      aria-controls={id} aria-expanded={open} aria-label={triggerLabel}
      aria-describedby={open && !interactiveLabel ? id : undefined} style={triggerStyle}
      onPointerEnter={event => {
        if (event.pointerType !== 'mouse') return;
        const bounds = event.currentTarget.getBoundingClientRect();
        show({ x: event.clientX - bounds.left, y: event.clientY - bounds.top });
      }}
      onPointerMove={event => {
        const playerCard = popup.current?.querySelector<HTMLElement>('.player-card');
        if (playerCard) setPlayerCardTilt(playerCard, event, event.currentTarget);
      }}
      onPointerLeave={event => {
        if (event.pointerType !== 'mouse') return;
        const playerCard = popup.current?.querySelector<HTMLElement>('.player-card');
        if (playerCard) resetPlayerCardTilt(playerCard);
        hideSoon();
      }}
      onFocus={event => {
        if (event.currentTarget.matches(':focus-visible') && !popup.current?.contains(event.relatedTarget)) show();
      }} onBlur={hideSoon}>
      {children}
    </button>
    <div id={id} ref={popup} popover="auto" role={interactiveLabel ? 'region' : 'tooltip'} aria-label={interactiveLabel}
      className="standings-player-card"
      onToggle={event => {
        const visible = event.currentTarget.matches(':popover-open');
        if (!visible) openingPoint.current = null;
        setOpen(visible);
      }}
      onPointerEnter={cancelHide} onPointerLeave={hideSoon} onFocus={cancelHide} onBlur={hideSoon}>
      {open && card}
    </div>
  </>;
}
