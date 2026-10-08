import { readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { render } from '../dist/server/prerender.js';

const titles = JSON.parse(await readFile(new URL('../src/page-titles.json', import.meta.url), 'utf8'));
const descriptions = JSON.parse(await readFile(new URL('../src/page-descriptions.json', import.meta.url), 'utf8'));
const internalRoutes = JSON.parse(await readFile(new URL('../src/internal-routes.json', import.meta.url), 'utf8'));
const template = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
const escapeHtml = (value) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const languages = ['en', 'es', 'fr'];
const languageLocales = { en: 'en_US', es: 'es_ES', fr: 'fr_FR' };
const pathLanguage = path => path.match(/^\/(es|fr)(?:\/|$)/)?.[1] ?? 'en';
const basePath = path => path.replace(/^\/(es|fr)(?=\/|$)/, '') || '/';
const localizedPath = (path, language) => language === 'en' ? path : path === '/' ? `/${language}/` : `/${language}${path}`;
const websiteData = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': 'https://rbgs.io/#website',
  name: 'rbgs.io',
  url: 'https://rbgs.io/',
  inLanguage: languages,
});
for (const language of languages.filter(code => code !== 'en')) {
  await mkdir(new URL(`../dist/${language}/`, import.meta.url), { recursive: true });
}

for (const [path, title] of Object.entries(titles)) {
  const escapedTitle = escapeHtml(title);
  const escapedDescription = escapeHtml(descriptions[path]);
  const canonicalUrl = escapeHtml(new URL(path, 'https://rbgs.io').href);
  const language = pathLanguage(path);
  const englishPath = basePath(path);
  const structuredData = englishPath === '/' ? `    <script type="application/ld+json">${websiteData}</script>\n` : '';
  const heroPreload = englishPath === '/' ? '    <link rel="preload" href="/hero-banner.webp" as="image" type="image/webp" fetchpriority="high" />\n' : '';
  const alternates = [...languages.map(code => [code, localizedPath(englishPath, code)]), ['x-default', englishPath]]
    .map(([language, alternatePath]) => `    <link rel="alternate" hreflang="${language}" href="${escapeHtml(new URL(alternatePath, 'https://rbgs.io').href)}" />`).join('\n');
  const html = template
    .replace('<html lang="en">', `<html lang="${language}">`)
    .replace('property="og:locale" content="en_US"', `property="og:locale" content="${languageLocales[language]}"`)
    .replace('</head>', () => `  <link rel="canonical" href="${canonicalUrl}" />\n    <meta property="og:url" content="${canonicalUrl}" />\n${alternates}\n${heroPreload}${structuredData}  </head>`)
    .replace('<div id="root"></div>', () => `<div id="root" data-prerender-path="${escapeHtml(path)}">${render(path)}</div>`)
    .replace(/<title>[^<]*<\/title>/, `<title>${escapedTitle}</title>`)
    .replace(/(<meta property="og:title" content=")[^"]*("\s*\/>)/, `$1${escapedTitle}$2`)
    .replace(/(<meta name="twitter:title" content=")[^"]*("\s*\/>)/, (_, start, end) => `${start}${escapedTitle}${end}`)
    .replace(/(<meta name="description" content=")[^"]*("\s*\/>)/, (_, start, end) => `${start}${escapedDescription}${end}`)
    .replace(/(<meta property="og:description" content=")[^"]*("\s*\/>)/, (_, start, end) => `${start}${escapedDescription}${end}`)
    .replace(/(<meta name="twitter:description" content=")[^"]*("\s*\/>)/, (_, start, end) => `${start}${escapedDescription}${end}`);
  const output = path.endsWith('/') ? `../dist${path}index.html` : `../dist${path}.html`;
  await writeFile(new URL(output, import.meta.url), html);
}

// Valid app routes need their own entry points once 404.html disables SPA fallback.
for (const language of languages) {
  const prefix = language === 'en' ? '' : `/${language}`;
  for (const route of internalRoutes) {
    const path = prefix + route;
    const html = template
      .replace('<html lang="en">', `<html lang="${language}">`)
      .replace('property="og:locale" content="en_US"', `property="og:locale" content="${languageLocales[language]}"`)
      .replace('content="index, follow"', 'content="noindex, follow"')
      .replace('<div id="root"></div>', () => `<div id="root" data-prerender-path="${path}">${render(path)}</div>`);
    await writeFile(new URL(`../dist${path}.html`, import.meta.url), html);
  }
  const errorHeading = { en: 'Page not found', es: 'Página no encontrada', fr: 'Page introuvable' }[language];
  const errorTitle = `${errorHeading} | rbgs.io`;
  const errorDescription = `${errorHeading}.`;
  const html = template
    .replace('<html lang="en">', `<html lang="${language}">`)
    .replace('content="index, follow"', 'content="noindex, follow"')
    .replace(/<title>[^<]*<\/title>/, `<title>${errorTitle}</title>`)
    .replace(/(<meta (?:property="og:title"|name="twitter:title") content=")[^"]*("\s*\/>)/g, (_, start, end) => `${start}${errorTitle}${end}`)
    .replace(/(<meta (?:name="description"|property="og:description"|name="twitter:description") content=")[^"]*("\s*\/>)/g, (_, start, end) => `${start}${errorDescription}${end}`)
    .replace('property="og:locale" content="en_US"', `property="og:locale" content="${languageLocales[language]}"`)
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
