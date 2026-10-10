"""
Clean the extracted Ratgeber articles (idempotent, run after extract_ratgeber.py):

* spelling: whole-word replacements from tools/ratgeber_typos.json
* links: the legacy articles link almost every keyword to a keyword-variant page.
  Per article only the first MAX_LINKS distinct, non-self targets are kept; in
  the topic introductions no links are kept (the article index lists them all).
* descriptions: shortened at a word boundary instead of mid-word

    python tools/clean_ratgeber.py content/ratgeber
"""
import glob
import json
import os
import re
import sys

MAX_LINKS = 3
LETTER = 'A-Za-zÄÖÜäöüß'


def load_map():
    here = os.path.dirname(os.path.abspath(__file__))
    data = json.load(open(os.path.join(here, 'ratgeber_typos.json'), encoding='utf-8'))
    data.pop('_comment', None)
    keys = sorted(data, key=len, reverse=True)
    pattern = re.compile(r'(?<![%s])(%s)(?![%s])' % (LETTER, '|'.join(re.escape(k) for k in keys), LETTER))
    return pattern, data


PATTERN, FIXES = load_map()
counts = {}


def fix_text(s):
    def repl(m):
        counts[m.group(1)] = counts.get(m.group(1), 0) + 1
        return FIXES[m.group(1)]
    return PATTERN.sub(repl, s)


def shorten(text, limit=160):
    text = re.sub(r'\s+', ' ', text).strip()
    if len(text) <= limit:
        return text
    cut = text[:limit - 1]
    cut = cut[:cut.rfind(' ')] if ' ' in cut else cut
    return cut.rstrip(' ,;:–-') + '…'


def merge(segs):
    out = []
    for s in segs:
        if out and all(out[-1].get(k) == s.get(k) for k in ('b', 'i', 'href')):
            out[-1]['t'] += s['t']
        else:
            out.append(dict(s))
    return out


def thin_links(blocks, self_href, keep):
    """Keep at most `keep` distinct non-self links, in reading order."""
    seen = set()
    kept = 0

    def handle(segs):
        nonlocal kept
        out = []
        for s in segs:
            href = s.get('href')
            if href:
                if href == self_href or href in seen or kept >= keep:
                    s = {k: v for k, v in s.items() if k != 'href'}
                else:
                    seen.add(href)
                    kept += 1
            out.append(s)
        return merge(out)

    for b in blocks:
        if b['t'] == 'p':
            b['inline'] = handle(b['inline'])
        elif b['t'] in ('ul', 'ol'):
            b['items'] = [handle(it) for it in b['items']]


def fix_blocks(blocks):
    for b in blocks:
        if b['t'] == 'h':
            b['text'] = fix_text(b['text'])
        elif b['t'] == 'p':
            for s in b['inline']:
                s['t'] = fix_text(s['t'])
        else:
            for it in b['items']:
                for s in it:
                    s['t'] = fix_text(s['t'])


def plain(blocks):
    for b in blocks:
        if b['t'] == 'p':
            return ''.join(s['t'] for s in b['inline'])
        if b['t'] in ('ul', 'ol') and b['items']:
            return ''.join(s['t'] for s in b['items'][0])
    return ''


def write(path, data):
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))


def main(root):
    links_before = links_after = 0
    articles = topics = 0
    for path in sorted(glob.glob(os.path.join(root, '*', '*.json'))):
        name = os.path.basename(path)
        data = json.load(open(path, encoding='utf-8'))
        topic = os.path.basename(os.path.dirname(path))

        if name == 'index.json':
            fix_blocks(data['intro'])
            data['title'] = fix_text(data['title'])
            data['heading'] = fix_text(data['heading'])
            links_before += sum(1 for b in data['intro'] if b['t'] == 'p' for s in b['inline'] if s.get('href'))
            thin_links(data['intro'], None, 0)
            for a in data['articles']:
                a['title'] = fix_text(a['title'])
                a['summary'] = shorten(fix_text(a['summary']))
            data['articles'].sort(key=lambda a: a['title'].lower())
            topics += 1
        else:
            fix_blocks(data['blocks'])
            data['title'] = fix_text(data['title'])
            data['heading'] = fix_text(data['heading'])
            for b in data['blocks']:
                if b['t'] == 'p':
                    links_before += sum(1 for s in b['inline'] if s.get('href'))
                elif b['t'] in ('ul', 'ol'):
                    links_before += sum(1 for it in b['items'] for s in it if s.get('href'))
            thin_links(data['blocks'], f"/ratgeber/{topic}/{data['slug']}", MAX_LINKS)
            data['description'] = shorten(plain(data['blocks'])) or shorten(fix_text(data['description']))
            articles += 1
        write(path, data)

    # keep the article list in the index in sync with the cleaned articles
    for path in glob.glob(os.path.join(root, '*', 'index.json')):
        idx = json.load(open(path, encoding='utf-8'))
        folder = os.path.dirname(path)
        for a in idx['articles']:
            art = json.load(open(os.path.join(folder, a['slug'] + '.json'), encoding='utf-8'))
            a['title'] = art['title']
            a['summary'] = art['description']
        idx['articles'].sort(key=lambda a: a['title'].lower())
        write(path, idx)
        links_after += 0

    topics_path = os.path.join(root, 'topics.json')
    if os.path.exists(topics_path):
        t = json.load(open(topics_path, encoding='utf-8'))
        for item in t:
            idx = json.load(open(os.path.join(root, item['topic'], 'index.json'), encoding='utf-8'))
            item['heading'] = idx['heading']
        with open(topics_path, 'w', encoding='utf-8', newline='\n') as f:
            json.dump(t, f, ensure_ascii=False, indent=2)
            f.write('\n')

    total = 0
    for path in glob.glob(os.path.join(root, '*', '*.json')):
        d = json.load(open(path, encoding='utf-8'))
        blocks = d.get('blocks') or d.get('intro') or []
        for b in blocks:
            if b['t'] == 'p':
                total += sum(1 for s in b['inline'] if s.get('href'))
            elif b['t'] in ('ul', 'ol'):
                total += sum(1 for it in b['items'] for s in it if s.get('href'))
    print(f'{articles} articles, {topics} topic intros')
    print(f'spelling replacements: {sum(counts.values())} ({len(counts)} distinct words)')
    print(f'links now: {total}')


if __name__ == '__main__':
    main(sys.argv[1])
