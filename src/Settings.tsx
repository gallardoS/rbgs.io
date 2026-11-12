import { useId } from 'react';
import { useLocale } from './locales';
import { fcIconAsset, useFcIconPreference, type FcIcon } from './fc-icon-preference';
import './Settings.css';
import { DeviceSettings } from './DeviceSettings';
import { MatchReadySoundSelect } from './MatchReadySoundSelect';
import { AvatarStyleSelect } from './AvatarStyleSelect';
import { ProfileRegions } from './ProfileRegions';
import { usePrivacy } from './Privacy';

export function Settings({ accountId, displayName, onLogout }: {
  accountId: string; displayName: string; onLogout: () => Promise<void>;
}) {
  const { t } = useLocale();
  const { preferences, error, change, formatBattleTag } = usePrivacy();
  const { icon, setIcon } = useFcIconPreference(accountId);
  const groupId = useId();
  return <div className="profile-settings">
    <section className="profile-settings-section" aria-labelledby={`${groupId}-account`}>
      <div className="profile-section-heading">
        <h2 id={`${groupId}-account`}>{t('profileAccountHeading')}</h2>
        <p>{t('profileAccountDescription')}</p>
      </div>
      <div className="profile-account-options">
        <dl className="profile-account-details">
          <div><dt>Battle.net</dt><dd>{formatBattleTag(displayName, 'own')}</dd></div>
          <div><dt>{t('profileRegion')}</dt><dd><ProfileRegions accountId={accountId} /></dd></div>
        </dl>
        <div className="profile-section-heading">
          <h3>{t('profileSessionHeading')}</h3>
          <p>{t('profileSessionDescription')}</p>
        </div>
        <button type="button" onClick={() => void onLogout()}>{t('logout')}</button>
      </div>
    </section>
    <section className="profile-settings-section" aria-labelledby={`${groupId}-privacy`}>
      <div className="profile-section-heading">
        <h2 id={`${groupId}-privacy`}>{t('settingsPrivacy')}</h2>
        <p>{t('settingsPrivacyDescription')}</p>
      </div>
      <div className="profile-privacy-options">
        <label>
          <span>{t('settingsPrivacyOwn')}</span>
          <input type="checkbox" checked={preferences.own} onChange={event => change('own', event.target.checked)} />
        </label>
        <label>
          <span>{t('settingsPrivacyOthers')}</span>
          <input type="checkbox" checked={preferences.others} onChange={event => change('others', event.target.checked)} />
        </label>
        {error && <p role="alert">{t(error === 'read' ? 'settingsPrivacyReadError' : 'settingsPrivacyWriteError')}</p>}
      </div>
    </section>
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
