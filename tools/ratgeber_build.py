"""Build the new Ratgeber articles from Markdown into the JSON the site reads.

Usage: python tools/ratgeber_build.py <topic> [--cutover]

Sources live in content/ratgeber-src/<topic>/<slug>.md (not shipped to the site):

    ---
    title: Liebeskummer überwinden
    heading: Liebeskummer überwinden: Was wirklich hilft      (optional, defaults to the title)
    description: One or two sentences for search results and link previews.
    group: Krise und Trennung                                  (sub-category on the topic page)
    package: liebeskummer                                      (slug of the matching package)
    reviewed: 2026-10
    related: trennung, ex-zurueck                              (slugs of other new articles)
    summary:
    - the key points, shown in a box at the top
    - ...
    ---
    Body in Markdown: paragraphs, "## " and "### " headings, "- " and "1. " lists,
    **bold**, *italic*, [text](/internal/link).

Without --cutover the articles are written and added to the topic index; the old articles stay.
With --cutover every old article of the topic that is not a new one is removed, the topic index is rebuilt from
the new articles and the redirects (old URL -> new article) are written to apps/web/public/_redirects. The old
URL -> new article mapping is read from content/ratgeber-src/<topic>/_mapping.csv.
"""
import csv
import glob
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONTENT = os.path.join(ROOT, 'content', 'ratgeber')
SRC = os.path.join(ROOT, 'content', 'ratgeber-src')
REDIRECTS = os.path.join(ROOT, 'apps', 'web', 'public', '_redirects')


def inline(text):
    """**bold**, *italic* and [text](href) to the site's inline segments."""
    segs = []
    pos = 0
    pat = re.compile(r'\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*')
    for m in pat.finditer(text):
        if m.start() > pos:
            segs.append({'t': text[pos:m.start()]})
        if m.group(1):
            segs.append({'t': m.group(1), 'href': m.group(2)})
        elif m.group(3):
            segs.append({'t': m.group(3), 'b': True})
        else:
            segs.append({'t': m.group(4), 'i': True})
        pos = m.end()
    if pos < len(text):
        segs.append({'t': text[pos:]})
    return segs


def parse(path):
    raw = open(path, encoding='utf-8').read().replace('\r\n', '\n')
    m = re.match(r'---\n(.*?)\n---\n(.*)', raw, re.S)
    if not m:
        raise SystemExit(f'{path}: front matter missing')
    meta = {'summary': []}
    key = None
    for line in m.group(1).split('\n'):
        if line.startswith('- ') and key == 'summary':
            meta['summary'].append(line[2:].strip())
        elif ':' in line:
            key, value = line.split(':', 1)
            key = key.strip()
            if key != 'summary':
                meta[key] = value.strip()
    blocks = []
    para = []
    items = None

    def flush():
        nonlocal para, items
        if para:
            blocks.append({'t': 'p', 'inline': inline(' '.join(para))})
            para = []
        if items:
            blocks.append({'t': items[0], 'items': [inline(i) for i in items[1:]]})
            items = None

    for line in m.group(2).split('\n'):
        s = line.rstrip()
        if not s.strip():
            flush()
        elif s.startswith('## ') or s.startswith('### '):
            flush()
            level = 2 if s.startswith('## ') else 3
            blocks.append({'t': 'h', 'level': level, 'text': s[level + 1:].strip()})
        elif s.startswith('- ') or re.match(r'\d+\. ', s):
            kind = 'ul' if s.startswith('- ') else 'ol'
            text = s[2:] if kind == 'ul' else re.sub(r'^\d+\. ', '', s)
            if para:
                flush()
            if items and items[0] != kind:
                flush()
            if not items:
                items = [kind]
            items.append(text.strip())
        else:
            if items:
                flush()
            para.append(s.strip())
    flush()
    slug = os.path.basename(path)[:-3]
    return slug, meta, blocks


def words(blocks):
    n = 0
    for b in blocks:
        if b['t'] == 'h':
            n += len(b['text'].split())
        elif b['t'] == 'p':
            n += len(''.join(s['t'] for s in b['inline']).split())
        else:
            n += sum(len(''.join(s['t'] for s in it).split()) for it in b['items'])
    return n


