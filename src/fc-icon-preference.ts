import { useSyncExternalStore } from 'react';

export type FcIcon = 'tank' | 'flag';
export const fcIconAsset = (icon: FcIcon) => `/media/roles/${icon === 'flag' ? 'leader' : 'tank'}.webp`;
const sessionValues = new Map<string, FcIcon>();
const listeners = new Set<() => void>();
const keyFor = (accountId: string) => `rbgs.fc-icon.${accountId}`;
const notify = () => listeners.forEach(listener => listener());

function read(key: string): FcIcon {
  const sessionValue = sessionValues.get(key);
  if (sessionValue) return sessionValue;
  try {
    const value = localStorage.getItem(key);
    return value === 'flag' ? 'flag' : 'tank';
  } catch {
    return sessionValues.get(key) ?? 'tank';
  }
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.storageArea !== localStorage) return;
    if (event.key === null || event.key.startsWith('rbgs.fc-icon.')) {
      if (event.key === null) sessionValues.clear();
      else sessionValues.delete(event.key);
      listener();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => { listeners.delete(listener); window.removeEventListener('storage', onStorage); };
}

export function useFcIconPreference(accountId: string) {
  const key = keyFor(accountId);
  const icon = useSyncExternalStore(subscribe, () => read(key), () => 'tank' as FcIcon);
  function setIcon(next: FcIcon) {
    sessionValues.set(key, next);
    try { localStorage.setItem(key, next); } catch { /* Keep the preference for this session when storage is disabled. */ }
    notify();
  }
  return { icon, setIcon };
}
