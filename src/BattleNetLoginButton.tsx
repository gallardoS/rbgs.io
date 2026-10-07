import { useLocale } from './locales';

export function BattleNetLoginButton() {
  const { t } = useLocale();
  return <a className="button battle-net-button" href="/oauth2/authorization/battle-net">
    <img src="/battle-net.svg" width="24" height="24" alt="" />
    {t('login')}
    <span className="button-arrow" aria-hidden="true">↗</span>
  </a>;
}
