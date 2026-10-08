import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { localizedPath, pathLanguage, type Language } from '../locale-routing';
import { messages as en, type MessageKey } from './en';
import { messages as es } from './es';
import { messages as fr } from './fr';

const catalogs = { en, es, fr };

const LanguageContext = createContext({ language: 'en' as Language, setLanguage: (_language: Language) => {} });

export function LanguageProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const language = pathLanguage(location.pathname);
  const setLanguage = (next: Language) => navigate(localizedPath(location.pathname, next) + location.search + location.hash);
  useEffect(() => {
    document.documentElement.lang = language;
    try { localStorage.setItem('rbgs-language', language); } catch { /* Storage may be disabled. */ }
  }, [language]);
  return <LanguageContext.Provider value={{ language, setLanguage }}>{children}</LanguageContext.Provider>;
}

export function useLocale() {
  const context = useContext(LanguageContext);
  const messages = catalogs[context.language];
  return { ...context, t: (key: MessageKey): string => messages[key] };
}
