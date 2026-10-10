"""
One-off content edit: the legacy phone coaching, hotline and phone number no
longer exist. Rewrites every offer to the e-mail address (or drops it) while
leaving advice about phoning other people alone.

    python tools/remove_phone_offers.py content contact@simsab.net

Idempotent. Prints the number of strings changed per rule.
"""
import glob
import json
import os
import re
import sys

Q = r'[„"“”\'‘’]'  # any quote character the models use

# (name, pattern, replacement); {mail} is substituted
RULES = [
    # -- reachable by phone or e-mail -> e-mail --------------------------------------------------
    ('contact-hint',
     rf'Sie können uns per E-?Mail oder Telefon erreichen\.\s*Dazu gehen Sie bitte auf {Q}?Hilfe(?:/| oder ){Q}?Kontakt{Q}?\.?',
     'Sie erreichen uns per E-Mail: {mail}.'),
    ('phone-form',
     rf'Unsere Telefonnummer sowie ein Kontaktformular finden Sie unter {Q}Hilfe/Kontakt{Q}\.?',
     'Sie erreichen uns per E-Mail: {mail}.'),
    ('contact-data',
     rf'Unter {Q}Kontakt{Q} finden Sie unsere Telefonnummer und ein Kontaktformular\.',
     'Sie erreichen uns per E-Mail: {mail}.'),
    ('email-or-phone', r'per E-?[Mm]ail oder Telefon', 'per E-Mail'),
    ('phone-or-email', r'per Telefon oder E-?[Mm]ail', 'per E-Mail'),
    ('phone-or-email2', r'telefonisch oder per E-?[Mm]ail', 'per E-Mail'),
    ('beraten-telefon', r'Gerne beraten wir Sie auch per Telefon\.\s*', ''),
    ('experts-phone', r'Unsere Experten am Telefon helfen Ihnen gerne weiter\.', 'Unsere Experten helfen Ihnen gerne per E-Mail weiter.'),
    ('experts-phone2', r'fragen Sie unsere Experten am Telefon', 'fragen Sie unsere Experten per E-Mail'),
    ('experts-phone3', r'sind unsere Experten für Sie telefonisch da', 'sind unsere Experten für Sie per E-Mail da'),
    ('call-experts-a', r'rufen Sie unsere Experten an,', 'fragen Sie unsere Experten per E-Mail,'),
    ('call-experts-b', r'(?:oder )?rufen Sie unsere Experten an!', 'fragen Sie unsere Experten per E-Mail!'),
    ('call-experts-c', r'Rufen Sie unsere Experten an,', 'Fragen Sie unsere Experten per E-Mail,'),
    ('call-experts-d', r'rufen Sie unsere Experten an:', 'fragen Sie unsere Experten per E-Mail:'),
    ('call-experts-e', r'rufen Sie unsere Experten an\.', 'fragen Sie unsere Experten per E-Mail.'),
    # -- phone coaching ----------------------------------------------------------------------------
    ('coaching-voucher',
     r'Bevor Sie mit diesem\s+Coaching fortfahren, lassen Sie sich Ihren Termin für das Telefoncoaching geben, das in Ihrem Paket enthalten ist\.\s*',
     ''),
    ('call-and-book',
     r'Rufen Sie uns an und vereinbaren Sie ein Telefoncoaching, um Ihre persönliche Situation zu besprechen\. Oder schreiben Sie uns',
     'Schreiben Sie uns'),
    ('book-by-mail',
     r'Schreiben Sie uns an ({mail}) und vereinbaren Sie ein persönliches Coaching, um Ihre Situation zu besprechen\.',
     r'Schreiben Sie uns an \1, um Ihre persönliche Situation zu besprechen.'),
    ('book-or-sms', r'vereinbaren Sie\s+ein Telefoncoaching oder senden Sie uns eine Sms', 'senden Sie uns eine E-Mail'),
    ('mail-or-book', r'eine E-Mail oder buchen Sie ein Telefoncoaching\.', 'eine E-Mail.'),
    ('ask-or-book', r' oder buchen Sie ein persönliches Telefoncoaching!', '!'),
    ('call-terms',
     r'rufen Sie uns an und vereinbaren Sie einen Termin für ein Telefoncoaching',
     'schreiben Sie uns eine E-Mail an {mail}'),
    ('call-therapist',
     r'Rufen Sie uns an und wir nennen Ihnen einige gut ausgebildete Therapeuten in Ihrer Nähe\.',
     'Suchen Sie sich einen gut ausgebildeten Therapeuten in Ihrer Nähe.'),
    ('use-coaching', r'\s*Nutzen Sie dazu unser Telefoncoaching\.', ''),
    ('phone-advice',
     r'Zur Vorbereitung des Gesprächs können Sie gerne unsere telefonische Beratung nutzen\. Sie erreichen uns unter ' + r'[\w.@-]+\.',
     'Zur Vorbereitung des Gesprächs können Sie uns gerne eine E-Mail schreiben: {mail}.'),
    # -- references to features of the old site that do not exist any more -------------------------
    ('contact-page',
     rf'(?:Unsere Kontaktdaten|Die Telefonnummer und ein Kontaktformular) finden Sie unter {Q}Kontakt{Q}',
     'Sie erreichen uns per E-Mail: {mail}'),
    ('contact-form',
     r'Schreiben Sie uns eine Nachricht über das Kontaktformular,',
     'Schreiben Sie uns eine E-Mail an {mail},'),
    ('feedback-button',
     r'klicken Sie auf Feedback oder kontaktieren Sie uns per E-Mail',
     'schreiben Sie uns eine E-Mail'),
    ('coach-session',
     r'Gemeinsam mit dem Coach besprechen Sie Ihre individuelle Situation und planen die nächsten Schritte\.\s*Sie erreichen uns unter [\w.@-]+\.',
     'Wenn Sie Ihre individuelle Situation besprechen möchten, schreiben Sie uns an {mail}.'),
    ('double-tld', r'(@simsab\.net)\.net', r'\1'),
    ('free-minutes-pkg',
     r'Dazu erhalten Sie in allen Paketen kostenlos 10 Min\. Telefon-Beratung zu Ihren persönlichen Fragen\.\s*',
     ''),
    ('free-minutes',
     r'[^.!?\n]*(?:kostenlos|gratis)[^.!?\n]*Telefon-?[Bb]eratung[^.!?\n]*[.!?]\s*',
     ''),
    ('send-contact',
     r'[^.!?\n]*Telefonnummer Ihrer Vertrauensperson[^.!?\n]*[.!?]\s*',
     ''),
]

