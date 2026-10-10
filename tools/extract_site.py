"""
Extract the site structure (categories, products, experts, coaching metadata)
from the legacy `motivado_revival` database dump into content/site/*.json.

Only the catalogue tables are read; shop and user data are never touched.

    python tools/extract_site.py path/to/motivado_revival.sql content/site
"""
import collections
import html
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(__file__))
from parse_dump import parse_inserts  # noqa: E402

TABLES = ['category', 'coaching', 'expert', 'product', 'product_coaching']

# experts that are not shown on the site (no usable portrait)
EXCLUDED_EXPERTS = {26}

GROUPS = {
    'beziehung': 'Beziehung',
    'gesundheit': 'Gesundheit',
    'karriere': 'Karriere',
    'erziehung': 'Erziehung',
}


def to_text(value):
    """Reduce the legacy HTML snippets to plain text with paragraph breaks."""
    s = value or ''
    s = re.sub(r'<(script|style)\b.*?</\1>', '', s, flags=re.S | re.I)
    s = re.sub(r'<\s*li[^>]*>', '\n• ', s, flags=re.I)
    s = re.sub(r'<\s*(br\s*/?|/p|/div|/h\d|/ul|/ol|/li)\s*>', '\n', s, flags=re.I)
    s = re.sub(r'<[^>]+>', '', s)
    s = html.unescape(s).replace('\xa0', ' ')
    s = re.sub(r'[ \t]+', ' ', s)
    s = re.sub(r'\s*\n\s*', '\n', s)
    return s.strip()


def ids(csv):
    return [int(x) for x in (csv or '').split(',') if x.strip().isdigit()]


def main(dump_path, out_dir):
    _, t = parse_inserts(dump_path, TABLES)
    os.makedirs(out_dir, exist_ok=True)

    categories = []
    for c in sorted(t['category'], key=lambda c: c['urlkey']):
        parts = c['urlkey'].split('/')
        categories.append({
            'slug': parts[-1],
            'path': c['urlkey'],
            'group': parts[0],
            'title': c['title'],
            'description': to_text(c['description']),
            'experts': [i for i in ids(c['experts']) if i not in EXCLUDED_EXPERTS],
        })

    by_product = collections.defaultdict(list)
    for r in t['product_coaching']:
        by_product[r['product_id']].append(r)
    coaching_key = {c['id']: c['key'] for c in t['coaching']}

    products = []
    seen = set()
    for p in sorted(t['product'], key=lambda p: p['urlkey']):
        parts = p['urlkey'].split('/')
        slug = parts[-1]
        if slug in seen:
            slug = f"{parts[-2]}-{slug}"
        seen.add(slug)
        category = '/'.join(parts[:-1])
        rows = sorted(by_product[p['id']], key=lambda r: r['position'])
        products.append({
            'slug': slug,
            'path': p['urlkey'],
            'category': category,
            'title': p['title'],
            'subtitle': to_text(p['subtitle']),
            'description': to_text(p['description']),
            'experts': [i for i in ids(p['experts']) if i not in EXCLUDED_EXPERTS],
            'coachings': [coaching_key[r['coaching_id']] for r in rows if r['coaching_id'] in coaching_key],
        })

    experts = [{'id': e['id'], 'name': e['name'], 'description': to_text(e['description'])}
               for e in sorted(t['expert'], key=lambda e: e['id']) if e['id'] not in EXCLUDED_EXPERTS]

    coachings = {c['key']: {
        'title': to_text(c['title']),
        'subtitle': to_text(c['subtitle']),
        'description': to_text(c['description']),
    } for c in sorted(t['coaching'], key=lambda c: c['key'])}

    out = {
        'groups.json': [{'slug': k, 'title': v} for k, v in GROUPS.items()],
        'categories.json': categories,
        'products.json': products,
        'experts.json': experts,
        'coachings.json': coachings,
    }
    for name, data in out.items():
        with open(os.path.join(out_dir, name), 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write('\n')
        print(name, len(data))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
