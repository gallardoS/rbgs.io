import { useState } from 'react';
import { useLocale } from './locales';

type TestKind = 'CAPTURE_ONLY' | 'ROSTER_CONTROLLED';

export function CaptureTestAdmin({ accountId }: { accountId: string }) {
  const { t } = useLocale();
  const [kind, setKind] = useState<TestKind>('CAPTURE_ONLY');
  const [name, setName] = useState('');
  const [realm, setRealm] = useState('');
  const [opponent, setOpponent] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const captureOnly = kind === 'CAPTURE_ONLY';

  async function create() {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      const token = document.cookie.split('; ').find(c => c.startsWith('XSRF-TOKEN='))?.slice(11);
      if (!token) throw Error();
      const character = { name: name.trim(), realm: realm.trim() || null };
      const roster = captureOnly
        ? [{ accountId, character, teamKey: null }]
        : [{ accountId, character, teamKey: 'A' }, { accountId: null, character: { name: opponent.trim(), realm: realm.trim() || null }, teamKey: 'B' }];
      const response = await fetch('/api/v1/moderation/capture-tests', {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': decodeURIComponent(token) },
        body: JSON.stringify({ armMinutes: 60, testKind: kind, roster }),
      });
      if (!response.ok) throw Error();
      const result = await response.json();
      if (!result || result.mode !== 'CONTROLLED_TEST' || result.testKind !== kind || typeof result.matchId !== 'string') throw Error();
      setMessage(t('captureTestCreated'));
    } catch {
      setMessage(t('captureTestError'));
    } finally {
      setBusy(false);
    }
  }

  return <section className="profile-settings-section">
    <div className="profile-section-heading"><h2>{t('captureTestHeading')}</h2><p>{t('captureTestDescription')}</p></div>
    <form className="device-pair-form" onSubmit={e => { e.preventDefault(); void create(); }}>
      <label>{t('captureTestKind')}<select value={kind} disabled={busy} onChange={e => { setKind(e.target.value as TestKind); setMessage(''); }}>
        <option value="CAPTURE_ONLY">{t('captureTestRandom')}</option>
        <option value="ROSTER_CONTROLLED">{t('captureTestRoster')}</option>
      </select></label>
      {captureOnly && <p>{t('captureTestRandomDescription')}</p>}
      <label>{t('captureTestCharacter')}<input required maxLength={128} value={name} disabled={busy} onChange={e => setName(e.target.value)} /></label>
      <label>{t('captureTestRealm')}<input maxLength={128} value={realm} disabled={busy} onChange={e => setRealm(e.target.value)} /></label>
      {!captureOnly && <label>{t('captureTestOpponent')}<input required maxLength={128} value={opponent} disabled={busy} onChange={e => setOpponent(e.target.value)} /></label>}
      <button disabled={busy || !name.trim() || (!captureOnly && !opponent.trim())}>{t('captureTestCreate')}</button>
      {message && <p role="status">{message}</p>}
    </form>
  </section>;
}
