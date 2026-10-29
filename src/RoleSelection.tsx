import { useId, useState } from 'react';
import { useLocale } from './locales';
import { fcIconAsset, type FcIcon } from './fc-icon-preference';
import type { MessageKey } from './locales/en';
import { RoleOutlineIcon, type RoleIcon } from './RoleOutlineIcon';

export type MatchRole = 'FC' | 'HEALER' | 'DPS';
const roles: { role: MatchRole; icon: Exclude<RoleIcon, 'flag'>; label: MessageKey }[] = [
  { role: 'FC', icon: 'tank', label: 'selectionFc' },
  { role: 'HEALER', icon: 'heal', label: 'selectionHealer' },
  { role: 'DPS', icon: 'dps', label: 'selectionDps' },
];

export function RoleSelection({ value, disabled, fcIcon, onChange, legendLabel = 'selectionRole' }: {
  value: MatchRole | ''; disabled: boolean; fcIcon: FcIcon; legendLabel?: MessageKey; onChange: (role: MatchRole) => void;
}) {
  const { t } = useLocale();
  const groupId = useId();
  const [dismissed, setDismissed] = useState<MatchRole | null>(null);
  return <fieldset className="role-picker" disabled={disabled}>
    <legend className="role-legend">{t(legendLabel)}</legend>
    {roles.map(({ role, icon, label }) => <label className="role-option" key={role}
      data-tooltip-dismissed={dismissed === role}
      onPointerEnter={() => setDismissed(null)}
      onKeyDown={event => { if (event.key === 'Escape') setDismissed(role); }}>
      <input type="radio" name={groupId} value={role} checked={value === role}
        aria-label={t(label)} aria-describedby={`${groupId}-${role}`}
        onFocus={() => setDismissed(null)} onChange={() => onChange(role)} />
      <span className="role-icon">
        {value === role
          ? <img src={role === 'FC' ? fcIconAsset(fcIcon) : `/media/roles/${icon}.webp`} width="40" height="40" alt="" />
          : <RoleOutlineIcon icon={role === 'FC' ? fcIcon : icon} />}
      </span>
      <span className="role-tooltip" id={`${groupId}-${role}`} role="tooltip">{t(label)}</span>
    </label>)}
  </fieldset>;
}
