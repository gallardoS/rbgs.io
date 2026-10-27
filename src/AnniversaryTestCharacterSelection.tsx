import { useEffect, useState } from 'react';
import { BattleNetLoginButton } from './BattleNetLoginButton';
import { useLocale } from './locales';
import type { MessageKey } from './locales/en';

export type TestCharacterReference = { namespace: string; wowAccountId: number; realmId: number; characterId: number };
type Choice = { key: string; reference: TestCharacterReference; name: string; realm: string; level: number };

export function AnniversaryTestCharacterSelection({ disabled, onChange }: {
  disabled: boolean; onChange: (value: TestCharacterReference | null) => void;
}) {
  const { t } = useLocale();
  const [choices, setChoices] = useState<Choice[]>([]);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<MessageKey | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(null); setChoices([]); setSelected(''); onChange(null);
    fetch('/api/v1/moderation/capture-tests/anniversary/characters', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
      .then(async response => {
        if (!response.ok) {
          if (!controller.signal.aborted) setError(response.status === 401 || response.status === 403
            ? 'charactersAuthorization' : 'charactersError');
          return;
        }
        const data = await response.json();
        if (!data || !Array.isArray(data.wow_accounts)) throw Error();
        const found: Choice[] = [];
        for (const account of data.wow_accounts) {
          if (!Number.isSafeInteger(account?.id) || !Array.isArray(account.characters)) throw Error();
          for (const c of account.characters) {
            if (!['profile-classicann-eu', 'profile-classicann-us'].includes(c?.namespace) || !Number.isSafeInteger(c.id)
              || typeof c.name !== 'string' || !c.name.trim() || !Number.isSafeInteger(c.realm?.id)
              || typeof (c.realm.name || c.realm.slug) !== 'string' || !Number.isInteger(c.level) || c.level < 1) throw Error();
            const reference = { namespace: c.namespace, wowAccountId: account.id, realmId: c.realm.id, characterId: c.id };
            found.push({ key: `${c.namespace}:${account.id}:${c.realm.id}:${c.id}`, reference, name: c.name, realm: c.realm.name || c.realm.slug, level: c.level });
          }
        }
        if (new Set(found.map(c => c.key)).size !== found.length) throw Error();
        if (!controller.signal.aborted) setChoices(found.sort((a, b) => a.name.localeCompare(b.name) || a.key.localeCompare(b.key)));
      })
      .catch(() => { if (!controller.signal.aborted) setError('charactersError'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [attempt, onChange]);

  const current = choices.find(choice => choice.key === selected);
  return <>
    <label>{t('captureTestChooseCharacter')}<select required value={selected} disabled={disabled || loading || error !== null || choices.length === 0}
      onChange={e => { setSelected(e.target.value); onChange(choices.find(c => c.key === e.target.value)?.reference ?? null); }}>
      <option value="">{t(loading ? 'charactersLoading' : 'captureTestSelectCharacter')}</option>
      {choices.map(choice => <option key={choice.key} value={choice.key}>
        {choice.name} · {choice.reference.namespace.endsWith('-us') ? 'NA' : 'EU'} · {choice.realm} · {t('charactersLevel')} {choice.level}
      </option>)}
    </select></label>
    {current && <p>{current.realm} · {current.reference.namespace.endsWith('-us') ? 'NA' : 'EU'} · {t('charactersLevel')} {current.level}</p>}
    {error ? <p role="alert">{t(error)}</p> : !loading && choices.length === 0 ? <p role="status">{t('captureTestCharactersEmpty')}</p> : null}
    {error === 'charactersAuthorization' ? <BattleNetLoginButton />
      : <button type="button" disabled={disabled || loading} onClick={() => setAttempt(value => value + 1)}>{t('captureTestRefreshCharacters')}</button>}
  </>;
}
