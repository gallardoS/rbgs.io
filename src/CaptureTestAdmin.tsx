import { useState } from 'react';
import { useLocale } from './locales';
import { AnniversaryTestCharacterSelection, type TestCharacterReference } from './AnniversaryTestCharacterSelection';

type TestKind = 'CAPTURE_ONLY' | 'ROSTER_CONTROLLED';

export function CaptureTestAdmin({ accountId, onCreated }: { accountId: string; onCreated?: (matchId: string) => void }) {
  const { t } = useLocale();
  const [kind, setKind] = useState<TestKind>('CAPTURE_ONLY');
  const [profile, setProfile] = useState('TBC_ANNIVERSARY_WSG_TEST');
  const [name, setName] = useState('');
  const [realm, setRealm] = useState('');
  const [opponent, setOpponent] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [created, setCreated] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState<TestCharacterReference | null>(null);
  const [pickerAttempt, setPickerAttempt] = useState(0);
  const captureOnly = kind === 'CAPTURE_ONLY';
  const anniversary = profile === 'TBC_ANNIVERSARY_WSG_TEST';

  async function create() {
    if (busy || anniversary && !selectedCharacter) return;
    setBusy(true);
    setMessage('');
    setCreated(false);
    try {
      const token = document.cookie.split('; ').find(c => c.startsWith('XSRF-TOKEN='))?.slice(11);
      if (!token) throw Error();
      const character = { name: name.trim(), realm: realm.trim() || null };
      const roster = captureOnly
        ? [{ accountId, character, teamKey: null }]
        : [{ accountId, character, teamKey: 'A' }, { accountId: null, character: { name: opponent.trim(), realm: realm.trim() || null }, teamKey: 'B' }];
      const response = await fetch(anniversary ? '/api/v1/moderation/capture-tests/anniversary' : '/api/v1/moderation/capture-tests', {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': decodeURIComponent(token) },
        body: JSON.stringify(anniversary ? { armMinutes: 60, character: selectedCharacter }
          : { armMinutes: 60, testKind: kind, expectedMapProfile: profile, roster }),
      });
      if (!response.ok) {
        if (anniversary && [401, 403, 422].includes(response.status)) {
          setSelectedCharacter(null); setPickerAttempt(value => value + 1);
          setMessage(t(response.status === 422 ? 'captureTestCharacterUnavailable' : 'charactersAuthorization'));
          return;
        }
        throw Error();
      }
      const result = await response.json();
      if (!result || result.mode !== 'CONTROLLED_TEST' || result.testKind !== kind || typeof result.matchId !== 'string') throw Error();
      setMessage(t('captureTestCreated'));
      setCreated(true);
      onCreated?.(result.matchId);
    } catch {
      setMessage(t('captureTestError'));
    } finally {
      setBusy(false);
    }
  }

  return <section className="profile-settings-section">
    <div className="profile-section-heading"><h2>{t('captureTestHeading')}</h2><p>{t('captureTestDescription')}</p></div>
    <form className="device-pair-form" onSubmit={e => { e.preventDefault(); void create(); }}>
      <label>{t('captureTestEnvironment')}<select value={profile} disabled={busy} onChange={e => { setProfile(e.target.value); setKind('CAPTURE_ONLY'); setSelectedCharacter(null); setMessage(''); setCreated(false); }}>
        <option value="TBC_ANNIVERSARY_WSG_TEST">{t('captureTestAnniversary')}</option>
        <option value="DARKSPEAR_DIAGNOSTIC">{t('captureTestForever')}</option>
      </select></label>
      {profile === 'TBC_ANNIVERSARY_WSG_TEST' && <p>{t('captureTestTemporary')}</p>}
      <label>{t('captureTestKind')}<select value={kind} disabled={busy} onChange={e => { setKind(e.target.value as TestKind); setMessage(''); setCreated(false); }}>
        <option value="CAPTURE_ONLY">{t('captureTestRandom')}</option>
        <option value="ROSTER_CONTROLLED" disabled={profile === 'TBC_ANNIVERSARY_WSG_TEST'}>{t('captureTestRoster')}</option>
      </select></label>
      {captureOnly && <p>{t('captureTestRandomDescription')}</p>}
      {anniversary ? <AnniversaryTestCharacterSelection key={`${accountId}:${pickerAttempt}`} disabled={busy} onChange={setSelectedCharacter} /> : <>
        <label>{t('captureTestCharacter')}<input required maxLength={128} value={name} disabled={busy} onChange={e => setName(e.target.value)} /></label>
        <label>{t('captureTestRealm')}<input maxLength={128} value={realm} disabled={busy} onChange={e => setRealm(e.target.value)} /></label>
      </>}
      {!captureOnly && <label>{t('captureTestOpponent')}<input required maxLength={128} value={opponent} disabled={busy} onChange={e => setOpponent(e.target.value)} /></label>}
      <button disabled={busy || (anniversary ? !selectedCharacter : !name.trim() || (!captureOnly && !opponent.trim()))}>{t('captureTestCreate')}</button>
      {message && <p role="status">{message}</p>}
      {created && <a href="rbgs-companion://matches">{t('captureTestOpenCompanion')}</a>}
    </form>
  </section>;
}
