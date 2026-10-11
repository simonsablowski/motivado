"""Give the five "Teil 2" nutrition and exercise modules a subtitle and description, so they are no longer
filtered out as placeholders (their catalogue entries said "x")."""
import json

P = 'D:/Development/motivado/motivado/content/site/coachings.json'
raw = open(P, encoding='utf-8', newline='').read()
meta = json.loads(raw)

TEXTS = {
    'ges-abn-bew-aufraffen2': (
        'Mit einem Belohnungssystem dranbleiben',
        'Am Ende freuen Sie sich auf Ihre nächste Sporteinheit: Sie planen eine ganze Woche mit Training und Belohnung.',
    ),
    'ges-abn-bew-spass2': (
        'Wenn das Training keinen Spaß mehr macht',
        'Finden Sie heraus, warum die Freude verloren ging, und gestalten Sie Ihr Training so einfach, dass Sie dranbleiben.',
    ),
    'ges-abn-ern-belohnung2': (
        'Konkrete Strategien gegen die Dickmacher',
        'Was Sie tun können, wenn Sie sich mit Essen belohnen wollen, und wie Sie dem Verlangen widerstehen.',
    ),
    'ges-abn-ern-heissh-abend2': (
        'Wenn der Heißhunger schon da ist',
        'Warum Heißhunger mit Hunger nichts zu tun hat und was Sie in diesem Moment ganz konkret machen können.',
    ),
    'ges-abn-mot-kontrolle2': (
        'Geduld und der richtige Rhythmus',
        'Wöchentlich wiegen statt täglich: So behalten Sie Ihren Gewichtsverlauf im Blick und bleiben auch in schwierigen Phasen dabei.',
    ),
}
for key, (subtitle, description) in TEXTS.items():
    assert meta[key]['subtitle'] == 'x' and meta[key]['description'] == 'x', key
    meta[key]['subtitle'] = subtitle
    meta[key]['description'] = description

indent = 2 if raw.startswith('{\n  ') else None
open(P, 'w', encoding='utf-8', newline='').write(json.dumps(meta, ensure_ascii=False, indent=indent) + ('\n' if raw.endswith('\n') else ''))
print('described', len(TEXTS))
