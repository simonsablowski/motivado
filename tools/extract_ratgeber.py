"""
Extract the "Ratgeber" article pages of the legacy site into structured JSON.

    python tools/extract_ratgeber.py path/to/motivado_revival.sql content/ratgeber

Output:
    <out>/<topic>/index.json   topic title, intro blocks, list of articles
    <out>/<topic>/<slug>.json  one article

The legacy HTML is reduced to a small block model (headings, paragraphs, lists)
with inline text segments; scripts, styles, layout markup and external links
are dropped. Internal links are rewritten to the new routes and kept only when
the target exists.
"""
import html
import json
import os
import re
import sys
from html.parser import HTMLParser

sys.path.insert(0, os.path.dirname(__file__))
from parse_dump import parse_inserts  # noqa: E402

TOPICS = {
    'beziehung': 'Beziehung',
    'bewerbung': 'Bewerbung',
    'abnehmen': 'Abnehmen',
    'erziehung': 'Erziehung',
    'schlafen': 'Schlafen',
}
SITE_GROUPS = ('beziehung', 'gesundheit', 'karriere', 'erziehung')


class Blocks(HTMLParser):
    """HTML -> blocks. Inline segments are {"t": text, "b"?, "i"?, "href"?}."""

    def __init__(self, link_target):
        super().__init__(convert_charrefs=True)
        self.link_target = link_target
        self.blocks = []
        self.inline = []
        self.bold = 0
        self.italic = 0
        self.href = None
        self.skip = 0
        self.list = None  # ('ul'|'ol', items)
        self.kind = 'p'  # current text block kind: p | h1 | h2 | h3 | li

    # ---- helpers -------------------------------------------------------------------------
    def flush(self):
        segs = self._tidy(self.inline)
        self.inline = []
        if not segs:
            return
        if self.kind == 'li' and self.list is not None:
            self.list[1].append(segs)
        elif self.kind in ('h1', 'h2', 'h3'):
            self.blocks.append({'t': 'h', 'level': int(self.kind[1]), 'text': ''.join(s['t'] for s in segs).strip()})
        else:
            self.blocks.append({'t': 'p', 'inline': segs})

    @staticmethod
    def _tidy(segs):
        out = []
        for s in segs:
            text = re.sub(r'[ \t\r\n\xa0]+', ' ', s['t'])
            if not text:
                continue
            seg = dict(s, t=text)
            if out and all(out[-1].get(k) == seg.get(k) for k in ('b', 'i', 'href')):
                out[-1]['t'] += seg['t']
            else:
                out.append(seg)
        if out:
            out[0]['t'] = out[0]['t'].lstrip()
            out[-1]['t'] = out[-1]['t'].rstrip()
            out = [s for s in out if s['t']]
        return out if ''.join(s['t'] for s in out).strip() else []

    def _end_list(self):
        if self.list and self.list[1]:
            self.blocks.append({'t': self.list[0], 'items': self.list[1]})
        self.list = None

    # ---- events --------------------------------------------------------------------------
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in ('script', 'style', 'iframe', 'noscript'):
            self.skip += 1
        if self.skip:
            return
        if tag in ('h1', 'h2', 'h3', 'h4'):
            self.flush()
            self.kind = 'h3' if tag == 'h4' else tag
        elif tag in ('p', 'div', 'blockquote'):
            self.flush()
            self.kind = 'li' if self.list is not None else 'p'
        elif tag == 'br':
            # two <br> in a row separate paragraphs; a single one is a space
            if self.inline and self.inline[-1].get('br'):
                self.inline.pop()
                self.flush()
            else:
                self.inline.append({'t': ' ', 'br': True})
        elif tag in ('ul', 'ol'):
            self.flush()
            self._end_list()
            self.list = (tag, [])
            self.kind = 'p'
        elif tag == 'li':
            self.flush()
            self.kind = 'li'
        elif tag in ('strong', 'b'):
            self.bold += 1
        elif tag in ('em', 'i'):
            self.italic += 1
        elif tag == 'a':
            self.href = self.link_target(a.get('href', ''))

    def handle_endtag(self, tag):
        if tag in ('script', 'style', 'iframe', 'noscript'):
            self.skip = max(0, self.skip - 1)
            return
        if self.skip:
            return
        if tag in ('h1', 'h2', 'h3', 'h4', 'p', 'div', 'blockquote', 'li'):
            self.flush()
            self.kind = 'li' if (self.list is not None and tag != 'li') else 'p'
        elif tag in ('ul', 'ol'):
            self.flush()
            self._end_list()
            self.kind = 'p'
        elif tag in ('strong', 'b'):
            self.bold = max(0, self.bold - 1)
        elif tag in ('em', 'i'):
            self.italic = max(0, self.italic - 1)
        elif tag == 'a':
            self.href = None

    def handle_data(self, data):
        if self.skip or not data.strip() and not self.inline:
            return
        seg = {'t': data}
        if self.bold:
            seg['b'] = True
        if self.italic:
            seg['i'] = True
        if self.href:
            seg['href'] = self.href
        self.inline.append(seg)

    def result(self):
        self.flush()
        self._end_list()
        return self.blocks


