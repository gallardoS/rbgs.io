import { Link as RouterLink, NavLink as RouterNavLink, type LinkProps, type NavLinkProps } from 'react-router-dom';
import { useLocale } from './locales';
import { localizedPath, type Language } from './locale-routing';

function translateTo(to: LinkProps['to'], language: Language): LinkProps['to'] {
  if (typeof to !== 'string' || !to.startsWith('/') || to.startsWith('//')) return to;
  const [, pathname, suffix] = to.match(/^([^?#]*)(.*)$/s)!;
  return localizedPath(pathname, language) + suffix;
}

export function Link(props: LinkProps) {
  const { language } = useLocale();
  return <RouterLink {...props} to={translateTo(props.to, language)} />;
}

export function NavLink(props: NavLinkProps) {
  const { language } = useLocale();
  return <RouterNavLink {...props} to={translateTo(props.to, language)} />;
}
