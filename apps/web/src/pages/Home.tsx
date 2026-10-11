import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { modules } from "../components/catalogue";
import { activeGroups } from "../App";
import { getJson, modelOf, useSite } from "../lib/api";
import { usePageMeta } from "../lib/meta";
import { FEATURED_EXPERTS, GROUP_IMAGE } from "../lib/visuals";
import { ExpertCard } from "./Team";
import { Loading } from "./Static";

export function Home() {
  const { data: site, loading } = useSite();
  const [stats, setStats] = useState<{
    modules: number;
    hours: number;
    exercises: number;
  } | null>(null);
  useEffect(() => {
    getJson<{ modules: number; hours: number; exercises: number }>(
      "/content/stats.json",
    ).then(setStats, () => setStats(null));
  }, []);
  usePageMeta(
    "Motivado – Coaching per Video",
    "Interaktives Video-Coaching mit Experten zu Beziehung, Gesundheit, Karriere und Erziehung: individuell, in Ihrem Tempo, wann und wo Sie möchten.",
  );
  if (!site) return <Loading loading={loading} />;

  const groups = activeGroups(site);
  const launched = site.products.filter((p) => site.launch.includes(p.slug));
  // four experts, one per topic: relationships, health, career, education
  const experts = FEATURED_EXPERTS.flatMap((id) =>
    site.experts.filter((e) => e.id === id),
  );
  const sample = launched
    .flatMap((p) => p.coachings)
    .map((k) => modelOf(site, k))
    .find(Boolean);

  return (
    <>
      <section className="hero" aria-labelledby="hero-h">
        <div className="wrap hero__text">
          <h1 id="hero-h">
            Persönliches Coaching, <em>wann Sie es brauchen.</em>
          </h1>
          <p className="lead">
            Motivado bringt Experten zu Ihnen nach Hause: in kurzen Videos, mit
            Fragen und Übungen, die sich Ihrer Situation anpassen. Besser als
            ein Buch, flexibler als ein Seminar.
          </p>
          <div className="hero__actions">
            {sample && (
              <Link className="button" to={`/coaching/${sample}`}>
                Coaching ausprobieren
              </Link>
            )}
          </div>
        </div>
        <div className="wrap claims">
          <div className="claim">
            <img src="/img/icons/video.png" alt="" width="64" height="64" />
            <div>
              <h2 className="claim__title">Coaching per Video</h2>
              <p>Experten erklären Schritt für Schritt, was wirklich hilft.</p>
            </div>
          </div>
          <div className="claim">
            <img
              src="/img/icons/fortschritt.png"
              alt=""
              width="64"
              height="64"
            />
            <div>
              <h2 className="claim__title">Übungen mit Wirkung</h2>
              <p>
                Fragen, Checklisten und Aufgaben machen aus Wissen Gewohnheit.
              </p>
            </div>
          </div>
          <div className="claim">
            <img src="/img/icons/haende.png" alt="" width="64" height="64" />
            <div>
              <h2 className="claim__title">Individuell für Sie</h2>
              <p>Ihre Antworten bestimmen, wie es weitergeht.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="wrap section" id="themen" aria-labelledby="themen-h">
        <div className="section__head">
          <h2 id="themen-h">Wobei dürfen wir helfen?</h2>
        </div>
        <div className="topics">
          {groups.map((g) => {
            const products = launched.filter((p) =>
              p.category.startsWith(g.slug),
            );
            const coachings = new Set(
              products.flatMap((p) =>
                p.coachings.map((k) => modelOf(site, k)).filter(Boolean),
              ),
            );
            const image = GROUP_IMAGE[g.slug];
            return (
              <Link key={g.slug} className="topic" to={`/themen/${g.slug}`}>
                {image && (
                  <div className="topic__image">
                    <img src={image} alt="" loading="lazy" />
                  </div>
                )}
                <div className="topic__body">
                  <h3>{g.title}</h3>
                  <span className="topic__list">
                    {products
                      .slice(0, 3)
                      .map((p) => p.title)
                      .join(" · ")}
                  </span>
                  <span className="topic__count">
                    {modules(coachings.size)} →
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="band band--teal" aria-labelledby="how-h">
        <div className="wrap">
          <p className="eyebrow">In drei Schritten</p>
          <h2 id="how-h">So funktioniert Motivado</h2>
          <div className="steps">
            <div className="step">
              <h3>Situation schildern</h3>
              <p>
                Sie beantworten ein paar Fragen. Daraus entsteht Ihr
                persönlicher Weg durch das Coaching.
              </p>
            </div>
            <div className="step">
              <h3>Von Experten lernen</h3>
              <p>
                Kurze Videos erklären, was wirklich hilft, mit Beispielen aus
                der Praxis statt Theorie.
              </p>
            </div>
            <div className="step">
              <h3>Üben und umsetzen</h3>
              <p>
                Übungen und Checklisten machen aus Wissen Gewohnheit. Sie
                bestimmen das Tempo.
              </p>
            </div>
          </div>
        </div>
      </section>

      {stats && (
        <section className="band band--paper" aria-labelledby="facts-h">
          <div className="wrap">
            <p className="eyebrow">Zahlen und Fakten</p>
            <h2 id="facts-h">Motivado in Zahlen</h2>
            <div className="facts">
              <div className="fact">
                <span className="fact__number">{stats.modules}</span>
                <span className="fact__label">Module</span>
              </div>
              <div className="fact">
                <span className="fact__number">{stats.hours}</span>
                <span className="fact__label">Stunden Videomaterial</span>
              </div>
              <div className="fact">
                <span className="fact__number">{stats.exercises}</span>
                <span className="fact__label">Übungen</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {experts.length > 0 && (
        <section className="wrap section" aria-labelledby="experts-h">
          <div className="section__head">
            <h2 id="experts-h">Unsere Experten</h2>
            <Link to="/team">Alle Experten</Link>
          </div>
          <div className="experts">
            {experts.map((e) => (
              <ExpertCard key={e.id} expert={e} />
            ))}
          </div>
        </section>
      )}

      {sample && (
        <section className="band band--accent" aria-label="Ausprobieren">
          <div className="wrap band__row">
            <h2>
              Probieren Sie es aus: das erste Coaching ist nur wenige Minuten
              entfernt.
            </h2>
            <Link className="button button--light" to={`/coaching/${sample}`}>
              Jetzt starten
            </Link>
          </div>
        </section>
      )}
    </>
  );
}
