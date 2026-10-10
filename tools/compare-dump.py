"""
Compare the importer output with the graph of a legacy database dump.

The legacy importer wrote `coaching`, `object` and `objecttransition` rows. This
script reads those rows (as JSON, produced by tools/parse-dump.py) and compares
them with content/coachings/*.json: object signatures and edges as multisets.

    python tools/compare-dump.py api.json content/coachings
"""
import collections
import glob
import json
import os
import sys


def demojibake(s):
    """The legacy database stored UTF-8 text that was decoded as Latin-1/CP1252."""
    for enc in ('latin-1', 'cp1252'):
        try:
            return s.encode(enc).decode('utf-8')
        except (UnicodeEncodeError, UnicodeDecodeError):
            continue
    return s


def norm(s):
    """Normalised comparison form: demojibaked, stripped and reduced to ASCII.

    Dropping non-ASCII characters keeps the comparison robust against the
    partly double-encoded legacy data while still checking all structure."""
    return ''.join(c for c in demojibake(s or '').strip() if ord(c) < 128)


def props(p):
    if not p:
        return {}
    try:
        return json.loads(demojibake(p))
    except ValueError:
        return {'__invalid__': p}


def skeleton(obj):
    return norm(json.dumps(obj, sort_keys=True, ensure_ascii=False))


def sig_old(o):
    return (o['type'], norm(o['key']), norm(o['title']), norm(o['description']), skeleton(props(o['properties'])))


def sig_new(n):
    return (n['type'], norm(n['key']), norm(n['title']), norm(n['text']), skeleton(n['props']))


def main(dump_path, content_dir):
    dump = json.load(open(dump_path, encoding='utf-8'))
    old_by_key = {}
    coachings = {str(c['id']): c['key'] for c in dump['coaching']}
    objs = collections.defaultdict(dict)
    for o in dump['object']:
        objs[str(o['CoachingId'])][str(o['id'])] = o
    edges = collections.defaultdict(list)
    for t in dump['objecttransition']:
        edges[str(t['CoachingId'])].append(t)

    rows = []
    for cid, key in coachings.items():
        path = os.path.join(content_dir, key + '.json')
        if not os.path.exists(path):
            rows.append((key, 'MISSING', '', ''))
            continue
        new = json.load(open(path, encoding='utf-8'))
        nsig = {n['id']: sig_new(n) for n in new['nodes'].values()}
        osig = {i: sig_old(o) for i, o in objs[cid].items()}
        # only objects that take part in at least one transition were reachable
        used = set()
        for t in edges[cid]:
            used.add(str(t['LeftId']))
            used.add(str(t['RightId']))
        used.discard('0')
        osig = {i: s for i, s in osig.items() if i in used}

        oc, nc = collections.Counter(osig.values()), collections.Counter(nsig.values())
        only_old = sum((oc - nc).values())
        only_new = sum((nc - oc).values())

        def oedge(t):
            l = osig.get(str(t['LeftId']), 'START')
            r = osig.get(str(t['RightId']), 'END')
            return (l, r, norm(t['condition']))

        def nedge_list():
            for e in new['start']:
                yield ('START', nsig.get(e['to'], 'END') if e['to'] else 'END', norm(e.get('if', '')))
            for n in new['nodes'].values():
                for e in n['next']:
                    yield (nsig[n['id']], nsig.get(e['to'], 'END') if e['to'] else 'END', norm(e.get('if', '')))

        oec = collections.Counter(oedge(t) for t in edges[cid])
        nec = collections.Counter(nedge_list())
        eo = sum((oec - nec).values())
        en = sum((nec - oec).values())
        rows.append((key, 'ok' if not (only_old or only_new or eo or en) else 'DIFF',
                     f'objects old={len(osig)} new={len(nsig)} only_old={only_old} only_new={only_new}',
                     f'edges old={sum(oec.values())} new={sum(nec.values())} only_old={eo} only_new={en}'))

    same = [r for r in rows if r[1] == 'ok']
    print(f'{len(same)} of {len(rows)} coachings identical')
    for r in rows:
        if r[1] != 'ok':
            print(f'{r[1]:8} {r[0]:40} {r[2]} | {r[3]}')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
