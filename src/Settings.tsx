import { useId } from 'react';
import { useLocale } from './locales';
import { fcIconAsset, useFcIconPreference, type FcIcon } from './fc-icon-preference';
import './Settings.css';
import { DeviceSettings } from './DeviceSettings';
import { MatchReadySoundSelect } from './MatchReadySoundSelect';
import { AvatarStyleSelect } from './AvatarStyleSelect';

export function Settings({ accountId }: { accountId: string }) {
  const { t } = useLocale();
  const { icon, setIcon } = useFcIconPreference(accountId);
  const groupId = useId();
  return <div className="profile-settings">
    <section className="profile-settings-section" aria-labelledby={`${groupId}-title`}>
      <div className="profile-section-heading">
        <h2 id={`${groupId}-title`}>{t('settingsFcIcon')}</h2>
        <p>{t('settingsFcIconDescription')}</p>
      </div>
      <div>
        <fieldset className="fc-icon-options">
          <legend className="fc-icon-legend">{t('settingsFcIcon')}</legend>
          {(['tank', 'flag'] as FcIcon[]).map(option => <label className="fc-icon-option" key={option}>
            <input type="radio" name={groupId} value={option} checked={icon === option} onChange={() => setIcon(option)} />
            <img src={fcIconAsset(option)} width="40" height="40" alt="" />
            <span>{t(option === 'tank' ? 'settingsTankIcon' : 'settingsFlagIcon')}</span>
          </label>)}
        </fieldset>
      </div>
    </section>
    <AvatarStyleSelect accountId={accountId} />
    <section className="profile-settings-section">
      <div className="profile-section-heading"><h2>{t('matchReadySoundLabel')}</h2><p>{t('matchReadySoundDescription')}</p></div>
      <MatchReadySoundSelect />
    </section>
    <DeviceSettings accountId={accountId} />
  </div>;
}
