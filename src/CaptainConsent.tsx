import { useId, useState } from 'react';
import { useLocale } from './locales';

export function CaptainConsent({ selected, disabled, onChange }: {
  selected: boolean; disabled: boolean; onChange: (selected: boolean) => void;
}) {
  const { t } = useLocale();
  const tooltipId = useId();
  const [dismissed, setDismissed] = useState(false);
  return <div className="captain-consent" data-tooltip-dismissed={dismissed}
    onPointerEnter={() => setDismissed(false)}
    onKeyDown={event => { if (event.key === 'Escape') setDismissed(true); }}>
    <button type="button" className="captain-toggle" aria-label={t('selectionCaptain')}
      aria-pressed={selected} aria-describedby={tooltipId} disabled={disabled}
      onFocus={() => setDismissed(false)}
      onClick={() => onChange(!selected)}>
      <svg className="captain-crown" width="32" height="32" viewBox="0 0 256 256"
        fill="none" stroke="currentColor" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {/* Crown Simple Fill: https://www.svgrepo.com/svg/364408/crown-simple-fill */}
        <path d="M238.72754,73.53516a15.90424,15.90424,0,0,0-16.70508-2.29981l-50.584,22.48242L141.98633,40.70312a15.999,15.999,0,0,0-27.97266,0L84.56055,93.7168,33.96875,71.23145A16.00031,16.00031,0,0,0,11.89551,89.51172l25.44531,108.333a15.83567,15.83567,0,0,0,7.4082,10.09179,16.15491,16.15491,0,0,0,12.49317,1.65137,265.89708,265.89708,0,0,1,141.46875-.01367,16.15265,16.15265,0,0,0,12.4873-1.65137,15.83531,15.83531,0,0,0,7.40821-10.084L244.0957,89.52051A15.90513,15.90513,0,0,0,238.72754,73.53516Z" />
      </svg>
    </button>
    <span id={tooltipId} className="captain-tooltip" role="tooltip">
      {t(selected ? 'selectionCaptainSelected' : 'selectionCaptainAvailable')}
    </span>
  </div>;
}
