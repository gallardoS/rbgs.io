export const languages = ['en', 'es', 'fr', 'de', 'pt-BR', 'ru', 'it'] as const;
export type Language = typeof languages[number];
export const languageNames = { en: 'English', es: 'Español', fr: 'Français', de: 'Deutsch', 'pt-BR': 'Português (Brasil)', ru: 'Русский', it: 'Italiano' };
export const languageLocales = { en: 'en-US', es: 'es-ES', fr: 'fr-FR', de: 'de-DE', 'pt-BR': 'pt-BR', ru: 'ru-RU', it: 'it-IT' };

export function basePath(pathname: string) {
  const path = pathname.replace(/\/+$/, '') || '/';
  return path.replace(/^\/(es|fr|de|pt-BR|ru|it)(?=\/|$)/, '') || '/';
}

export function localizedPath(pathname: string, language: Language) {
  const path = basePath(pathname);
  return language === 'en' ? path : path === '/' ? `/${language}/` : `/${language}${path}`;
}

export function pathLanguage(pathname: string): Language {
  return pathname.match(/^\/(es|fr|de|pt-BR|ru|it)(?:\/|$)/)?.[1] as Language ?? 'en';
}
