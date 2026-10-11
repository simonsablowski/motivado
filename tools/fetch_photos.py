"""Fetch the Unsplash photos listed in content/site/photos.json, cropped to 3:2 and sized for the site.

Usage: python tools/fetch_photos.py content apps/web/public/img

topic-<group> slots become <out>/<group>.jpg, every other slot <out>/products/<slot>.jpg.
Photos are free to use under the Unsplash licence (https://unsplash.com/license).
"""
import json
import os
import sys
import urllib.request

content, out = sys.argv[1], sys.argv[2]
photos = json.load(open(os.path.join(content, 'site', 'photos.json'), encoding='utf-8'))
os.makedirs(os.path.join(out, 'products'), exist_ok=True)
total = 0
for slot, p in photos.items():
    if slot.startswith('_'):
        continue
    dest = os.path.join(out, slot[len('topic-'):] + '.jpg') if slot.startswith('topic-') else os.path.join(out, 'products', slot + '.jpg')
    url = f'https://images.unsplash.com/{p["file"]}?w=1000&h=667&fit=crop&crop=faces,entropy&q=78&fm=jpg'
    req = urllib.request.Request(url, headers={'User-Agent': 'motivado-site-build'})
    with urllib.request.urlopen(req, timeout=60) as r:
        data = r.read()
    open(dest, 'wb').write(data)
    total += len(data)
    print(f'{slot:40} {len(data) // 1024:4} KB')
print(f'{len(photos) - 1} photos, {total // 1024} KB')
