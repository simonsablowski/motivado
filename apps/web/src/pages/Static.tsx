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
 * Legal pages. The operator's details live in site.config.ts (§ 5 DDG, DSGVO).
 */
export function Legal({ page }: { page: 'impressum' | 'datenschutz' }) {
  const impressum = page === 'impressum';
  return (
    <div className="wrap--narrow">
      <div className="page-head">
        <h1>{impressum ? 'Impressum' : 'Datenschutz'}</h1>
      </div>
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
  );
}
