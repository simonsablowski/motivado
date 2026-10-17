import { Link, useParams } from 'react-router-dom';
import { PackageCard, introOf, modules } from '../components/catalogue';
import { modelOf, useSite } from '../lib/api';
import { usePageMeta } from '../lib/meta';
import { topicSections } from '../lib/sections';
import { GROUP_IMAGE, expertPhoto } from '../lib/visuals';
import { Loading, NotFound } from './Static';
import { Crumbs } from '../components/Crumbs';

const RATGEBER: Record<string, { topic: string; label: string }> = {
  beziehung: { topic: 'beziehung', label: 'Ratgeber Beziehung' },
  gesundheit: { topic: 'abnehmen', label: 'Ratgeber Abnehmen' },
  karriere: { topic: 'bewerbung', label: 'Ratgeber Bewerbung' },
  erziehung: { topic: 'erziehung', label: 'Ratgeber Erziehung' },
};

/** Experts shown on a topic page in addition to those of its packages (expert ids). */
const EXTRA_EXPERTS: Record<string, number[]> = { beziehung: [7], karriere: [7] };

/** The legacy lists end with "... und vieles mehr!" and run to five items: show the first three real ones. */
const benefits = (bullets: string[]) => bullets.filter((b) => !/^(\.{3}|…)/.test(b)).slice(0, 3);

export function Topic() {
  const { group } = useParams();
  const { data: site, loading } = useSite();
  const g = site?.groups.find((x) => x.slug === group);
  const groupDescription = site?.categories.find((c) => c.path === group)?.description.split('\n')[0];
  usePageMeta(
    g ? `${g.title}: Module` : 'Motivado',
    groupDescription || (g ? `Interaktives Video-Coaching zum Thema ${g.title}.` : undefined),
  );
  if (!site) return <Loading loading={loading} />;
  if (!g) return <NotFound />;

  const products = site.products.filter((p) => site.launch.includes(p.slug) && p.category.startsWith(g.slug));
  const sections = topicSections(site, g.slug);
  const categories = site.categories.filter((c) => c.group === g.slug && products.some((p) => p.category === c.path));
  const extra = EXTRA_EXPERTS[g.slug] ?? [];
  const experts = site.experts.filter((e) => extra.includes(e.id) || products.some((p) => p.experts.includes(e.id)));
  const featured = site.featured.find((f) => f.group === g.slug && site.available.has(f.coaching));
  const ratgeber = RATGEBER[g.slug];
  const image = GROUP_IMAGE[g.slug];
  const moduleCount = new Set(products.flatMap((p) => p.coachings.map((k) => modelOf(site, k)).filter(Boolean))).size;

  // The legacy categories of one topic often share the same introduction: show it once.
  const texts = new Set(categories.map((c) => c.description.trim()).filter(Boolean));
  const sharedIntro = categories.length > 1 && texts.size === 1 ? introOf([...texts][0] as string) : null;
  const firstOwn = sections
    .map((c) => (c.intro ? introOf(c.intro) : null))
    .find((i) => i && benefits(i.bullets).length);
  const points = benefits((sharedIntro ?? firstOwn)?.bullets ?? []);
  const lead = groupDescription || (sharedIntro ?? firstOwn)?.paragraphs[0];

  return (
    <>
      <Crumbs>
        <Link to="/">Start</Link> / {g.title}
      </Crumbs>
      <section className="topic-hero" aria-labelledby="topic-h">
        <div className="wrap topic-hero__grid">
          <div>
            <h1 id="topic-h">{g.title}</h1>
            {lead && <p className="lead">{lead}</p>}
            {points.length > 0 && (
              <ul className="checks">
                {points.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            )}
            <div className="hero__actions">
              {featured ? (
                <Link className="button" to={`/coaching/${featured.coaching}`}>
                  Jetzt starten
                </Link>
              ) : (
                sections[0] && (
                  <a className="button" href={`#${sections[0].id}`}>
                    Passendes Paket finden
                  </a>
                )
              )}
              <span className="hint">
                {products.length === 1 ? '1 Paket' : `${products.length} Pakete`} · {modules(moduleCount)}
              </span>
            </div>
          </div>
          {image && <img className="topic-hero__image" src={image} alt="" />}
        </div>
      </section>

      {sections.length > 1 && (
        <nav className="wrap jump" aria-label="Springen zu">
          <span className="jump__label">Springen zu</span>
          {sections.map((c) => (
            <a className="pill-link" href={`#${c.id}`} key={c.id}>
              {c.title}
            </a>
          ))}
        </nav>
      )}

      {sections.map((c) => {
        const own = sharedIntro || !c.intro ? null : introOf(c.intro);
        const sub = own?.paragraphs[0] && own.paragraphs[0].length <= 150 ? own.paragraphs[0] : '';
        return (
          <section className="wrap section topic-section" id={c.id} key={c.id} aria-labelledby={`c-${c.id}`}>
            <div className="section__head">
              <div>
                <h2 id={`c-${c.id}`}>{c.title}</h2>
                {sub && <p className="section__sub">{sub}</p>}
              </div>
            </div>
            <div className="pcards">
              {c.products.map((p) => (
                <PackageCard key={p.slug} site={site} product={p} group={g.slug} />
              ))}
            </div>
          </section>
        );
      })}

      <section className="wrap section topic-aside" aria-label="Zusatzinformationen">
        {experts.length > 0 && (
          <div className="tile tile--tint">
            <p className="eyebrow">{experts.length > 1 ? 'Unsere Experten' : 'Ihr Experte'}</p>
            <div className="tile__people">
              {experts.slice(0, 3).map((e) => (
                <div className="tile__person" key={e.id}>
                  <img src={expertPhoto(e.name)} alt="" loading="lazy" />
                  <div>
                    <strong>{e.name}</strong>
                    <span>{e.description}</span>
                  </div>
                </div>
              ))}
            </div>
            <Link to="/team">Alle Experten →</Link>
          </div>
        )}
        {ratgeber && (
          <div className="tile tile--soft">
            <p className="eyebrow">Ratgeber</p>
            <h2>Zum Nachlesen</h2>
            <p>Hintergrundwissen und Tipps rund um dieses Thema, kostenlos und ohne Anmeldung.</p>
            <Link to={`/ratgeber/${ratgeber.topic}`}>{ratgeber.label} →</Link>
          </div>
        )}
      </section>
    </>
  );
}
