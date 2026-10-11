// Post-build step: writes a static HTML file for every public route with the
// right <title>, description, canonical URL and Open Graph tags (and the article
// text for Ratgeber pages), plus sitemap.xml and robots.txt.
//
// The app is a single page app; these files are what crawlers and link
// previews see before (or without) JavaScript. The app itself still takes
// over in the browser.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dist = resolve(here, '../dist');
const BASE = 'https://motivado.com';
const SITE = 'Motivado';

const read = (p) => JSON.parse(readFileSync(join(dist, 'content', p), 'utf8'));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const short = (s, n = 160) => {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 3).trimEnd()}…` : t;
};
const fullTitle = (t) => (t === SITE || t.startsWith(`${SITE} –`) ? t : `${t} – ${SITE}`);

const template = readFileSync(join(dist, 'index.html'), 'utf8');

function render({ path, title, description, body = '' }) {
  const t = esc(fullTitle(title));
  const d = esc(short(description));
  const url = BASE + path;
  let html = template
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${t}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/, `$1${d}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${t}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${d}$2`)
    .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${esc(url)}$2`)
    .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${esc(url)}$2`);
  if (body) html = html.replace('<div id="root"></div>', `<div id="root">${body}</div>`);
  return html;
}

function write(path, html) {
  const file = path === '/' ? join(dist, 'index.html') : join(dist, path.replace(/^\//, ''), 'index.html');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
}

// ---- data ------------------------------------------------------------------------------------
const groups = read('site/groups.json');
const categories = read('site/categories.json');
const products = read('site/products.json');
const coachingMeta = read('site/coachings.json');
const launchConfig = read('site/launch.json');
const modelMap = read('site/model-map.json');
const index = read('index.json');
const available = new Set(index.map((c) => c.key));
const launched = products.filter((p) => launchConfig.products.includes(p.slug));
const firstLine = (s) => String(s ?? '').split('\n')[0];

const routes = [];
const add = (r) => routes.push(r);

add({
  path: '/',
  title: 'Motivado – Coaching per Video',
  description:
    'Interaktives Video-Coaching mit Experten zu Beziehung, Gesundheit, Karriere und Erziehung: individuell, in Ihrem Tempo, wann und wo Sie möchten.',
});

for (const g of groups) {
  if (!launched.some((p) => p.category.startsWith(g.slug))) continue;
  const c = categories.find((x) => x.path === g.slug);
  add({
    path: `/themen/${g.slug}`,
    title: `${g.title}: Module`,
    description: firstLine(c?.description) || `Interaktives Video-Coaching zum Thema ${g.title}.`,
  });
}

for (const p of launched) {
  add({ path: `/paket/${p.slug}`, title: p.title, description: firstLine(p.description) || p.subtitle });
}

const aliasOf = Object.fromEntries(Object.entries(modelMap).filter(([k]) => !k.startsWith('_')).map(([k, v]) => [v, k]));
for (const key of available) {
  const meta = coachingMeta[key] ?? coachingMeta[aliasOf[key]];
  const title = meta?.title || key.replace(/^[a-z0-9]+-/, '').replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());
  add({ path: `/coaching/${key}`, title, description: meta?.subtitle || firstLine(meta?.description) || `Video-Coaching: ${title}` });
}

add({ path: '/team', title: 'Unsere Experten', description: 'Coaches, Psychologen und Berater mit Praxiserfahrung: die Menschen vor der Kamera.' });
add({ path: '/impressum', title: 'Impressum', description: 'Impressum von Motivado.' });
add({ path: '/datenschutz', title: 'Datenschutz', description: 'Datenschutzhinweise von Motivado.' });

// ---- ratgeber --------------------------------------------------------------------------------
const textOf = (segs) => segs.map((s) => s.t).join('');
function blocksToHtml(blocks) {
  return blocks
    .map((b) => {
      if (b.t === 'h') return `<h${b.level <= 2 ? 2 : 3}>${esc(b.text)}</h${b.level <= 2 ? 2 : 3}>`;
      if (b.t === 'p') return `<p>${esc(textOf(b.inline))}</p>`;
      return `<${b.t}>${b.items.map((it) => `<li>${esc(textOf(it))}</li>`).join('')}</${b.t}>`;
    })
    .join('');
}

if (existsSync(join(dist, 'content', 'ratgeber', 'topics.json'))) {
  const topics = read('ratgeber/topics.json');
  add({
    path: '/ratgeber',
    title: 'Ratgeber',
    description: 'Ratgeber zu Beziehung, Abnehmen, Schlafen, Bewerbung und Erziehung: Wissen, das weiterhilft.',
    body: `<main><h1>Ratgeber</h1><ul>${topics
      .map((t) => `<li><a href="/ratgeber/${t.topic}">${esc(t.title)}</a></li>`)
      .join('')}</ul></main>`,
  });
  for (const t of topics) {
    const idx = read(`ratgeber/${t.topic}/index.json`);
    add({
      path: `/ratgeber/${t.topic}`,
      title: `Ratgeber ${idx.title}`,
      description: `${idx.articles.length} Artikel im Ratgeber ${idx.title}.`,
      body: `<main><h1>${esc(idx.heading)}</h1>${blocksToHtml(idx.intro)}<h2>Alle Artikel</h2><ul>${idx.articles
        .map((a) => `<li><a href="/ratgeber/${t.topic}/${a.slug}">${esc(a.title)}</a></li>`)
        .join('')}</ul></main>`,
    });
    for (const a of idx.articles) {
      const art = read(`ratgeber/${t.topic}/${a.slug}.json`);
      add({
        path: `/ratgeber/${t.topic}/${a.slug}`,
        title: art.title,
        description: art.description,
        body: `<main><h1>${esc(art.heading)}</h1>${blocksToHtml(art.blocks)}</main>`,
      });
    }
  }
}

// ---- write -----------------------------------------------------------------------------------
for (const r of routes) write(r.path, render(r));

const today = new Date().toISOString().slice(0, 10);
const sitemap =
  '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  routes
    .filter((r) => !['/impressum', '/datenschutz'].includes(r.path))
    .map((r) => `  <url><loc>${BASE}${r.path === '/' ? '/' : r.path}</loc><lastmod>${today}</lastmod></url>`)
    .join('\n') +
  '\n</urlset>\n';
writeFileSync(join(dist, 'sitemap.xml'), sitemap);
// the same list under a second name: Search Console cannot resubmit a sitemap whose first fetch failed
writeFileSync(join(dist, 'sitemap-seiten.xml'), sitemap);
writeFileSync(
  join(dist, 'robots.txt'),
  `User-agent: *\nAllow: /\n\nSitemap: ${BASE}/sitemap.xml\nSitemap: ${BASE}/sitemap-seiten.xml\n`,
);

console.log(`prerendered ${routes.length} routes, sitemap + robots written`);
