"""Sort the Ratgeber articles of the big topics into sub-categories and write them to the topic index.

Usage: python tools/group_ratgeber.py content/ratgeber [--write]

Scoring: keyword hits in the slug and title (weight 3), the summary (2) and the opening of the text (1).
The last group of each topic is the fallback. The result is stored as `groups` in
content/ratgeber/<topic>/index.json: [{id, title, link: {to, label}, slugs: [...]}].
A review sheet with the winning score per article is written to ratgeber-groups-review.csv.
"""
import csv
import glob
import json
import os
import re
import sys

ROOT = sys.argv[1]
WRITE = '--write' in sys.argv

# topic -> ordered groups: (id, title, link target, link label, keyword regex); the last one is the fallback
GROUPS = {
    'beziehung': [
        ('liebeskummer-trennung', 'Liebeskummer und Trennung', '/paket/liebeskummer', 'Liebeskummer',
         r'liebeskummer|trennung|trennen|scheidung|schluss machen|verlassen|ex-partner|expartner|ex zur|loslassen|verlassen worden'),
        ('untreue-eifersucht', 'Untreue und Eifersucht', '/paket/betrogen-wordenbez-bet-paket', 'Betrogen worden',
         r'untreu|fremdgeh|betrog|aff.re|seitensprung|eifersucht|misstrauen|vertrauen'),
        ('partnersuche-dating', 'Partnersuche und Dating', '/paket/flirten', 'Flirten und Dating',
         r'partnersuche|partner finden|single|dating|flirt|kennenlern|traumfrau|traummann|verlieb|einsam|alleine|kontakt|partnerb.rse|partnervermittlung|liebe finden'),
        ('paarberatung-therapie', 'Paarberatung und Therapie', '/paket/beziehung-starken', 'Beziehung stärken',
         r'therapie|therapeut|beratung|berater|coach|paarberatung|familien|mediation|psycholog|hilfe bei'),
        ('partnerschaft-alltag', 'Partnerschaft und Alltag', '/paket/beziehung-starken', 'Beziehung stärken', r'.'),
    ],
    'abnehmen': [
        ('ernaehrung-diaet', 'Ernährung und Diät', '/paket/ernaehrung', 'Ernährung und Diät',
         r'ern.hrung|di.t|kalorien|lebensmittel|rezept|kohlenhydrat|eiwei|fasten|trennkost|jojo|gericht|abnehmplan|ern.hrungsplan'),
        ('sport-fitness', 'Sport und Fitness', '/paket/bewegung', 'Bewegung und Sport',
         r'sport|fitness|training|trainer|laufen|joggen|bauch|muskel|workout|bewegung|studio|.bung|gymnastik|ausdauer|kraft|walking'),
        ('programme-coaching', 'Abnehmprogramme und Coaching', '/themen/gesundheit', 'Alle Module zu Gesundheit',
         r'coach|programm|abnehmhilfe|abnehmkur|kur\b|club|gruppe|app\b|online|beratung|betreuung|hilfe'),
        ('tipps-motivation', 'Tipps und Motivation', '/paket/motivation', 'Motivation beim Abnehmen', r'.'),
    ],
    'bewerbung': [
        ('bewerbung-lebenslauf', 'Bewerbung und Lebenslauf', '/paket/motiviert-in-die-jobsuche-starten', 'Motivierte Jobsuche',
         r'bewerbung|anschreiben|lebenslauf|bewerben|einstellungstest|assessment|bewerbungsmappe|absage|zeugnis'),
        ('vorstellungsgespraech', 'Vorstellungsgespräch und Auftreten', '/paket/das-bewerbungsgesprach', 'Das Bewerbungsgespräch',
         r'vorstellungsgespr|bewerbungsgespr|gespr.ch|pr.sentation|rhetorik|auftreten|gehalt|selbstpr.sentation'),
        ('arbeitslosigkeit-berufsberatung', 'Arbeitslosigkeit und Berufsberatung', '/paket/motiviert-in-die-jobsuche-starten', 'Motivierte Jobsuche',
         r'arbeitslos|arbeitsagentur|k.ndigung|berufsberat|berufswahl|arbeitsmarkt|abfindung|altersteilzeit|jobsuche|stellensuche|umschulung|wiedereinstieg'),
        ('karriere-coaching', 'Karriere und Coaching', '/paket/das-eigene-potential-ausschopfen', 'Das eigene Potential',
         r'karriere|career|coach|f.hrung|business|weiterbildung|aufstieg|management|potential|st.rken|beruf'),
    ],
}


def text_of(block):
    return ''.join(r.get('t', '') for r in block.get('inline', [])) if block.get('t') == 'p' else block.get('text', '')


# articles without any keyword hit land here
FALLBACK = {'beziehung': 'partnerschaft-alltag', 'abnehmen': 'tipps-motivation', 'bewerbung': 'bewerbung-lebenslauf'}
BODY_WEIGHT = {'beziehung': 1, 'abnehmen': 0, 'bewerbung': 1}   # in the diet topic nearly every text says "Diät"


def score(pattern, slug, title, summary, body, bw=1):
    rx = re.compile(pattern, re.I)
    return 3 * len(rx.findall(slug.replace('-', ' '))) + 3 * len(rx.findall(title)) + 2 * len(rx.findall(summary)) + bw * len(rx.findall(body))


review = []
for topic, groups in GROUPS.items():
    index_path = os.path.join(ROOT, topic, 'index.json')
    index = json.load(open(index_path, encoding='utf-8'))
    members = {g[0]: [] for g in groups}
    for a in index['articles']:
        art = json.load(open(os.path.join(ROOT, topic, a['slug'] + '.json'), encoding='utf-8'))
        body = ' '.join(text_of(b) for b in art.get('blocks', [])[:4])[:900]
        best, best_score = None, 0
        for gid, title, _, _, pat in groups:
            if pat == '.':
                continue
            s = score(pat, a['slug'], a['title'], a.get('summary', ''), body, BODY_WEIGHT[topic])
            if s > best_score:
                best, best_score = gid, s
        gid = best or FALLBACK[topic]
        members[gid].append(a['slug'])
        review.append((topic, gid, best_score, a['slug'], a['title']))
    index['groups'] = [
        {'id': gid, 'title': title, 'link': {'to': to, 'label': label},
         'slugs': sorted(members[gid], key=lambda s: next(x['title'] for x in index['articles'] if x['slug'] == s).lower())}
        for gid, title, to, label, _ in groups
    ]
    print(topic, {g['title']: len(g['slugs']) for g in index['groups']})
    if WRITE:
        open(index_path, 'w', encoding='utf-8', newline='').write(json.dumps(index, ensure_ascii=False, indent=2) + '\n')

with open('ratgeber-groups-review.csv', 'w', encoding='utf-8-sig', newline='') as fh:
    w = csv.writer(fh, delimiter=';')
    w.writerow(['topic', 'group', 'score', 'slug', 'title'])
    w.writerows(sorted(review))
