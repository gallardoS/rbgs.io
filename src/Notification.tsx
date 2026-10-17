import type { ComponentPropsWithoutRef } from 'react';
import { useLocale } from './locales';
import './Notification.css';

type NotificationProps = Omit<ComponentPropsWithoutRef<'span'>, 'children'> & {
  label?: string;
  animate?: boolean;
};

/** Inline feature marker using the Forever client's NewFeatureLabel artwork. */
export function Notification({ label, animate = true, className, ...props }: NotificationProps) {
  const { t } = useLocale();
  const text = label ?? t('notificationNew');

  return <span {...props} className={['notification', className].filter(Boolean).join(' ')}
    data-animate={animate}>
    <span className="notification-shadow" aria-hidden="true">{text}</span>
    <span className="notification-label">{text}</span>
    <span className="notification-glow" aria-hidden="true" />
  </span>;
}
