import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type AvatarStyle = 'sd' | 'hd';
type Preference = { style: AvatarStyle; configured: boolean };
type State = { style: AvatarStyle; loading: boolean; saving: boolean; failed: boolean; setStyle: (style: AvatarStyle) => Promise<void> };
const Context = createContext<State>({ style: 'sd', loading: false, saving: false, failed: false, setStyle: async () => {} });
async function persist(style: AvatarStyle, signal?: AbortSignal): Promise<Preference> {
  const token = document.cookie.split('; ').find(cookie => cookie.startsWith('XSRF-TOKEN='))?.slice(11);
  if (!token) throw new Error('Missing CSRF token');
  const response = await fetch('/api/v1/me/avatar-preference', { method: 'PUT', credentials: 'same-origin', signal,
    headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': decodeURIComponent(token) }, body: JSON.stringify({ style }) });
  if (!response.ok) throw new Error('Avatar preference unavailable');
  return response.json();
}
export function AvatarPreferenceProvider({ accountId, children }: { accountId: string | null; children: ReactNode }) {
  const [preference, setPreference] = useState<Preference>({ style: 'sd', configured: false });
  const [loading, setLoading] = useState(!!accountId);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setPreference({ style: 'sd', configured: false }); setFailed(false); setLoading(!!accountId);
    if (!accountId) return () => controller.abort();
    async function load() {
      const response = await fetch('/api/v1/me/avatar-preference', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error('Avatar preference unavailable');
      let value = await response.json() as Preference;
      if (value.style !== 'sd' && value.style !== 'hd') throw new Error('Invalid avatar style');
      // Migrate the former browser preference once, without replacing an existing account preference.
      if (!value.configured) {
        let legacy: string | null = null;
        try { legacy = localStorage.getItem('rbgs.avatar-style.' + accountId); } catch { /* Storage is optional. */ }
        if (legacy === 'sd' || legacy === 'hd') value = await persist(legacy, controller.signal);
      }
      if (!controller.signal.aborted) setPreference(value);
    }
    load().catch(() => { if (!controller.signal.aborted) setFailed(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [accountId]);
  async function setStyle(style: AvatarStyle) {
    if (!accountId || loading || saving) return;
    setSaving(true); setFailed(false);
    try { setPreference(await persist(style)); }
    catch { setFailed(true); }
    finally { setSaving(false); }
  }
  return <Context.Provider value={{ style: preference.style, loading, saving, failed, setStyle }}>{children}</Context.Provider>;
}
export const useAvatarPreference = () => useContext(Context);
