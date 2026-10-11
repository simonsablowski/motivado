// Copies the content the site needs into public/content so it is served statically.
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const source = resolve(here, '../../../content');
const target = resolve(here, '../public/content');

rmSync(target, { recursive: true, force: true });
mkdirSync(join(target, 'coachings'), { recursive: true });

const site = JSON.parse(readFileSync(join(source, 'site/launch.json'), 'utf8'));
const products = JSON.parse(readFileSync(join(source, 'site/products.json'), 'utf8'));
const alias = JSON.parse(readFileSync(join(source, 'site/model-map.json'), 'utf8'));
const index = JSON.parse(readFileSync(join(source, 'index.json'), 'utf8'));
const available = new Set(readdirSync(join(source, 'coachings')).map((f) => f.replace(/\.json$/, '')));

// Catalogue entries that are still placeholders ("x") are hidden everywhere: not listed, not counted,
// not shipped. A single placeholder field is blanked.
const PLACEHOLDER = /^\s*(x+|\.+|-+|\?+|tbd|todo)\s*$/i;
const isPlaceholder = (v) => PLACEHOLDER.test(String(v ?? ''));
const meta = JSON.parse(readFileSync(join(source, 'site/coachings.json'), 'utf8'));
const hidden = new Set(
  Object.entries(meta)
    .filter(([, m]) => isPlaceholder(m.subtitle) && isPlaceholder(m.description))
    .map(([k]) => k),
);
const hiddenModels = new Set([...hidden].map((k) => alias[k] ?? k));
for (const m of Object.values(meta)) {
  for (const f of ['title', 'subtitle', 'description']) if (isPlaceholder(m[f])) m[f] = '';
}
// Catalogue entries without a model ("In Vorbereitung") will never be completed: hide them as well,
// and drop packages that would be left empty.
const unfinished = new Set();
const visibleProducts = products.map((p) => ({
  ...p,
  coachings: p.coachings.filter((k) => {
    if (hidden.has(k)) return false;
    if (available.has(alias[k] ?? k)) return true;
    unfinished.add(k);
    return false;
  }),
}));
const emptyPackages = new Set(visibleProducts.filter((p) => p.coachings.length === 0).map((p) => p.slug));
site.products = site.products.filter((slug) => !emptyPackages.has(slug));

// Only the coachings of the launch products are shipped.
const keys = new Set();
for (const slug of site.products) {
  const p = visibleProducts.find((x) => x.slug === slug);
  for (const k of p?.coachings ?? []) {
    const model = alias[k] ?? k;
    if (available.has(model) && !hiddenModels.has(model)) keys.add(model);
  }
}
for (const f of site.featured ?? []) if (available.has(f.coaching)) keys.add(f.coaching);
// Coachings that other shipped coachings hand over to.
for (const k of [...keys]) {
  const c = JSON.parse(readFileSync(join(source, 'coachings', `${k}.json`), 'utf8'));
  for (const n of Object.values(c.nodes)) {
    if (n.type === 'Coaching' && n.props.key && available.has(n.props.key) && !hiddenModels.has(n.props.key)) {
      keys.add(n.props.key);
    }
  }
}

for (const k of keys) cpSync(join(source, 'coachings', `${k}.json`), join(target, 'coachings', `${k}.json`));

mkdirSync(join(target, 'site'), { recursive: true });
for (const f of ['groups', 'categories', 'experts', 'model-map', 'photos']) {
  cpSync(join(source, 'site', `${f}.json`), join(target, 'site', `${f}.json`));
}
writeFileSync(join(target, 'site', 'launch.json'), JSON.stringify(site));
// Numbers for the home page: modules, hours of video material and exercises of what ships.
const media = existsSync(join(source, 'media.json')) ? JSON.parse(readFileSync(join(source, 'media.json'), 'utf8')) : {};
const durationsFile = join(source, 'media-durations.json');
const durations = existsSync(durationsFile) ? JSON.parse(readFileSync(durationsFile, 'utf8')) : {};
const EXERCISE = new Set(['Options', 'TextInput', 'TextArea', 'Dropdown', 'List', 'ListView', 'Evaluation', 'Keywords', 'Group']);
const videos = new Set();
let exercises = 0;
for (const k of keys) {
  const c = JSON.parse(readFileSync(join(source, 'coachings', `${k}.json`), 'utf8'));
  for (const n of Object.values(c.nodes)) {
    const v = n.props?.video?.url;
    if (v && media[v] && durations[v] !== undefined) videos.add(v);
    if (EXERCISE.has(n.type)) exercises += 1;
  }
}
let seconds = 0;
for (const v of videos) seconds += durations[v];
writeFileSync(
  join(target, 'stats.json'),
  JSON.stringify({ modules: keys.size, hours: Math.round(seconds / 3600), exercises }),
);

writeFileSync(join(target, 'site', 'products.json'), JSON.stringify(visibleProducts));
writeFileSync(join(target, 'site', 'coachings.json'), JSON.stringify(meta));
writeFileSync(join(target, 'index.json'), JSON.stringify(index.filter((c) => keys.has(c.key))));
if (existsSync(join(source, 'ratgeber'))) cpSync(join(source, 'ratgeber'), join(target, 'ratgeber'), { recursive: true });
if (existsSync(join(source, 'media.json'))) cpSync(join(source, 'media.json'), join(target, 'media.json'));
else writeFileSync(join(target, 'media.json'), '{}');

console.log(
  `content synced: ${keys.size} coachings, ${hidden.size} placeholder and ${unfinished.size} unfinished entries hidden, ${emptyPackages.size} empty packages dropped`,
);
