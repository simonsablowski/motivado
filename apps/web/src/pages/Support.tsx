import { Link } from 'react-router-dom';
import { usePageMeta } from '../lib/meta';
import { SITE } from '../site.config';
import { Crumbs } from '../components/Crumbs';
import { NotFound } from './Static';

/** Voluntary support: everything stays free, a small contribution covers domain and server costs. */
export function Support() {
  usePageMeta(
    'Motivado unterstützen',
    'Motivado ist kostenlos. Wenn es Ihnen weitergeholfen hat, freue ich mich über einen kleinen freiwilligen Beitrag.',
  );
  if (!SITE.supportUrl) return <NotFound />;
  return (
    <>
      <Crumbs>
        <Link to="/">Start</Link> / Motivado unterstützen
      </Crumbs>
      <section className="topic-hero" aria-labelledby="support-h">
        <div className="wrap support">
          <h1 id="support-h">Motivado unterstützen</h1>
          <p className="lead">
            Motivado ist kostenlos, und das soll so bleiben. Wenn die Videos, Übungen oder Artikel Ihnen weitergeholfen
            haben, freue ich mich über einen kleinen Beitrag.
          </p>
          <a className="button" href={SITE.supportUrl} rel="noopener noreferrer" target="_blank">
            Jetzt unterstützen
          </a>
          <p className="hint support__note">
            Sie wählen den Betrag selbst. Bezahlt wird über {SITE.supportProvider}; dafür verlassen Sie diese Website.
          </p>
        </div>
      </section>

      <section className="wrap section support__cols" aria-label="Wofür das Geld gebraucht wird">
        <div className="tile tile--tint">
          <h2>Wofür</h2>
          <p>
            Motivado ist seit 2009 online. Die Domain und in den letzten Jahren auch Hosting und Speicher für die Videos
            haben Geld gekostet. Ihr Beitrag deckt diese Kosten und hilft, die Inhalte online zu halten und zu pflegen.
          </p>
        </div>
        <div className="tile tile--soft">
          <h2>Gut zu wissen</h2>
          <ul className="checks">
            <li>Der Beitrag ist freiwillig. Alle Inhalte bleiben für alle kostenlos.</li>
            <li>Sie bekommen dafür keine Gegenleistung und keinen Zugang zu zusätzlichen Inhalten.</li>
            <li>Es gibt keine Spendenquittung, denn Motivado ist kein gemeinnütziger Verein.</li>
          </ul>
          <p>
            Fragen? Schreiben Sie an <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>.
          </p>
        </div>
      </section>
    </>
  );
}
