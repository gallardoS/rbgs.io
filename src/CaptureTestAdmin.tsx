import { useEffect, useRef, useState } from 'react';
import { useLocale } from './locales';
import { AnniversaryTestCharacterSelection, type TestCharacterReference } from './AnniversaryTestCharacterSelection';

import { Link } from './LocalizedLink';
import { MatchReadyDialog, type QueueRoom } from './MatchReadyDialog';

type TestKind = 'CAPTURE_ONLY' | 'ROSTER_CONTROLLED';

export function CaptureTestAdmin({ accountId, onCreated, tester = false }: { accountId: string; onCreated?: (matchId: string) => void; tester?: boolean }) {
  const { t } = useLocale();
  const endpoint = tester ? '/api/v1/tester/capture-tests' : '/api/v1/moderation/capture-tests';
  const [scenario, setScenario] = useState('NORMAL');
  const [queueMessage, setQueueMessage] = useState('');
  const [proposal, setProposal] = useState<{ room: QueueRoom; serverTime: string; expiresAt: number } | null>(null);
  const inFlight = useRef(false);
  const [kind, setKind] = useState<TestKind>('CAPTURE_ONLY');
  const [profile, setProfile] = useState('TBC_ANNIVERSARY_WSG_TEST');
  const [name, setName] = useState('');
  const [realm, setRealm] = useState('');
  const [opponent, setOpponent] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [created, setCreated] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState<TestCharacterReference | null>(null);
  const [playCharacter, setPlayCharacter] = useState<{ name: string; realm: string; reference: TestCharacterReference } | null>(null);
  const [playLoading, setPlayLoading] = useState(tester);
  const [pickerAttempt, setPickerAttempt] = useState(0);
  useEffect(() => {
    if (!proposal) return;
    const timer = window.setTimeout(() => setProposal(null), Math.max(0, proposal.expiresAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [proposal]);
  useEffect(() => {
    if (!tester) return;
    const controller = new AbortController();
    setPlayLoading(true);
    fetch('/api/v1/me/play-character', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw Error();
        const selected = await response.json();
        if (controller.signal.aborted) return;
        if (!selected || typeof selected.name !== 'string' || typeof selected.realm !== 'string'
            || typeof selected.namespace !== 'string'
            || ![selected.wowAccountId, selected.realmId, selected.characterId].every(Number.isSafeInteger)) {
          setPlayCharacter(null);
          return;
        }
        const reference = { namespace: selected.namespace, wowAccountId: selected.wowAccountId,
          realmId: selected.realmId, characterId: selected.characterId };
        setPlayCharacter({ name: selected.name, realm: selected.realm, reference });
        setSelectedCharacter(reference);
        setName(selected.name);
        setRealm(selected.realm);
        setProfile(selected.namespace.startsWith('profile-classicann-') ? 'TBC_ANNIVERSARY_WSG_TEST' : 'DARKSPEAR_DIAGNOSTIC');
      })
      .catch(() => { if (!controller.signal.aborted) setPlayCharacter(null); })
      .finally(() => { if (!controller.signal.aborted) setPlayLoading(false); });
    return () => controller.abort();
  }, [tester, accountId]);
  const captureOnly = kind === 'CAPTURE_ONLY';
  const anniversary = profile === 'TBC_ANNIVERSARY_WSG_TEST';

  const canCreate = !busy && !playLoading && (!tester || !!playCharacter) && (anniversary ? !!selectedCharacter : !!name.trim() && (captureOnly || !!opponent.trim()));

  async function simulate() {
    if (!canCreate || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setMessage('');
    setQueueMessage('');
    setCreated(false);
    try {
      const response = await fetch('/api/v1/tester/queue?' + new URLSearchParams({ scenario }), { cache: 'no-store' });
      if (!response.ok) throw Error();
      const { room, serverTime } = await response.json();
      if (!room) { setQueueMessage(t('testerQueueWaiting')); return; }
      setProposal({ room, serverTime, expiresAt: Date.now() + Date.parse(room.acceptanceDeadline) - Date.parse(serverTime) });
    } catch {
      setQueueMessage(t('captureTestError'));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  function proposeIndividual() {
    if (!canCreate) return;
    if (!tester) { void create(); return; }
    const now = Date.now();
    const expiresAt = now + 60_000;
    setProposal({
      serverTime: new Date(now).toISOString(), expiresAt,
      room: { id: crypto.randomUUID(), source: 'SIMULATION', status: 'PROPOSED',
        acceptanceDeadline: new Date(expiresAt).toISOString(), preparationDeadline: null, cancellationReason: null, version: 0,
        teamA: [{ accountId, name: playCharacter?.name ?? '', role: 'DPS', captain: false, accepted: false }], teamB: [] },
    });
  }

  async function create() {
    if (!canCreate || inFlight.current) return;
    inFlight.current = true;
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
      const response = await fetch(anniversary ? endpoint + '/anniversary' : endpoint, {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': decodeURIComponent(token) },
        body: JSON.stringify(anniversary ? { armMinutes: 60, character: selectedCharacter }
          : { armMinutes: 60, testKind: kind, expectedMapProfile: profile, roster }),
      });
      if (!response.ok) {
        if (tester && response.status === 422) {
          setPlayCharacter(null);
          setMessage(t('testerChoosePlayCharacter'));
          return;
        }
        if (anniversary && [401, 403, 422].includes(response.status)) {
          setSelectedCharacter(null); setPickerAttempt(value => value + 1);
          if (tester) setPlayCharacter(null);
          setMessage(t(tester && response.status === 422 ? 'testerChoosePlayCharacter' : response.status === 422 ? 'captureTestCharacterUnavailable' : 'charactersAuthorization'));
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
      inFlight.current = false;
      setBusy(false);
    }
  }

  return <>
    {tester && <section className="profile-settings-section">
      <div className="profile-section-heading"><h2>{t('testerSimulateQueue')}</h2><p>{t('testerSimulationHelp')}</p></div>
      <div className="device-pair-form">
        <label>{t('testerScenario')}<select value={scenario} disabled={busy} onChange={event => setScenario(event.target.value)}>
          <option value="NORMAL">{t('testerNormal')}</option>
          <option value="NO_CAPTAINS">{t('testerNoCaptains')}</option>
          <option value="NO_HEALERS">{t('testerNoHealers')}</option>
        </select></label>
        <button type="button" disabled={!canCreate} onClick={() => void simulate()}>{t('testerFillQueue')}</button>
        {queueMessage && <p role="status">{queueMessage}</p>}
      </div>
    </section>}
    <section className="profile-settings-section">
    <div className="profile-section-heading"><h2>{t('captureTestHeading')}</h2><p>{t('captureTestDescription')}</p></div>
    <form className="device-pair-form" onSubmit={e => { e.preventDefault(); proposeIndividual(); }}>
      {!tester && <label>{t('captureTestEnvironment')}<select value={profile} disabled={busy} onChange={e => { setProfile(e.target.value); setKind('CAPTURE_ONLY'); setSelectedCharacter(null); setMessage(''); setCreated(false); }}>
        <option value="TBC_ANNIVERSARY_WSG_TEST">{t('captureTestAnniversary')}</option>
        <option value="DARKSPEAR_DIAGNOSTIC">{t('captureTestForever')}</option>
      </select></label>}
      {profile === 'TBC_ANNIVERSARY_WSG_TEST' && <p>{t('captureTestTemporary')}</p>}
      <label>{t('captureTestKind')}<select value={kind} disabled={busy} onChange={e => { setKind(e.target.value as TestKind); setMessage(''); setCreated(false); }}>
        <option value="CAPTURE_ONLY">{t('captureTestRandom')}</option>
        <option value="ROSTER_CONTROLLED" disabled={profile === 'TBC_ANNIVERSARY_WSG_TEST'}>{t('captureTestRoster')}</option>
      </select></label>
      {captureOnly && <p>{t('captureTestRandomDescription')}</p>}
      {tester ? <div className="tester-play-character">
        {playLoading ? <p role="status">{t('charactersLoading')}</p> : playCharacter
          ? <p>{playCharacter.name} · {playCharacter.realm}</p>
          : <p role="status">{t('testerChoosePlayCharacter')}</p>}
        <Link to="/play" onClick={event => event.currentTarget.closest('dialog')?.close()}>{t('testerOpenPlay')}</Link>
      </div> : anniversary ? <AnniversaryTestCharacterSelection key={`${accountId}:${pickerAttempt}`} disabled={busy} onChange={setSelectedCharacter} endpoint={endpoint} /> : <>
        <label>{t('captureTestCharacter')}<input required maxLength={128} value={name} disabled={busy} onChange={e => setName(e.target.value)} /></label>
        <label>{t('captureTestRealm')}<input maxLength={128} value={realm} disabled={busy} onChange={e => setRealm(e.target.value)} /></label>
      </>}
      {!captureOnly && <label>{t('captureTestOpponent')}<input required maxLength={128} value={opponent} disabled={busy} onChange={e => setOpponent(e.target.value)} /></label>}
      <button disabled={!canCreate}>{t('captureTestCreate')}</button>
      {message && <p role="status">{message}</p>}
      {created && <a href="rbgs-companion://matches">{t('captureTestOpenCompanion')}</a>}
    </form>
    </section>
    {tester && <MatchReadyDialog room={proposal?.room ?? null} accountId={accountId}
      serverTime={proposal?.serverTime ?? new Date().toISOString()} busy={busy} onRespond={accept => {
        if (accept && proposal && Date.now() < proposal.expiresAt) void create();
        setProposal(null);
      }} />}
  </>;
}
