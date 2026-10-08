export const languages = ['en', 'es', 'fr'] as const;
export type Language = typeof languages[number];
export const languageNames = { en: 'English', es: 'Español', fr: 'Français' };
export const languageLocales = { en: 'en-US', es: 'es-ES', fr: 'fr-FR' };

export function basePath(pathname: string) {
  const path = pathname.replace(/\/+$/, '') || '/';
  return path.replace(/^\/(es|fr)(?=\/|$)/, '') || '/';
}

export function localizedPath(pathname: string, language: Language) {
  const path = basePath(pathname);
  return language === 'en' ? path : path === '/' ? `/${language}/` : `/${language}${path}`;
}

export function pathLanguage(pathname: string): Language {
  return pathname.match(/^\/(es|fr)(?:\/|$)/)?.[1] as Language ?? 'en';
}
