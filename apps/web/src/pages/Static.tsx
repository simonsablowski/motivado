import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getJson } from '../lib/api';
import { usePageMeta } from '../lib/meta';
import { SITE } from '../site.config';
import { PageHead } from '../components/PageHead';

export function Loading({ loading = true }: { loading?: boolean }) {
  return (
    <div className="wrap state" role="status">
      {loading ? 'Lädt …' : 'Die Inhalte konnten nicht geladen werden. Bitte versuchen Sie es später noch einmal.'}
    </div>
  );
}

export function NotFound() {
  usePageMeta('Seite nicht gefunden');
  return (
    <>
      <PageHead eyebrow="404" title="Diese Seite gibt es nicht." lead="Vielleicht hilft die Startseite weiter." />
      <div className="wrap">
        <Link className="button" to="/">
          Zur Startseite
        </Link>
      </div>
    </>
  );
}

/** Photographers of the Unsplash photos used on the site (content/site/photos.json). */
function PhotoCredits() {
  const [names, setNames] = useState<string[]>([]);
  useEffect(() => {
    getJson<Record<string, { by?: string }>>('/content/site/photos.json').then(
      (photos) => {
        const by = Object.entries(photos)
          .filter(([k]) => !k.startsWith('_'))
          .map(([, p]) => p.by)
          .filter((n): n is string => Boolean(n));
        setNames([...new Set(by)].sort((a, b) => a.localeCompare(b, 'de')));
      },
      () => setNames([]),
    );
  }, []);
  return (
    <>
      <h2>Bildnachweis</h2>
      <p>
        Die Fotografien auf dieser Website stammen von{' '}
        <a href="https://unsplash.com" rel="noopener noreferrer" target="_blank">
          Unsplash
        </a>{' '}
        und werden unter der{' '}
        <a href="https://unsplash.com/license" rel="noopener noreferrer" target="_blank">
          Unsplash-Lizenz
        </a>{' '}
        verwendet.
        {names.length > 0 && <> Fotografinnen und Fotografen: {names.join(', ')}.</>}
      </p>
    </>
  );
}

/**
 * Legal pages. The operator's details live in site.config.ts (§ 5 DDG, DSGVO).
 */
export function Legal({ page }: { page: 'impressum' | 'datenschutz' }) {
  const impressum = page === 'impressum';
  usePageMeta(impressum ? 'Impressum' : 'Datenschutz');
  return (
    <>
      <PageHead title={impressum ? 'Impressum' : 'Datenschutz'} />
      <div className="wrap">
        <div className="prose section">
          {impressum ? (
            <>
              <h2>Angaben gemäß § 5 DDG</h2>
              <p>
                {SITE.operator.name}
                <br />
                {SITE.operator.street}
                <br />
                {SITE.operator.city}
              </p>
              <h2>Kontakt</h2>
              <p>
                E-Mail: <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>
              </p>
              <PhotoCredits />
            </>
          ) : (
            <>
              <p>
                Diese Website speichert Ihre Antworten im Coaching ausschließlich lokal in Ihrem Browser (localStorage).
                Es werden keine Cookies zu Werbezwecken gesetzt und keine Daten an Dritte übermittelt.
              </p>
              <p>
                Die Videos werden von unserem Medienserver ausgeliefert. Dabei verarbeitet der Hosting-Anbieter
                technisch notwendige Verbindungsdaten (z. B. IP-Adresse).
              </p>
              {SITE.supportUrl && (
                <>
                  <h2>Freiwillige Unterstützung</h2>
                  <p>
                    Wenn Sie Motivado freiwillig unterstützen, verlassen Sie diese Website. Die Zahlung wird vollständig
                    von {SITE.supportProvider} abgewickelt. Welche Daten dort verarbeitet werden, regelt die
                    Datenschutzerklärung von {SITE.supportProvider}. Ich erhalte lediglich eine Bestätigung über den
                    Zahlungseingang.
                  </p>
                </>
              )}
              <h2>Verantwortlicher</h2>
              <p>
                {SITE.operator.name}, {SITE.operator.street}, {SITE.operator.city}
                <br />
                E-Mail: <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>
              </p>
            </>
          )}
        </div>
      </div>
    </>
  );
}
