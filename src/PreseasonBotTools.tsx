import { useEffect, useState } from 'react';
import { Link } from './LocalizedLink';
import { useLocale } from './locales';

type Status = { available: boolean; running: boolean; owned: boolean };
const endpoint = '/api/v1/tester/preseason-bots';

export function PreseasonBotTools() {
  const { t } = useLocale();
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (busy) return;
    const controller = new AbortController();
    async function refresh() {
      try {
        const response = await fetch(endpoint, { cache: 'no-store', signal: controller.signal });
        if (response.ok && !controller.signal.aborted) setStatus(await response.json());
      } catch { /* Keep the last known status during reconnect. */ }
    }
    void refresh();
    const timer = window.setInterval(refresh, 5000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [busy]);

  async function change(queue?: 'SOLO' | 'PREMADE') {
    setBusy(true);
    setError(false);
    try {
      const token = document.cookie.split('; ').find(cookie => cookie.startsWith('XSRF-TOKEN='))?.slice(11);
      if (!token) throw Error();
      const response = await fetch(queue ? endpoint + '?' + new URLSearchParams({ queue }) : endpoint, {
        method: queue ? 'POST' : 'DELETE',
        headers: { 'X-XSRF-TOKEN': decodeURIComponent(token) },
        cache: 'no-store',
      });
      if (!response.ok) throw Error();
      setStatus(await response.json());
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  if (!status?.available && !status?.owned) return null;
  return <section className="profile-settings-section">
    <div className="profile-section-heading"><h2>{t('testerPreseasonBots')}</h2><p>{t('testerPreseasonBotsHelp')}</p></div>
    <div className="device-pair-form">
      <Link to="/play" onClick={event => event.currentTarget.closest('dialog')?.close()}>{t('testerOpenPlay')}</Link>
      <button type="button" disabled={busy || status.running} onClick={() => void change('SOLO')}>{t('testerPreseasonSoloBots')}</button>
      <button type="button" disabled={busy || status.running} onClick={() => void change('PREMADE')}>{t('testerPreseasonPremadeBots')}</button>
      {status.owned && <button type="button" disabled={busy} onClick={() => void change()}>{t('testerPreseasonStopBots')}</button>}
      {status.running && <p role="status">{t('testerPreseasonBotsRunning')}</p>}
      {error && <p role="status">{t('testerPreseasonBotsError')}</p>}
    </div>
  </section>;
}
