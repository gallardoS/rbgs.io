import { useId, useRef, useState } from 'react';
import { CaptureTestAdmin } from './CaptureTestAdmin';
import { useLocale } from './locales';
import './TesterPopup.css';

export function TesterPopup({ accountId }: { accountId: string }) {
  const { t } = useLocale();
  const title = useId();
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  return <>
    <button type="button" className="tester-popup-toggle" aria-label={t('testerTools')} aria-haspopup="dialog"
      onClick={() => { dialog.current?.showModal(); setOpen(true); }}>
      <img src="/media/notification/tester-engineering.jpg" width="38" height="38" alt="" />
    </button>
    <dialog ref={dialog} className="tester-popup" aria-labelledby={title} onClose={event => {
      if (event.target === event.currentTarget) setOpen(false);
    }}>
      <header>
        <h2 id={title}>{t('testerTools')}</h2>
        <button type="button" aria-label={t('notificationDismiss')} onClick={() => dialog.current?.close()}>×</button>
      </header>
      {open && <CaptureTestAdmin accountId={accountId} tester />}
    </dialog>
  </>;
}
