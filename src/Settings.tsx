import { useId } from 'react';
import { useLocale } from './locales';
import { useSearchParams } from 'react-router-dom';
import { Link } from './LocalizedLink';
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
  const [searchParams] = useSearchParams();
  const categories = [
    { id: 'preferences', label: t('settingsPreferences') },
    { id: 'privacy', label: t('settingsPrivacy') },
    { id: 'sound', label: t('settingsSound') },
    { id: 'account', label: t('settingsAccount') },
    { id: 'companion', label: 'Companion' },
  ] as const;
  const current = categories.find(category => category.id === searchParams.get('section')) ?? categories[0];

  return <div className="settings-layout">
    <nav className="settings-navigation" aria-label={t('navigationSettings')}>
      {categories.map(category => <Link key={category.id} to={`/settings?section=${category.id}`}
        aria-current={category.id === current.id ? 'page' : undefined}>{category.label}</Link>)}
    </nav>
    <div className="profile-settings settings-panel">
      {current.id === 'preferences' && <>
        <section className="settings-row" aria-labelledby={`${groupId}-icon`}>
          <h2 id={`${groupId}-icon`}>{t('settingsFcIcon')}</h2>
          <fieldset className="fc-icon-options">
            <legend className="fc-icon-legend">{t('settingsFcIcon')}</legend>
            {(['tank', 'flag'] as FcIcon[]).map(option => <label className="fc-icon-option" key={option}>
              <input type="radio" name={groupId} value={option} checked={icon === option} onChange={() => setIcon(option)} />
              <img src={fcIconAsset(option)} width="24" height="24" alt="" />
              <span>{t(option === 'tank' ? 'settingsTankIcon' : 'settingsFlagIcon')}</span>
            </label>)}
          </fieldset>
        </section>
        <AvatarStyleSelect accountId={accountId} />
      </>}
      {current.id === 'privacy' && <section aria-label={t('settingsPrivacy')}>
        <label className="settings-row">
          <span>{t('settingsPrivacyOwn')}</span>
          <input type="checkbox" checked={preferences.own} onChange={event => change('own', event.target.checked)} />
        </label>
        <label className="settings-row">
          <span>{t('settingsPrivacyOthers')}</span>
          <input type="checkbox" checked={preferences.others} onChange={event => change('others', event.target.checked)} />
        </label>
        {error && <p className="settings-message" role="alert">{t(error === 'read' ? 'settingsPrivacyReadError' : 'settingsPrivacyWriteError')}</p>}
      </section>}
      {current.id === 'sound' && <MatchReadySoundSelect />}
      {current.id === 'account' && <section aria-label={t('profileAccountHeading')}>
        <dl className="settings-account-details">
          <div className="settings-row"><dt>Battle.net</dt><dd>{formatBattleTag(displayName, 'own')}</dd></div>
          <div className="settings-row"><dt>{t('profileRegion')}</dt><dd><ProfileRegions accountId={accountId} /></dd></div>
        </dl>
        <div className="settings-row">
          <h2>{t('profileSessionHeading')}</h2>
          <button type="button" onClick={() => void onLogout()}>{t('logout')}</button>
        </div>
      </section>}
      {current.id === 'companion' && <DeviceSettings accountId={accountId} />}
    </div>
  </div>;
}
