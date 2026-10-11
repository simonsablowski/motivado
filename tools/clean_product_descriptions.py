"""Tidy the package descriptions that came out of the shop database."""
import json
import re

P = 'D:/Development/motivado/motivado/content/site/products.json'
raw = open(P, encoding='utf-8', newline='').read()
products = json.loads(raw)

# The shop page of this package carried two sales variants one after the other, with page-builder
# markers and offers that do not exist any more (phone advice, SMS help, money-back guarantee,
# three advice packages). Only the introduction survives, in the owner's wording.
OVERRIDES = {
    'ex-zurueck': (
        'Sie wollen Ihren Ex-Partner zurückgewinnen? Wir wissen: Es gibt immer eine Chance!\n'
        'In diesem Paket erwarten Sie 21 interaktive Video-Coachings mit unserem Experten Emanuel Albert. '
        '\u201eFinger weg von Handy oder Facebook!\u201c sagt Coach Emanuel Albert. Er hat schon vielen '
        'Menschen geholfen und weiß, woran sie scheitern. In 21 Coachings sagt er Ihnen genau, was Sie '
        'machen sollen \u2013 und wovon Sie besser die Finger lassen.'
    ),
}

changed = []
for p in products:
    before = p['description']
    if p['slug'] in OVERRIDES:
        p['description'] = OVERRIDES[p['slug']]
    else:
        # page-builder leftovers
        lines = [l for l in before.split('\n') if not re.fullmatch(r'\s*(-->|<!--.*)\s*', l)]
        p['description'] = '\n'.join(lines)
    if p['description'] != before:
        changed.append(p['slug'])

indent = 2 if '\n  ' in raw else None
open(P, 'w', encoding='utf-8', newline='').write(
    json.dumps(products, ensure_ascii=False, indent=indent) + ('\n' if raw.endswith('\n') else ''))
print('changed:', changed)
