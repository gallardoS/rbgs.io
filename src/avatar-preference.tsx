import { createContext, useContext, useSyncExternalStore } from 'react';

export type AvatarStyle = 'sd' | 'hd';
export const AvatarPreferenceAccount = createContext<string | null>(null);
const values = new Map<string, AvatarStyle>();
const listeners = new Set<() => void>();
const prefix = 'rbgs.avatar-style.';

function read(accountId: string | null): AvatarStyle {
  if (!accountId) return 'sd';
  const key = prefix + accountId;
  const value = values.get(key);
  if (value) return value;
  try { return localStorage.getItem(key) === 'hd' ? 'hd' : 'sd'; }
  catch { return 'sd'; }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key.startsWith(prefix)) {
      if (event.key === null) values.clear();
      else values.delete(event.key);
      listener();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => { listeners.delete(listener); window.removeEventListener('storage', onStorage); };
}

export function useAvatarPreference() {
  const accountId = useContext(AvatarPreferenceAccount);
  const style = useSyncExternalStore(subscribe, () => read(accountId), () => 'sd' as AvatarStyle);
  function setStyle(next: AvatarStyle) {
    if (!accountId) return;
    const key = prefix + accountId;
    values.set(key, next);
    try { localStorage.setItem(key, next); } catch { /* Retain the preference for this session. */ }
    listeners.forEach(listener => listener());
  }
  return { style, setStyle };
}
