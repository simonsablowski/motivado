"""
One-off content edit: the legacy service mailbox and hotline no longer exist.
Replaces every mention in content/ by the current contact address.

    python tools/update_contact.py content contact@simsab.net
"""
import glob
import json
import os
import sys

OLD_MAIL = 'service@motivado.de'

# sentences that offered the phone hotline or contact form -> same offer by mail
REWRITES = [
    ('Sie erreichen uns unter der kostenfreien Rufnummer 0800 909 5 909 und unter service@motivado.de.',
     'Sie erreichen uns unter {mail}.'),
    ('Sie erreichen uns unter service@motivado.de oder per Telefon: 030-609 886 72 (montags-freitags von 10-19 Uhr).',
     'Sie erreichen uns unter {mail}.'),
    ('Rufen Sie uns an unter 0800 - 909 5 909 oder schicken Sie uns eine E-Mail mit Ihrem Foto an service@motivado.de.',
     'Schicken Sie uns eine E-Mail mit Ihrem Foto an {mail}.'),
    ('Rufen Sie uns an unter 0800 - 909 5 909 oder schicken Sie uns eine E-Mail an service@motivado.de.',
     'Schicken Sie uns eine E-Mail an {mail}.'),
    ('Rufen Sie uns an unter 0800 909 5 909 (kostenlose Hotline) und vereinbaren Sie ein Telefoncoaching, um Ihre persönliche Situation zu besprechen.',
     'Schreiben Sie uns an {mail} und vereinbaren Sie ein persönliches Coaching, um Ihre Situation zu besprechen.'),
    ('Unter “Kontakt” finden Sie unsere Hotline-Nummer und ein Kontaktformular.',
     'Unsere Kontaktdaten finden Sie unter “Kontakt”.'),
    ('Die Telefonnummer unserer Hotline und ein Kontaktformular finden Sie unter "Kontakt".',
     'Unsere Kontaktdaten finden Sie unter "Kontakt".'),
    ('Telefon: 0800 - 909 5 909\n', ''),
    ('Telefon: 0800 - 909 5 909\r\n', ''),
    ('an unsere Experten an der Hotline wenden,', 'an unsere Experten ({mail}) wenden,'),
    ('jederzeit an unsere Hotline wenden.', 'jederzeit an uns wenden: {mail}.'),
    ('wenden Sie sich bitte an unsere Hotline.', 'wenden Sie sich bitte an {mail}.'),
    ('wenden Sie sich bitte an unsere Hotline', 'wenden Sie sich bitte an {mail}'),
    ('Greifen Sie zum Hörer und kontaktieren Sie unsere Hotline.', 'Schreiben Sie uns einfach an {mail}.'),
    # concrete phone / SMS numbers of the legacy support
    ('nutzen Sie bitte unsere telefonische Beratung unter 030 - 609 886 72.', 'schreiben Sie uns bitte an {mail}.'),
    ('Wir können Ihnen auch kurzfristig per Telefon weiterhelfen (030-609 886 72).',
     'Wir können Ihnen auch kurzfristig per E-Mail weiterhelfen ({mail}).'),
    ('1. Per E-Mail unter {mail}\r\n2. Per Telefon unter 030-609 886 72\r\n3. Per SMS unter 0176-32 53 73 83 (kostenpflichtiger Service)',
     'Per E-Mail unter {mail}'),
    ('rufen Sie uns an und vereinbaren Sie einen Termin für ein Telefoncoaching. Wir werden versuchen Ihnen alle offenen Fragen zu beantworten.\n\n030-60988672',
     'schreiben Sie uns an {mail}. Wir werden versuchen Ihnen alle offenen Fragen zu beantworten.'),
    ('Telefon: 0800 - 909 5 909', ''),
    ('2. Per Telefon unter 030-609 886 72', ''),
    ('3. Per Sms unter 0176-32 53 73 83 (kostenpflichtiger Service)', ''),
]


def fix(text, mail):
    for old, new in REWRITES:
        text = text.replace(old.replace('{mail}', mail), new.format(mail=mail))
    return text.replace(OLD_MAIL, mail)


def walk(obj, mail):
    if isinstance(obj, str):
        return fix(obj, mail)
    if isinstance(obj, list):
        items = [walk(v, mail) for v in obj]
        # list entries that only held a removed phone number
        return [v for v in items if not (isinstance(v, dict) and v.get('element') == '')]
    if isinstance(obj, dict):
        return {k: walk(v, mail) for k, v in obj.items()}
    return obj


def main(content_dir, mail):
    changed = 0
    for path in sorted(glob.glob(os.path.join(content_dir, 'coachings', '*.json')) +
                       glob.glob(os.path.join(content_dir, 'site', '*.json'))):
        raw = open(path, encoding='utf-8').read()
        data = json.loads(raw)
        new = walk(data, mail)
        if new != data:
            with open(path, 'w', encoding='utf-8', newline='\n') as f:
                json.dump(new, f, ensure_ascii=False, indent=2)
                f.write('\n')
            changed += 1
    print('files changed:', changed)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
