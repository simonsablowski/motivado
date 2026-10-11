import { Link, useParams } from 'react-router-dom';
import { Box, Bundle, ExpertsBox, introOf } from '../components/catalogue';
import { useSite } from '../lib/api';
import { usePageMeta } from '../lib/meta';
import { topicSections } from '../lib/sections';
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
  const experts = site.experts.filter(
    (e) => extra.includes(e.id) || products.some((p) => p.experts.includes(e.id)),
  );
  const featured = site.featured.filter((f) => f.group === g.slug && site.available.has(f.coaching));
  const ratgeber = RATGEBER[g.slug];
  const lead = groupDescription;

  // The legacy categories of one topic often share the same introduction: show it once.
  const texts = new Set(categories.map((c) => c.description.trim()).filter(Boolean));
  const sharedIntro = categories.length > 1 && texts.size === 1 ? introOf([...texts][0] as string) : null;

  return (
    <>
      <div className="page-banner">
        <div className="wrap page-banner__grid">
          <div className="page-banner__text">
            <Crumbs>
              <Link to="/">Start</Link> / {g.title}
            </Crumbs>
            <h1>{g.title}</h1>
            {lead && <p className="lead">{lead}</p>}
          </div>
        </div>
      </div>

      <div className="wrap layout">
        <div className="stack">
          {featured.map((f) => (
            <div className="intro" key={f.coaching}>
              <h2>{f.title}</h2>
              <p>{f.text}</p>
              <Link className="button" to={`/coaching/${f.coaching}`}>
                Jetzt starten
              </Link>
            </div>
          ))}

          {sharedIntro && (
            <div className="intro">
              <h2>{sharedIntro.headline || g.title}</h2>
              {sharedIntro.paragraphs.map((t, i) => (
                <p key={i}>{t}</p>
              ))}
              {benefits(sharedIntro.bullets).length > 0 && (
                <ul className="points">
                  {benefits(sharedIntro.bullets).map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {sections.map((c) => {
            const own = sharedIntro || !c.intro ? null : introOf(c.intro);
            const count = c.products.length;
            return (
              <section className="category" id={c.id} key={c.id} aria-labelledby={`c-${c.id}`}>
                {own && (own.paragraphs.length > 0 || benefits(own.bullets).length > 0) ? (
                  <div className="intro">
                    <h2 id={`c-${c.id}`}>{own.headline || c.title}</h2>
                    {own.paragraphs.map((t, i) => (
                      <p key={i}>{t}</p>
                    ))}
                    {benefits(own.bullets).length > 0 && (
                      <ul className="points">
                        {benefits(own.bullets).map((b, i) => (
                          <li key={i}>{b}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : (
                  <div className="section__head">
                    <h2 id={`c-${c.id}`}>{c.title}</h2>
                    <span className="hint">{count === 1 ? '1 Paket' : `${count} Pakete`}</span>
                  </div>
                )}
                {c.products.map((p) => (
                  <Bundle key={p.slug} site={site} product={p} group={g.slug} />
                ))}
              </section>
            );
          })}
        </div>

        <aside className="layout__side" aria-label="Zusatzinformationen">
          <ExpertsBox experts={experts} />
          {ratgeber && (
            <Box title="Zum Nachlesen" accent>
              <p>Hintergrundwissen und Tipps rund um dieses Thema, kostenlos und ohne Anmeldung.</p>
              <Link className="button button--quiet" to={`/ratgeber/${ratgeber.topic}`}>
                {ratgeber.label}
              </Link>
            </Box>
          )}
        </aside>
      </div>
    </>
  );
}
