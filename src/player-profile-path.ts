export function playerProfilePath(region?: string | null, realm?: string | null, name?: string | null) {
  if (!region || !realm || !name
    || [region, realm, name].some(segment => !segment.trim() || segment === '.' || segment === '..' || /[%/\\]/.test(segment))) return;
  return '/player/' + [region.toLowerCase(), realm, name].map(encodeURIComponent).join('/');
}
