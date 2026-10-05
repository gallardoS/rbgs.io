import { readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { render } from '../dist/server/prerender.js';

const titles = JSON.parse(await readFile(new URL('../src/page-titles.json', import.meta.url), 'utf8'));
const descriptions = JSON.parse(await readFile(new URL('../src/page-descriptions.json', import.meta.url), 'utf8'));
const internalRoutes = JSON.parse(await readFile(new URL('../src/internal-routes.json', import.meta.url), 'utf8'));
const template = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
const escapeHtml = (value) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const websiteData = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': 'https://rbgs.io/#website',
  name: 'rbgs.io',
  url: 'https://rbgs.io/',
  inLanguage: ['en', 'es'],
});
await mkdir(new URL('../dist/es/', import.meta.url), { recursive: true });

for (const [path, title] of Object.entries(titles)) {
  const escapedTitle = escapeHtml(title);
  const escapedDescription = escapeHtml(descriptions[path]);
  const canonicalUrl = escapeHtml(new URL(path, 'https://rbgs.io').href);
  const spanish = path.startsWith('/es/');
  const englishPath = spanish ? path.slice(3) || '/' : path;
  const spanishPath = englishPath === '/' ? '/es/' : `/es${englishPath}`;
  const structuredData = englishPath === '/' ? `    <script type="application/ld+json">${websiteData}</script>\n` : '';
  const heroPreload = englishPath === '/' ? '    <link rel="preload" href="/hero-banner.webp" as="image" type="image/webp" fetchpriority="high" />\n' : '';
  const alternates = [['en', englishPath], ['es', spanishPath], ['x-default', englishPath]]
    .map(([language, alternatePath]) => `    <link rel="alternate" hreflang="${language}" href="${escapeHtml(new URL(alternatePath, 'https://rbgs.io').href)}" />`).join('\n');
  const html = template
    .replace('<html lang="en">', `<html lang="${spanish ? 'es' : 'en'}">`)
    .replace('property="og:locale" content="en_US"', `property="og:locale" content="${spanish ? 'es_ES' : 'en_US'}"`)
    .replace('</head>', () => `  <link rel="canonical" href="${canonicalUrl}" />\n    <meta property="og:url" content="${canonicalUrl}" />\n${alternates}\n${heroPreload}${structuredData}  </head>`)
    .replace('<div id="root"></div>', () => `<div id="root" data-prerender-path="${escapeHtml(path)}">${render(path)}</div>`)
    .replace(/<title>[^<]*<\/title>/, `<title>${escapedTitle}</title>`)
    .replace(/(<meta property="og:title" content=")[^"]*("\s*\/>)/, `$1${escapedTitle}$2`)
    .replace(/(<meta name="twitter:title" content=")[^"]*("\s*\/>)/, (_, start, end) => `${start}${escapedTitle}${end}`)
    .replace(/(<meta name="description" content=")[^"]*("\s*\/>)/, (_, start, end) => `${start}${escapedDescription}${end}`)
    .replace(/(<meta property="og:description" content=")[^"]*("\s*\/>)/, (_, start, end) => `${start}${escapedDescription}${end}`)
    .replace(/(<meta name="twitter:description" content=")[^"]*("\s*\/>)/, (_, start, end) => `${start}${escapedDescription}${end}`);
  const output = path === '/' ? '../dist/index.html' : path === '/es/' ? '../dist/es/index.html' : `../dist${path}.html`;
  await writeFile(new URL(output, import.meta.url), html);
}

// Valid app routes need their own entry points once 404.html disables SPA fallback.
for (const prefix of ['', '/es']) {
  const spanish = prefix === '/es';
  for (const route of internalRoutes) {
    const path = prefix + route;
    const html = template
      .replace('<html lang="en">', `<html lang="${spanish ? 'es' : 'en'}">`)
      .replace('content="index, follow"', 'content="noindex, follow"')
      .replace('<div id="root"></div>', () => `<div id="root" data-prerender-path="${path}">${render(path)}</div>`);
    await writeFile(new URL(`../dist${path}.html`, import.meta.url), html);
  }
  const errorTitle = spanish ? 'Página no encontrada | rbgs.io' : 'Page not found | rbgs.io';
  const errorDescription = spanish ? 'Página no encontrada.' : 'Page not found.';
  const html = template
    .replace('<html lang="en">', `<html lang="${spanish ? 'es' : 'en'}">`)
    .replace('content="index, follow"', 'content="noindex, follow"')
    .replace(/<title>[^<]*<\/title>/, `<title>${errorTitle}</title>`)
    .replace(/(<meta (?:property="og:title"|name="twitter:title") content=")[^"]*("\s*\/>)/g, (_, start, end) => `${start}${errorTitle}${end}`)
    .replace(/(<meta (?:name="description"|property="og:description"|name="twitter:description") content=")[^"]*("\s*\/>)/g, (_, start, end) => `${start}${errorDescription}${end}`)
    .replace('property="og:locale" content="en_US"', `property="og:locale" content="${spanish ? 'es_ES' : 'en_US'}"`)
    .replace('<div id="root"></div>', () => `<div id="root">${render(`${prefix}/not-found`)}</div>`);
  await writeFile(new URL(`../dist${prefix}/404.html`, import.meta.url), html);
}

// The server bundle is a build-only input; deploy only the static pages.
await rm(new URL('../dist/server/', import.meta.url), { recursive: true, force: true });

const sitemapUrls = Object.keys(titles).map((path) => `  <url><loc>${escapeHtml(new URL(path, 'https://rbgs.io').href)}</loc></url>`);
await writeFile(new URL('../dist/sitemap.xml', import.meta.url), [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...sitemapUrls,
  '</urlset>',
  '',
].join('\n'));
