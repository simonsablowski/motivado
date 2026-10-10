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

// Only the coachings of the launch products are shipped.
const keys = new Set();
for (const slug of site.products) {
  const p = products.find((x) => x.slug === slug);
  for (const k of p?.coachings ?? []) {
    const model = alias[k] ?? k;
    if (available.has(model)) keys.add(model);
  }
}
for (const f of site.featured ?? []) if (available.has(f.coaching)) keys.add(f.coaching);
// Coachings that other shipped coachings hand over to.
for (const k of [...keys]) {
  const c = JSON.parse(readFileSync(join(source, 'coachings', `${k}.json`), 'utf8'));
  for (const n of Object.values(c.nodes)) {
    if (n.type === 'Coaching' && n.props.key && available.has(n.props.key)) keys.add(n.props.key);
  }
}

for (const k of keys) cpSync(join(source, 'coachings', `${k}.json`), join(target, 'coachings', `${k}.json`));

mkdirSync(join(target, 'site'), { recursive: true });
for (const f of ['groups', 'categories', 'products', 'experts', 'coachings', 'launch', 'model-map']) {
  cpSync(join(source, 'site', `${f}.json`), join(target, 'site', `${f}.json`));
}
writeFileSync(join(target, 'index.json'), JSON.stringify(index.filter((c) => keys.has(c.key))));
if (existsSync(join(source, 'ratgeber'))) cpSync(join(source, 'ratgeber'), join(target, 'ratgeber'), { recursive: true });
if (existsSync(join(source, 'media.json'))) cpSync(join(source, 'media.json'), join(target, 'media.json'));
else writeFileSync(join(target, 'media.json'), '{}');

console.log(`content synced: ${keys.size} coachings`);
