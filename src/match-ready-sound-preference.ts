import { useSyncExternalStore } from 'react';

export const matchReadySounds = { ping: 'Ping', circuit: 'Circuit', petal: 'Petal' } as const;
export type MatchReadySound = keyof typeof matchReadySounds;
const storageKey = 'rbgs.match-ready.sound';
const listeners = new Set<() => void>();
let chosen: MatchReadySound | undefined;

export function getMatchReadySound(): MatchReadySound {
  if (chosen) return chosen;
  try {
    const saved = localStorage.getItem(storageKey);
    return saved && Object.hasOwn(matchReadySounds, saved) ? saved as MatchReadySound : 'circuit';
  }
  catch { return 'circuit'; }
}

function setSound(sound: MatchReadySound) {
  chosen = sound;
  try { localStorage.setItem(storageKey, sound); } catch { /* Keep this session's choice. */ }
  listeners.forEach(listener => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === storageKey || event.key === null) {
      chosen = undefined;
      listener();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => { listeners.delete(listener); window.removeEventListener('storage', onStorage); };
}

export function useMatchReadySound() {
  const sound = useSyncExternalStore(subscribe, getMatchReadySound, () => 'circuit' as MatchReadySound);
  return { sound, setSound };
}
