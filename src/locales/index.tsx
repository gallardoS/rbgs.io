import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { messages as en, type MessageKey } from './en';
import { messages as es } from './es';

type Language = 'en' | 'es';
const LanguageContext = createContext({ language: 'en' as Language, setLanguage: (_language: Language) => {} });

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    try { return localStorage.getItem('rbgs-language') === 'es' ? 'es' : 'en'; }
    catch { return 'en'; }
  });
  useEffect(() => {
    document.documentElement.lang = language;
    try { localStorage.setItem('rbgs-language', language); } catch { /* Storage may be disabled. */ }
  }, [language]);
  return <LanguageContext.Provider value={{ language, setLanguage }}>{children}</LanguageContext.Provider>;
}

export function useLocale() {
  const context = useContext(LanguageContext);
  const messages = context.language === 'es' ? es : en;
  return { ...context, t: (key: MessageKey): string => messages[key] };
}
