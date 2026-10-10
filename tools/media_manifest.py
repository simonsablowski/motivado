"""
Build content/media-manifest.json: every media file the coachings reference and
where it can be found.

    python tools/media_manifest.py content videos=D:/.../videos documents=D:/.../documents images=D:/.../images

Each `label=dir` is a source folder, searched in the given order. The manifest
stores only the label and file name, never local paths; tools/build_media.py is
given the same label=dir arguments to find the files again.

Names in the models are not always exact (leading spaces, spaces inside the
name, `ß` written as `ss`, broken umlauts, different case), so matching falls
back to a normalised comparison.
"""
import glob
import json
import os
import re
import sys
import unicodedata

TRANSLIT = {'ß': 'ss', 'ä': 'ae', 'ö': 'oe', 'ü': 'ue'}


def normalise(name):
    s = unicodedata.normalize('NFC', name).strip().lower()
    s = re.sub(r'\s+', '', s)
    for k, v in TRANSLIT.items():
        s = s.replace(k, v)
    return s


def pattern_for(name):
    """Regex for names with broken characters: each non-ASCII char stands for 1-2 letters."""
    s = normalise(name)
    return re.compile('^' + ''.join(re.escape(c) if ord(c) < 128 else '[a-z]{1,2}' for c in s) + '$')


def referenced(coaching):
    """Yield (kind, name) for every media reference inside a coaching."""
    for node in coaching['nodes'].values():
        p = node['props']
        v = (p.get('video') or {}).get('url')
        if v:
            yield 'video', v
        for e in p.get('events') or []:
            if e.get('url'):
                yield 'image', e['url']
        for e in p.get('elements') or []:
            if isinstance(e, dict) and re.search(r'\.(png|jpe?g|gif)$', str(e.get('element', '')), re.I):
                yield 'image', e['element']
        for d in p.get('documents') or []:
            if d.get('file'):
                yield 'document', d['file']


def main(content_dir, sources):
    index = []  # (label, filename, size)
    for label, directory in sources:
        for root, _, files in os.walk(directory):
            if '.svn' in root.split(os.sep):
                continue
            for f in files:
                if f.startswith('.'):
                    continue
                index.append((label, f, os.path.getsize(os.path.join(root, f))))
    exact = {}
    for item in index:
        exact.setdefault(item[1].lower(), item)
    by_norm = {}
    for item in index:
        by_norm.setdefault(normalise(item[1]), item)

    entries, per_coaching = {}, {}
    for path in sorted(glob.glob(os.path.join(content_dir, 'coachings', '*.json'))):
        c = json.load(open(path, encoding='utf-8'))
        names = per_coaching.setdefault(c['key'], set())
        for kind, name in referenced(c):
            names.add(name)
            if name in entries:
                continue
            hit, how = exact.get(name.strip().lower()), 'exact'
            if not hit:
                hit, how = by_norm.get(normalise(name)), 'fuzzy'
            if not hit and any(ord(ch) > 127 for ch in name):
                rx = pattern_for(name)
                cands = {k: v for k, v in by_norm.items() if rx.match(k)}
                if len(cands) == 1:
                    hit, how = next(iter(cands.values())), 'fuzzy'
            entries[name] = {
                'kind': kind,
                'source': hit[0] if hit else None,
                'file': hit[1] if hit else None,
                'bytes': hit[2] if hit else None,
                'match': how if hit else 'missing',
            }

    manifest = {
        'files': dict(sorted(entries.items())),
        'coachings': {k: sorted(v) for k, v in sorted(per_coaching.items())},
    }
    with open(os.path.join(content_dir, 'media-manifest.json'), 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)
        f.write('\n')

    summary = {}
    for e in entries.values():
        k = summary.setdefault(e['kind'], {'exact': 0, 'fuzzy': 0, 'missing': 0})
        k[e['match']] += 1
    print('referenced media:', len(entries))
    for kind, counts in summary.items():
        print(' ', kind, counts)
    print('missing:', [n for n, e in entries.items() if e['match'] == 'missing'])


if __name__ == '__main__':
    pairs = [a.split('=', 1) for a in sys.argv[2:]]
    main(sys.argv[1], pairs)
