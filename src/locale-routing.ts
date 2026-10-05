export type Language = 'en' | 'es';

export function basePath(pathname: string) {
  const path = pathname.replace(/\/+$/, '') || '/';
  return path === '/es' ? '/' : path.startsWith('/es/') ? path.slice(3) : path;
}

export function localizedPath(pathname: string, language: Language) {
  const path = basePath(pathname);
  return language === 'es' ? path === '/' ? '/es/' : `/es${path}` : path;
}

export function pathLanguage(pathname: string): Language {
  return /^\/es(?:\/|$)/.test(pathname) ? 'es' : 'en';
}
