import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PackageCard, modules } from '../components/catalogue';
import { activeGroups } from '../App';
import { getJson, modelOf, useSite } from '../lib/api';
import { usePageMeta } from '../lib/meta';
import { FEATURED_EXPERTS, GROUP_IMAGE, expertPhoto } from '../lib/visuals';
import { ExpertCard } from './Team';
import { Loading } from './Static';

export function Home() {
  const { data: site, loading } = useSite();
  const [stats, setStats] = useState<{
    modules: number;
    hours: number;
    exercises: number;
  } | null>(null);
  useEffect(() => {
    getJson<{ modules: number; hours: number; exercises: number }>('/content/stats.json').then(setStats, () =>
      setStats(null),
    );
  }, []);
  usePageMeta(
    'Motivado – Coaching per Video',
    'Interaktives Video-Coaching mit Experten zu Beziehung, Gesundheit, Karriere und Erziehung: individuell, in Ihrem Tempo, wann und wo Sie möchten.',
  );
  if (!site) return <Loading loading={loading} />;

  const groups = activeGroups(site);
  const launched = site.products.filter((p) => site.launch.includes(p.slug));
  // four experts, one per topic: relationships, health, career, education
  const experts = FEATURED_EXPERTS.flatMap((id) => site.experts.filter((e) => e.id === id));
  const popular = ['flirten', 'ex-zurueck', 'online-dating']
    .map((slug) => launched.find((p) => p.slug === slug))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));
  const featuredExpert = site.experts.find((e) => e.name === 'Janina Blume');
  const sample = launched
    .flatMap((p) => p.coachings)
    .map((k) => modelOf(site, k))
    .find(Boolean);

  return (
    <>
      <section className="hero" aria-labelledby="hero-h">
        <div className="wrap hero__grid">
          <div className="hero__text">
            <p className="pill">Coaching per Video</p>
            <h1 id="hero-h">
              Persönliches Coaching, <em>wann Sie es brauchen.</em>
            </h1>
            <p className="lead">
              Erfahrene Experten sprechen direkt mit Ihnen. Sie antworten auf Fragen, und das Video passt sich Ihren
              Antworten an – in Ihrem Tempo, jederzeit und überall.
            </p>
            <div className="hero__actions">
              {sample && (
                <Link className="button" to={`/coaching/${sample}`}>
                  Coaching ausprobieren
                </Link>
              )}
              <a className="button button--ghost" href="#so-funktioniert-es">
                So funktioniert es
              </a>
            </div>
            <p className="hero__note">Interaktiv und in Ihrem Tempo · Keine Anmeldung nötig</p>
          </div>
          <div className="hero__visual">
            <img src={GROUP_IMAGE.beziehung} alt="" />
            {featuredExpert && (
              <span className="hero__badge">
                <img src={expertPhoto(featuredExpert.name)} alt="" />
                {featuredExpert.name}
              </span>
            )}
          </div>
        </div>
      </section>

      <section className="wrap section" id="themen" aria-labelledby="themen-h">
        <div className="section__head">
          <div>
            <p className="eyebrow">Themen</p>
            <h2 id="themen-h">Wobei dürfen wir helfen?</h2>
          </div>
        </div>
        <div className="topics">
          {groups.map((g) => {
            const products = launched.filter((p) => p.category.startsWith(g.slug));
            const coachings = new Set(
              products.flatMap((p) => p.coachings.map((k) => modelOf(site, k)).filter(Boolean)),
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
                      .join(' · ')}
                  </span>
                  <span className="topic__count">
                    {products.length === 1 ? '1 Paket' : `${products.length} Pakete`} · {modules(coachings.size)} →
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="band band--soft" id="so-funktioniert-es" aria-labelledby="how-h">
        <div className="wrap">
          <p className="eyebrow">So funktioniert Motivado</p>
          <h2 id="how-h">Ein Gespräch, das sich auf Sie einstellt</h2>
          <div className="steps">
            <div className="step">
              <h3>Thema wählen</h3>
              <p>Finden Sie das Paket, das zu Ihrer Situation passt, und starten Sie mit dem ersten Modul.</p>
            </div>
            <div className="step">
              <h3>Fragen beantworten</h3>
              <p>Ihr Coach stellt Fragen und zeigt Ihnen Übungen. Ihre Antworten bestimmen, wie es weitergeht.</p>
            </div>
            <div className="step">
              <h3>In Ihrem Tempo weitergehen</h3>
              <p>Pausieren, zurückgehen, später fortsetzen: Ihr Fortschritt bleibt erhalten.</p>
            </div>
          </div>
        </div>
      </section>

      {stats && (
        <section className="wrap section facts-section" aria-labelledby="facts-h">
          <div className="facts-section__intro">
            <p className="eyebrow">Zahlen und Fakten</p>
            <h2 id="facts-h">Motivado in Zahlen</h2>
            <p>Über Jahre entwickelt mit Psychologen, Therapeuten und Beratern.</p>
          </div>
          <div className="facts">
            <div className="fact">
              <span className="fact__number">{stats.modules}</span>
              <span className="fact__label">Module</span>
            </div>
            <div className="fact fact--sand">
              <span className="fact__number">{stats.hours}</span>
              <span className="fact__label">Stunden Videomaterial</span>
            </div>
            <div className="fact fact--soft">
              <span className="fact__number">{stats.exercises}</span>
              <span className="fact__label">Übungen</span>
            </div>
          </div>
        </section>
      )}

      {popular.length > 0 && (
        <section className="wrap section" aria-labelledby="popular-h">
          <div className="section__head">
            <div>
              <p className="eyebrow">Beliebt</p>
              <h2 id="popular-h">Pakete, mit denen die meisten starten</h2>
            </div>
          </div>
          <div className="pcards pcards--3">
            {popular.map((p) => (
              <PackageCard key={p.slug} site={site} product={p} group="beziehung" />
            ))}
          </div>
        </section>
      )}

      {experts.length > 0 && (
        <section className="wrap section" aria-labelledby="experts-h">
          <div className="section__head">
            <div>
              <p className="eyebrow">Experten</p>
              <h2 id="experts-h">Menschen mit Erfahrung vor der Kamera</h2>
            </div>
            <Link to="/team">Alle Experten →</Link>
          </div>
          <div className="experts">
            {experts.map((e) => (
              <ExpertCard key={e.id} expert={e} />
            ))}
          </div>
        </section>
      )}

      {sample && (
        <section className="wrap section" aria-label="Ausprobieren">
          <div className="cta">
            <h2>Probieren Sie es einfach aus.</h2>
            <p>Das erste Coaching ist nur wenige Minuten entfernt.</p>
            <Link className="button button--dark" to={`/coaching/${sample}`}>
              Jetzt starten
            </Link>
          </div>
        </section>
      )}
    </>
  );
}
