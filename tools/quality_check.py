"""Static quality check of everything the site ships.

Usage: python tools/quality_check.py [content-dir] [web-public-dir]

Checks, for every module that ships:
  - media: every video, slide and document a step references is mapped (and so uploaded)
  - handovers: every "Coaching" step leads to a module that ships
  - text: replacement characters (broken encoding), "x" placeholders, unresolved "#variables"
For the site:
  - internal links in the Ratgeber articles resolve to a page that exists
  - every shipped package and topic has its photo, every expert a portrait
"""
import glob
import json
import os
import re
import sys
from collections import defaultdict

CONTENT = sys.argv[1] if len(sys.argv) > 1 else 'content'
PUBLIC = sys.argv[2] if len(sys.argv) > 2 else 'apps/web/public'


def load(p):
    return json.load(open(p, encoding='utf-8'))


media = load(f'{CONTENT}/media.json')
shipped = {c['key'] for c in load(f'{PUBLIC}/content/index.json')}
launch = load(f'{PUBLIC}/content/site/launch.json')
model_map = load(f'{PUBLIC}/content/site/model-map.json')
products = {p['slug']: p for p in load(f'{PUBLIC}/content/site/products.json')}
groups = load(f'{PUBLIC}/content/site/groups.json')
experts = load(f'{PUBLIC}/content/site/experts.json')

problems = defaultdict(list)

# ---- modules ---------------------------------------------------------------------------------------------
for key in sorted(shipped):
    c = load(f'{CONTENT}/coachings/{key}.json')
    for nid, n in c['nodes'].items():
        props = n.get('props', {})
        v = (props.get('video') or {}).get('url')
        if v and v not in media:
            problems['video not mapped'].append(f'{key}/{nid}: {v}')
        for e in props.get('events') or []:
            if e.get('type') == 'slide' and e.get('url') and e['url'] not in media:
                problems['slide not mapped'].append(f'{key}/{nid}: {e["url"]}')
        for d in props.get('documents') or []:
            if d.get('file') and d['file'] not in media:
                problems['document not mapped'].append(f'{key}/{nid}: {d["file"]}')
        for el in props.get('elements') or []:
            f = el.get('element') if isinstance(el, dict) else None
            if f and re.search(r'\.(png|jpe?g|gif)$', str(f), re.I) and f not in media:
                problems['image not mapped'].append(f'{key}/{nid}: {f}')
        if n['type'] == 'Coaching':
            target = model_map.get(props.get('key'), props.get('key'))
            if target and target not in shipped and target.lower() not in {s.lower() for s in shipped}:
                problems['handover to a module that does not ship'].append(f'{key}/{nid} -> {target}')
        text = ' '.join([n.get('title') or '', n.get('text') or ''])
        if '�' in text:
            problems['broken characters'].append(f'{key}/{nid}')
        if re.fullmatch(r'\s*x\s*', n.get('title') or '') or re.fullmatch(r'\s*x\s*', n.get('text') or ''):
            problems['placeholder text'].append(f'{key}/{nid}')

# ---- Ratgeber links ---------------------------------------------------------------------------------------
topics = {t['topic'] for t in load(f'{CONTENT}/ratgeber/topics.json')}
articles = {}
for t in topics:
    idx = load(f'{CONTENT}/ratgeber/{t}/index.json')
    articles[t] = {a['slug'] for a in idx['articles']}
group_slugs = {g['slug'] for g in groups}


def route_exists(href):
    href = href.split('#')[0].split('?')[0].rstrip('/')
    if href in ('', '/ratgeber', '/team', '/impressum', '/datenschutz'):
        return True
    m = re.fullmatch(r'/ratgeber/([^/]+)', href)
    if m:
        return m.group(1) in topics
    m = re.fullmatch(r'/ratgeber/([^/]+)/([^/]+)', href)
    if m:
        return m.group(1) in articles and m.group(2) in articles[m.group(1)]
    m = re.fullmatch(r'/themen/([^/]+)', href)
    if m:
        return m.group(1) in group_slugs
    m = re.fullmatch(r'/paket/([^/]+)', href)
    if m:
        return m.group(1) in products and m.group(1) in launch['products']
    m = re.fullmatch(r'/coaching/([^/]+)', href)
    if m:
        return m.group(1) in shipped
    return False


def hrefs(o):
    if isinstance(o, dict):
        if isinstance(o.get('href'), str):
            yield o['href']
        for v in o.values():
            yield from hrefs(v)
    elif isinstance(o, list):
        for v in o:
            yield from hrefs(v)


link_count = 0
for f in glob.glob(f'{CONTENT}/ratgeber/**/*.json', recursive=True):
    for h in hrefs(load(f)):
        if h.startswith('/'):
            link_count += 1
            if not route_exists(h):
                problems['broken internal link in the Ratgeber'].append(f'{os.path.relpath(f, CONTENT)}: {h}')
        elif not re.match(r'(https?:|mailto:)', h):
            problems['odd link in the Ratgeber'].append(f'{os.path.relpath(f, CONTENT)}: {h}')

# ---- pictures --------------------------------------------------------------------------------------------
for slug in launch['products']:
    if not os.path.exists(f'{PUBLIC}/img/products/{slug}.jpg'):
        problems['package without its own photo'].append(slug)
for g in groups:
    if not os.path.exists(f'{PUBLIC}/img/{g["slug"]}.jpg'):
        problems['topic without photo'].append(g['slug'])
for e in experts:
    name = re.sub(r'[^a-z\s]', '', e['name'].lower().replace('ä', 'a').replace('ö', 'o').replace('ü', 'u')).strip()
    path = f'{PUBLIC}/img/experts/{re.sub(r"\s+", "_", name)}.jpg'
    if not os.path.exists(path):
        problems['expert without portrait'].append(e['name'])

print(f'{len(shipped)} modules, {len(products)} packages, {link_count} internal Ratgeber links checked')
if not problems:
    print('no problems')
for kind, items in problems.items():
    print(f'\n{kind}: {len(items)}')
    for i in items[:25]:
        print('  ', i)
    if len(items) > 25:
        print(f'   ... and {len(items) - 25} more')
