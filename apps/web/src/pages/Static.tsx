import { Link } from 'react-router-dom';
import { SITE } from '../site.config';

export function Loading({ loading = true }: { loading?: boolean }) {
  return (
    <div className="wrap state" role="status">
      {loading ? 'Lädt …' : 'Die Inhalte konnten nicht geladen werden. Bitte versuchen Sie es später noch einmal.'}
    </div>
  );
}

export function NotFound() {
  return (
    <div className="wrap--narrow">
      <div className="page-head">
        <p className="eyebrow">404</p>
        <h1>Diese Seite gibt es nicht.</h1>
        <p className="lead">Vielleicht hilft die Startseite weiter.</p>
      </div>
      <Link className="button" to="/">
        Zur Startseite
      </Link>
    </div>
  );
}

/**
 * Legal pages are placeholders on purpose: they have to state the operator's
 * real details (§ 5 DDG, DSGVO) before the site goes live.
 */
export function Legal({ page }: { page: 'impressum' | 'datenschutz' }) {
  const impressum = page === 'impressum';
  return (
    <div className="wrap--narrow">
      <div className="page-head">
        <h1>{impressum ? 'Impressum' : 'Datenschutz'}</h1>
      </div>
      <div className="prose section">
        <p className="notice">
          Diese Seite ist ein Platzhalter. Die rechtlich erforderlichen Angaben werden vor der Veröffentlichung ergänzt.
        </p>
        {impressum ? (
          <>
            <p>Angaben gemäß § 5 DDG: Name und Anschrift des Betreibers, ggf. Registereintrag und USt-IdNr. folgen.</p>
            <p>
              Kontakt: <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>
            </p>
          </>
        ) : (
          <>
            <p>
              Diese Website speichert Ihre Antworten im Coaching ausschließlich lokal in Ihrem Browser (localStorage).
              Es werden keine Cookies zu Werbezwecken gesetzt und keine Daten an Dritte übermittelt.
            </p>
            <p>
              Die Videos werden von unserem Medienserver ausgeliefert. Dabei verarbeitet der Hosting-Anbieter technisch
              notwendige Verbindungsdaten (z. B. IP-Adresse).
            </p>
            <p>
              Verantwortlich und Ansprechpartner für Fragen zum Datenschutz:{' '}
              <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
