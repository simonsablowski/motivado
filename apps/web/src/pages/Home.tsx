import { Link } from 'react-router-dom';
import { activeGroups } from '../App';
import { modelOf, useSite } from '../lib/api';
import { Loading } from './Static';

export function Home() {
  const { data: site, loading } = useSite();
  if (!site) return <Loading loading={loading} />;

  const groups = activeGroups(site);
  const launched = site.products.filter((p) => site.launch.includes(p.slug));
  const experts = site.experts.filter((e) => launched.some((p) => p.experts.includes(e.id)));
  const sample = launched.flatMap((p) => p.coachings).map((k) => modelOf(site, k)).find(Boolean);

  return (
    <>
      <div className="wrap hero">
        <p className="eyebrow">Coaching per Video</p>
        <h1>Ein Coach, der auf Sie eingeht.</h1>
        <p className="lead">
          Motivado bringt Experten zu Ihnen nach Hause: in kurzen Videos, mit Fragen und Übungen, die sich Ihrer
          Situation anpassen. Besser als ein Buch, flexibler als ein Seminar.
        </p>
        <div className="hero__actions">
          <a className="button" href="#themen">
            Themen entdecken
          </a>
          {sample && (
            <Link className="button button--quiet" to={`/coaching/${sample}`}>
              Coaching ausprobieren
            </Link>
          )}
        </div>
      </div>

      <section className="wrap section" id="themen" aria-labelledby="themen-h">
        <div className="section__head">
          <h2 id="themen-h">Wobei dürfen wir helfen?</h2>
        </div>
        <div className="topics">
          {groups.map((g) => {
            const products = launched.filter((p) => p.category.startsWith(g.slug));
            const coachings = new Set(products.flatMap((p) => p.coachings.map((k) => modelOf(site, k)).filter(Boolean)));
            return (
              <Link key={g.slug} className="topic" to={`/themen/${g.slug}`}>
                <h3>{g.title}</h3>
                <span>{products.slice(0, 3).map((p) => p.title).join(' · ')}</span>
                <span className="topic__count">
                  {coachings.size} Coachings <span className="topic__arrow">→</span>
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="wrap section" aria-labelledby="how-h">
        <div className="section__head">
          <h2 id="how-h">So funktioniert Motivado</h2>
        </div>
        <div className="steps">
          <div className="step">
            <h3>Situation schildern</h3>
            <p>Sie beantworten ein paar Fragen. Daraus entsteht Ihr persönlicher Weg durch das Coaching.</p>
          </div>
          <div className="step">
            <h3>Von Experten lernen</h3>
            <p>Kurze Videos erklären, was wirklich hilft, mit Beispielen aus der Praxis statt Theorie.</p>
          </div>
          <div className="step">
            <h3>Üben und umsetzen</h3>
            <p>Übungen und Checklisten machen aus Wissen Gewohnheit. Sie bestimmen das Tempo.</p>
          </div>
        </div>
      </section>

      {experts.length > 0 && (
        <section className="wrap section" aria-labelledby="experts-h">
          <div className="section__head">
            <h2 id="experts-h">Unsere Experten</h2>
            <Link to="/team">Alle Experten</Link>
          </div>
          <div className="experts">
            {experts.map((e) => (
              <div className="expert" key={e.id}>
                <h3>{e.name}</h3>
                <p>{e.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
