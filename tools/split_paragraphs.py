"""Break the long paragraphs of the Ratgeber articles into shorter ones, at sentence boundaries.

Usage: python tools/split_paragraphs.py content/ratgeber [--write]

A paragraph is {"t": "p", "inline": [{"t": text, "b"/"i"/"href": ...}, ...]}. The inline runs (bold,
italic, links) are kept; only the paragraph is cut. Text is never changed, only whitespace at a cut.
"""
import glob
import json
import re
import sys

TARGET = 330     # start a new paragraph once this much text is in the current one ...
MAX = 480        # ... and never let one grow beyond this if a sentence boundary is available
ABBR = {'z', 'b', 'ca', 'bzw', 'usw', 'dr', 'd', 'h', 'u', 'a', 'evtl', 'inkl', 'vgl', 'nr', 'ggf', 'ff', 'std',
        'mio', 'mrd', 'etc', 'bspw', 'sog', 'tel', 'st', 'prof', 'o', 'v', 'm', 's', 'abb', 'str', 'jh', 'ev', 'zb',
        'resp', 'i', 'e', 'k', 'p', 'c', 'f', 'g', 'l', 'n', 'r', 't', 'w', 'x', 'y', 'j', 'q'}


def boundaries(text):
    """Indices just after a sentence end (after the whitespace)."""
    cuts = []
    for m in re.finditer(r'([.!?]["“”»)]?)(\s+)(?=["„»(]?[A-ZÄÖÜ0-9])', text):
        before = text[:m.start()]
        word = re.search(r'([A-Za-zÄÖÜäöü]+)$', before)
        if m.group(1)[0] == '.' and word and word.group(1).lower() in ABBR:
            continue
        if m.group(1)[0] == '.' and re.search(r'\d$', before) and re.match(r'\s+\d', text[m.end(1):m.end() + 2]):
            continue                                  # "1. 2." style enumerations
        cuts.append(m.end())
    return cuts


def split_runs(runs):
    text = ''.join(r.get('t', '') for r in runs)
    owner = []
    for i, r in enumerate(runs):
        owner.extend([i] * len(r.get('t', '')))
    cuts = boundaries(text)
    if not cuts or len(text) <= MAX:
        return [runs]
    ends = cuts + [len(text)]
    chunks, start = [], 0
    for k, end in enumerate(ends):
        # close the paragraph when the next sentence would push it past MAX, or it reached the target
        seg_len = end - start
        nxt = ends[k + 1] - start if k + 1 < len(ends) else None
        if seg_len >= TARGET or (nxt is not None and nxt > MAX and seg_len >= 120):
            chunks.append((start, end))
            start = end
    if start < len(text):
        if chunks and len(text) - start < 120:
            chunks[-1] = (chunks[-1][0], len(text))      # no tiny orphan paragraph at the end
        else:
            chunks.append((start, len(text)))
    out = []
    for a, b in chunks:
        part = []
        i = a
        while i < b:
            j = i
            while j < b and owner[j] == owner[i]:
                j += 1
            run = dict(runs[owner[i]])
            run['t'] = text[i:j]
            part.append(run)
            i = j
        if part:
            part[0]['t'] = part[0]['t'].lstrip()
            part[-1]['t'] = part[-1]['t'].rstrip()
            part = [r for r in part if r['t'] != '']
        out.append(part)
    return out


def process(blocks, stats):
    res = []
    for b in blocks:
        if b.get('t') == 'p' and 'inline' in b:
            stats['paragraphs'] += 1
            parts = split_runs(b['inline'])
            if len(parts) > 1:
                stats['split'] += 1
                stats['created'] += len(parts) - 1
            for p in parts:
                nb = dict(b)
                nb['inline'] = p
                res.append(nb)
        else:
            res.append(b)
    return res


def plain(blocks):
    return re.sub(r'\s+', '', ''.join(r.get('t', '') for b in blocks for r in b.get('inline', [])))


root = sys.argv[1]
write = '--write' in sys.argv
stats = {'paragraphs': 0, 'split': 0, 'created': 0, 'files': 0}
for f in glob.glob(root + '/**/*.json', recursive=True):
    raw = open(f, encoding='utf-8', newline='').read()
    data = json.loads(raw)
    changed = False
    for key in ('blocks', 'intro'):
        if isinstance(data, dict) and isinstance(data.get(key), list):
            new = process(data[key], stats)
            assert plain(new) == plain(data[key]), f
            if len(new) != len(data[key]):
                data[key] = new
                changed = True
    if isinstance(data, list):                      # topics.json
        for t in data:
            if isinstance(t.get('intro'), list):
                new = process(t['intro'], stats)
                assert plain(new) == plain(t['intro']), f
                if len(new) != len(t['intro']):
                    t['intro'] = new
                    changed = True
    if changed:
        stats['files'] += 1
        if write:
            indent = 2 if raw.startswith('{\n  ') or raw.startswith('[\n  ') else None
            open(f, 'w', encoding='utf-8', newline='').write(json.dumps(data, ensure_ascii=False, indent=indent) + ('\n' if raw.endswith('\n') else ''))
print(stats)
