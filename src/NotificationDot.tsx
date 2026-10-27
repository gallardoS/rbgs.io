import type { ComponentPropsWithoutRef } from 'react';
import './NotificationDot.css';

type NotificationDotProps = Omit<ComponentPropsWithoutRef<'span'>, 'children'> & {
  size?: number;
  animate?: boolean;
};

/** Anniversary's notification diamond. Add aria-label when it conveys information. */
export function NotificationDot({ size = 25, animate = false, className, style, ...props }: NotificationDotProps) {
  const labelled = Boolean(props['aria-label'] || props['aria-labelledby'] || props.title);

  return <span role={labelled ? 'img' : undefined} aria-hidden={labelled ? undefined : true}
    {...props} className={['notification-dot', className].filter(Boolean).join(' ')}
    data-animate={animate} style={{ width: size, height: size, ...style }} />;
}
