import { useEffect, useState } from 'react';
import { useLocale } from './locales';

export function ProfileRegions({ accountId }: { accountId: string }) {
  const { t } = useLocale();
  const [regions, setRegions] = useState<string[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setRegions(null);
    setFailed(false);
    fetch('/api/v1/characters/regions', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error();
        const data: unknown = await response.json();
        if (!Array.isArray(data) || data.some(region => region !== 'EU' && region !== 'NA')) throw new Error();
        if (!controller.signal.aborted) setRegions([...new Set(data)].sort());
      })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [accountId]);

  if (failed) return <span role="status">{t('profileRegionsError')}</span>;
  if (regions === null) return <span role="status">{t('profileRegionsLoading')}</span>;
  return <>{regions.length ? regions.join(' / ') : t('profileRegionsEmpty')}</>;
}