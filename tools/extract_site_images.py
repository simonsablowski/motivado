"""
Copy the product and coaching images of the legacy catalogue into the web app.

    python tools/extract_site_images.py path/to/motivado_revival.sql content apps/web/public/img \
        D:/.../media D:/.../revival/public/media

The legacy database stores URLs on the old domain; the files are looked up by
name in the given local folders. Writes
    <out>/products/<product-slug>.jpg      (launched products)
    <out>/coachings/<catalogue-key>.jpg    (their coachings)
Missing files are skipped, the site falls back to topic photos.
"""
import json
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from parse_dump import parse_inserts  # noqa: E402

EXT = ('.jpg', '.jpeg', '.png', '.gif')


def index_files(folders):
    found = {}
    for base in folders:
        for root, dirs, files in os.walk(base):
            dirs[:] = [d for d in dirs if d not in ('.svn', '.thumbs')]
            for f in files:
                if f.lower().endswith(EXT):
                    found.setdefault(f.lower(), os.path.join(root, f))
    return found


def save(src, dst, max_side):
    im = Image.open(src).convert('RGB')
    im.thumbnail((max_side, max_side))
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    im.save(dst, quality=84, optimize=True)


def main(dump, content_dir, out_dir, folders):
    _, t = parse_inserts(dump, ['product', 'coaching', 'product_coaching'])
    launch = json.load(open(os.path.join(content_dir, 'site', 'launch.json'), encoding='utf-8'))['products']
    files = index_files(folders)
    products = {p['urlkey'].split('/')[-1]: p for p in t['product']}
    coachings = {c['id']: c for c in t['coaching']}
    n_products = n_coachings = 0
    for slug in launch:
        p = products.get(slug)
        if not p:
            continue
        name = os.path.basename(p['picture'] or '').lower()
        if name in files:
            save(files[name], os.path.join(out_dir, 'products', slug + '.jpg'), 480)
            n_products += 1
        for row in t['product_coaching']:
            if row['product_id'] != p['id'] or row['coaching_id'] not in coachings:
                continue
            c = coachings[row['coaching_id']]
            thumb = os.path.basename(c['thumbnail'] or '').lower()
            dst = os.path.join(out_dir, 'coachings', c['key'] + '.jpg')
            if thumb in files and not os.path.exists(dst):
                save(files[thumb], dst, 260)
                n_coachings += 1
    print(f'{n_products} product images, {n_coachings} coaching thumbnails')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4:])
