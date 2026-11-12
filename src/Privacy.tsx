import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const storageKey = 'rbgs.privacy.v1';
const defaults = { own: true, others: false };
type Preferences = typeof defaults;
type Preference = keyof Preferences;
type PrivacyState = { preferences: Preferences; error: 'read' | 'write' | null };

function readPreferences(): PrivacyState {
  try {
    const stored = typeof window === 'undefined' ? null : window.localStorage.getItem(storageKey);
    if (stored === null) return { preferences: defaults, error: null };
    const value = JSON.parse(stored);
    if (typeof value?.own === 'boolean' && typeof value?.others === 'boolean') {
      return { preferences: { own: value.own, others: value.others }, error: null };
    }
  } catch { /* Hide the numbers when preferences cannot be read. */ }
  return { preferences: { own: true, others: true }, error: 'read' };
}

const PrivacyContext = createContext<PrivacyState & {
  change: (preference: Preference, enabled: boolean) => void;
  formatBattleTag: (value: string, owner: Preference) => string;
} | null>(null);

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(readPreferences);

  useEffect(() => {
    function sync(event: StorageEvent) {
      if ((event.key === storageKey || event.key === null) && event.storageArea === window.localStorage) {
        setState(readPreferences());
      }
    }
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  function change(preference: Preference, enabled: boolean) {
    const preferences = { ...state.preferences, [preference]: enabled };
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(preferences));
      setState({ preferences, error: null });
    } catch {
      setState({ preferences, error: 'write' });
    }
  }

  return <PrivacyContext.Provider value={{ ...state, change,
    formatBattleTag: (value, owner) => state.preferences[owner] ? value.replace(/#\d+$/, '') : value,
  }}>{children}</PrivacyContext.Provider>;
}

export function usePrivacy() {
  const privacy = useContext(PrivacyContext);
  if (!privacy) throw new Error('PrivacyProvider is required');
  return privacy;
}