def main():
    topic = sys.argv[1]
    cutover = '--cutover' in sys.argv
    files = sorted(f for f in glob.glob(os.path.join(SRC, topic, '*.md')) if not os.path.basename(f).startswith('_'))
    index_path = os.path.join(CONTENT, topic, 'index.json')
    index = json.load(open(index_path, encoding='utf-8'))
    new = {}
    for f in files:
        slug, meta, blocks = parse(f)
        article = {
            'topic': topic,
            'slug': slug,
            'title': meta['title'],
            'heading': meta.get('heading', meta['title']),
            'description': meta['description'],
            'summary': meta['summary'],
            'group': meta.get('group', ''),
            'package': meta.get('package', ''),
            'reviewed': meta.get('reviewed', ''),
            'related': [s.strip() for s in meta.get('related', '').split(',') if s.strip()],
            'blocks': blocks,
        }
        json.dump(article, open(os.path.join(CONTENT, topic, slug + '.json'), 'w', encoding='utf-8'), ensure_ascii=False)
        new[slug] = article
        print(f'{slug}: {words(blocks)} words')

    # references like „Liebeskummer überwinden“ in the text become links to the article of that name
    names = {}
    for slug, a in new.items():
        for n in {a['title'], a['heading'], a['heading'].split(':')[0], a['title'].split(':')[0]}:
            names.setdefault(n.strip().lower(), slug)

    def autolink(segs, own):
        out = []
        for seg in segs:
            if seg.get('href') or seg.get('b') or seg.get('i') or '„' not in seg['t']:
                out.append(seg)
                continue
            parts = re.split(r'(„[^“]+“)', seg['t'])
            for part in parts:
                m = re.fullmatch(r'„([^“]+)“', part)
                target = None
                if m:
                    q = m.group(1).strip().lower()
                    target = names.get(q) or names.get(q.split(':')[0].strip())
                if m and target and target != own:
                    out.append({'t': part, 'href': f'/ratgeber/{topic}/{target}'})
                elif part:
                    out.append({'t': part})
        return out

    for slug, a in new.items():
        for b in a['blocks']:
            if b['t'] == 'p':
                b['inline'] = autolink(b['inline'], slug)
            elif b['t'] in ('ul', 'ol'):
                b['items'] = [autolink(it, slug) for it in b['items']]
        json.dump(a, open(os.path.join(CONTENT, topic, slug + '.json'), 'w', encoding='utf-8'), ensure_ascii=False)

    entries = {a['slug']: a for a in index['articles']}
    for slug, a in new.items():
        entries[slug] = {'slug': slug, 'title': a['title'], 'summary': a['description']}

    if cutover:
        keep = set(new)
        for old in list(entries):
            if old not in keep:
                p = os.path.join(CONTENT, topic, old + '.json')
                if os.path.exists(p):
                    os.remove(p)
                del entries[old]
        # sub-categories from the new articles, in the order of first appearance
        groups = []
        for slug, a in new.items():
            g = next((x for x in groups if x['title'] == a['group']), None)
            if not g:
                g = {'id': re.sub(r'[^a-z0-9]+', '-', a['group'].lower().replace('ü', 'ue').replace('ö', 'oe').replace('ä', 'ae')).strip('-'), 'title': a['group'], 'slugs': []}
                groups.append(g)
            g['slugs'].append(slug)
        links = json.load(open(os.path.join(SRC, topic, '_groups.json'), encoding='utf-8'))
        for g in groups:
            g['link'] = links[g['title']]
        order_of = {t: i for i, t in enumerate(links)}
        groups.sort(key=lambda g: order_of[g['title']])
        index['groups'] = groups
        intro = os.path.join(SRC, topic, '_intro.md')
        if os.path.exists(intro):
            _, imeta, iblocks = parse(intro)
            index['heading'] = imeta.get('heading', index['heading'])
            index['intro'] = iblocks
        mapping = os.path.join(SRC, topic, '_mapping.csv')
        lines = []
        if os.path.exists(mapping):
            for row in csv.DictReader(open(mapping, encoding='utf-8-sig'), delimiter=';'):
                target = row['neuer_artikel']
                if row['alter_slug'] != target and target in new:
                    lines.append(f"/ratgeber/{topic}/{row['alter_slug']} /ratgeber/{topic}/{target} 301")
        # links in the other topics' articles that pointed at a removed article now point at its replacement
        moved = {f"/ratgeber/{topic}/{row['alter_slug']}": f"/ratgeber/{topic}/{row['neuer_artikel']}"
                 for row in csv.DictReader(open(mapping, encoding='utf-8-sig'), delimiter=';')
                 if row['neuer_artikel'] in new} if os.path.exists(mapping) else {}

        def relink(o):
            if isinstance(o, dict):
                if o.get('href') in moved:
                    o['href'] = moved[o['href']]
                for v in o.values():
                    relink(v)
            elif isinstance(o, list):
                for v in o:
                    relink(v)

        for f in glob.glob(os.path.join(CONTENT, '*', '*.json')):
            if os.sep + topic + os.sep in f:
                continue
            d = json.load(open(f, encoding='utf-8'))
            before = json.dumps(d, ensure_ascii=False)
            relink(d)
            if json.dumps(d, ensure_ascii=False) != before:
                json.dump(d, open(f, 'w', encoding='utf-8'), ensure_ascii=False)
        existing = open(REDIRECTS, encoding='utf-8').read().splitlines() if os.path.exists(REDIRECTS) else []
        keep_lines = [l for l in existing if l and not l.startswith(f'/ratgeber/{topic}/')]
        open(REDIRECTS, 'w', encoding='utf-8', newline='\n').write('\n'.join(keep_lines + lines) + '\n')
        print(f'cutover: {len(entries)} articles remain, {len(lines)} redirects')
    order = {s: i for i, s in enumerate(new)}
    index['articles'] = sorted(entries.values(), key=lambda e: (order.get(e['slug'], 10**6), e['title'])) if cutover else list(entries.values())
    json.dump(index, open(index_path, 'w', encoding='utf-8'), ensure_ascii=False)

    topics_path = os.path.join(CONTENT, 'topics.json')
    topics = json.load(open(topics_path, encoding='utf-8'))
    for t in topics:
        if t['topic'] == topic:
            t['count'] = len(index['articles'])
    json.dump(topics, open(topics_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)


if __name__ == '__main__':
    main()