LIST_DROP = re.compile(r'telefon-?beratung|telefoncoaching|hotline', re.I)


def apply(text, mail):
    counts = {}
    for name, pattern, repl in RULES:
        pat = re.compile(pattern.replace('{mail}', re.escape(mail)))
        new, n = pat.subn(repl.replace('{mail}', mail), text)
        if n:
            counts[name] = counts.get(name, 0) + n
            text = new
    return text, counts


def walk(obj, mail, counts):
    if isinstance(obj, str):
        new, c = apply(obj, mail)
        for k, v in c.items():
            counts[k] = counts.get(k, 0) + v
        return new
    if isinstance(obj, list):
        items = [walk(v, mail, counts) for v in obj]
        kept = []
        for v in items:
            if isinstance(v, dict) and isinstance(v.get('element'), str) and LIST_DROP.search(v['element']):
                counts['list-item'] = counts.get('list-item', 0) + 1
                continue
            kept.append(v)
        return kept
    if isinstance(obj, dict):
        return {k: walk(v, mail, counts) for k, v in obj.items()}
    return obj


def main(content_dir, mail):
    counts, files = {}, 0
    for path in sorted(glob.glob(os.path.join(content_dir, 'coachings', '*.json')) +
                       glob.glob(os.path.join(content_dir, 'site', '*.json'))):
        data = json.load(open(path, encoding='utf-8'))
        new = walk(data, mail, counts)
        if new != data:
            files += 1
            with open(path, 'w', encoding='utf-8', newline='\n') as f:
                json.dump(new, f, ensure_ascii=False, indent=2)
                f.write('\n')
    print('files changed:', files)
    for k, v in sorted(counts.items()):
        print('  %-18s %d' % (k, v))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
