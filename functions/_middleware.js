const API_ORIGIN = 'https://api.rbgs.io';

export async function onRequest({ request, next }) {
  const url = new URL(request.url);
  if (!/^\/(api|oauth2|login)\//.test(url.pathname)) return next();

  const upstream = new URL(url.pathname + url.search, API_ORIGIN);
  const headers = new Headers(request.headers);
  headers.delete('host');

  return fetch(new Request(upstream, {
    method: request.method,
    headers,
    body: request.body,
    redirect: 'manual',
  }));
}