def main(dump_path, out_dir):
    _, t = parse_inserts(dump_path, ['page'])
    pages = {}
    for p in t['page']:
        key = p['urlkey'].strip('/')
        m = re.fullmatch(r'ratgeber-([a-z]+)(?:/([a-z0-9-]+))?', key)
        if m and m.group(1) in TOPICS:
            pages[(m.group(1), m.group(2))] = p

    known = {k for k in pages if k[1]}

    def target(href):
        h = html.unescape(href or '').strip().strip('“”"\'')
        h = re.sub(r'^https?://(www\.)?motivado\.(de|com)', '', h)
        h = re.sub(r'^(\.\./)+', '/', h).split('#')[0].split('?')[0].strip()
        if not h.startswith('/'):
            return None
        parts = [x for x in h.strip('/').split('/') if x]
        if parts and parts[0].startswith('ratgeber-'):
            topic = parts[0][len('ratgeber-'):]
            if topic not in TOPICS:
                return None
            if len(parts) == 1:
                return f'/ratgeber/{topic}'
            slug = parts[1].strip()
            return f'/ratgeber/{topic}/{slug}' if (topic, slug) in known else None
        if parts and parts[0] in SITE_GROUPS:
            return f'/themen/{parts[0]}'
        return None

    os.makedirs(out_dir, exist_ok=True)
    total = 0
    for topic, title in TOPICS.items():
        tdir = os.path.join(out_dir, topic)
        os.makedirs(tdir, exist_ok=True)
        articles = []
        for (tp, slug), p in sorted(pages.items(), key=lambda kv: kv[0][1] or ''):
            if tp != topic or slug is None:
                continue
            parser = Blocks(target)
            parser.feed(p['content'] or '')
            blocks = parser.result()
            # the first h1 is the page title
            heading = p['title']
            if blocks and blocks[0].get('t') == 'h' and blocks[0]['level'] == 1:
                heading = blocks[0]['text'] or heading
                blocks = blocks[1:]
            first = next((''.join(s['t'] for s in b['inline']) for b in blocks if b['t'] == 'p'), '')
            summary = (p['metadescription'] or first)[:200].strip()
            art = {
                'topic': topic,
                'slug': slug,
                'title': p['title'],
                'heading': heading,
                'description': summary,
                'blocks': blocks,
            }
            with open(os.path.join(tdir, slug + '.json'), 'w', encoding='utf-8', newline='\n') as f:
                json.dump(art, f, ensure_ascii=False, separators=(',', ':'))
            articles.append({'slug': slug, 'title': p['title'], 'summary': summary})
            total += 1

        root = pages.get((topic, None))
        intro = []
        heading = title
        if root:
            parser = Blocks(target)
            parser.feed(root['content'] or '')
            intro = parser.result()
            if intro and intro[0].get('t') == 'h' and intro[0]['level'] == 1:
                heading = intro[0]['text'] or heading
                intro = intro[1:]
        articles.sort(key=lambda a: a['title'].lower())
        with open(os.path.join(tdir, 'index.json'), 'w', encoding='utf-8', newline='\n') as f:
            json.dump({'topic': topic, 'title': title, 'heading': heading, 'intro': intro, 'articles': articles},
                      f, ensure_ascii=False, separators=(',', ':'))
        print(f'{topic}: {len(articles)} articles')
    summary = []
    for topic, title in TOPICS.items():
        idx = json.load(open(os.path.join(out_dir, topic, 'index.json'), encoding='utf-8'))
        summary.append({'topic': topic, 'title': title, 'heading': idx['heading'], 'count': len(idx['articles'])})
    with open(os.path.join(out_dir, 'topics.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)
        f.write('\n')
    print('total', total)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
