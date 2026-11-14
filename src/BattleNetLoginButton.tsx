import { useLocale } from './locales';

export const battleNetLoginPath = '/oauth2/authorization/battle-net';

export function BattleNetLoginButton() {
  const { t } = useLocale();
  return <a className="button battle-net-button" href={battleNetLoginPath}>
    <img src="/battle-net.svg" width="24" height="24" alt="" />
    {t('login')}
    <span className="button-arrow" aria-hidden="true">↗</span>
  </a>;
}
