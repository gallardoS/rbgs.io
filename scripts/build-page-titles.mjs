import { readFile, writeFile, rm } from 'node:fs/promises';
import { render } from '../dist/server/prerender.js';

const titles = JSON.parse(await readFile(new URL('../src/page-titles.json', import.meta.url), 'utf8'));
const descriptions = JSON.parse(await readFile(new URL('../src/page-descriptions.json', import.meta.url), 'utf8'));
const template = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
const escapeHtml = (value) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

for (const [path, title] of Object.entries(titles)) {
  const escapedTitle = escapeHtml(title);
  const escapedDescription = escapeHtml(descriptions[path]);
  const canonicalUrl = escapeHtml(new URL(path, 'https://rbgs.io').href);
  const html = template
    .replace('</head>', () => `  <link rel="canonical" href="${canonicalUrl}" />\n    <meta property="og:url" content="${canonicalUrl}" />\n  </head>`)
    .replace('<div id="root"></div>', () => `<div id="root" data-prerender-path="${escapeHtml(path)}">${render(path)}</div>`)
    .replace(/<title>[^<]*<\/title>/, `<title>${escapedTitle}</title>`)
    .replace(/(<meta property="og:title" content=")[^"]*("\s*\/>)/, `$1${escapedTitle}$2`)
    .replace(/(<meta name="twitter:title" content=")[^"]*("\s*\/>)/, (_, start, end) => `${start}${escapedTitle}${end}`)
    .replace(/(<meta name="description" content=")[^"]*("\s*\/>)/, (_, start, end) => `${start}${escapedDescription}${end}`)
    .replace(/(<meta property="og:description" content=")[^"]*("\s*\/>)/, (_, start, end) => `${start}${escapedDescription}${end}`)
    .replace(/(<meta name="twitter:description" content=")[^"]*("\s*\/>)/, (_, start, end) => `${start}${escapedDescription}${end}`);
  const output = path === '/' ? '../dist/index.html' : `../dist${path}.html`;
  await writeFile(new URL(output, import.meta.url), html);
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
