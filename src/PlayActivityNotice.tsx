import { useLocation } from 'react-router-dom';
import { FloatingNotificationGroup } from './FloatingNotifications';
import { Link } from './LocalizedLink';
import { useLobbySession } from './LobbySession';
import { useSoloQueueSession } from './SoloQueueSession';
import { basePath } from './locale-routing';
import { useLocale } from './locales';

export function PlayActivityNotice() {
  const { pathname } = useLocation();
  const { t } = useLocale();
  const soloQueue = useSoloQueueSession();
  const lobby = useLobbySession();
  const searchingSolo = soloQueue?.status?.ticket?.state === 'QUEUED';

  if (basePath(pathname) === '/play' || (!searchingSolo && !lobby?.group)) return null;

  return <FloatingNotificationGroup>
    <article className="lobby-invite-notice play-activity-notice">
      <strong role="status">{t(searchingSolo ? 'playActivitySolo' : 'playActivityPremade')}</strong>
      <Link className="button" to={searchingSolo ? '/play?mode=solo' : '/play?mode=premade'}>
        {t('playActivityReturn')}
      </Link>
    </article>
  </FloatingNotificationGroup>;
}
