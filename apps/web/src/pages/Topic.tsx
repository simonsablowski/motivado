import { Link, useParams } from 'react-router-dom';
import { modelOf, useSite } from '../lib/api';
import { usePageMeta } from '../lib/meta';
import { GROUP_IMAGE } from '../lib/visuals';
import { Loading, NotFound } from './Static';

export function Topic() {
  const { group } = useParams();
  const { data: site, loading } = useSite();
  const g = site?.groups.find((x) => x.slug === group);
  const groupDescription = site?.categories.find((c) => c.path === group)?.description.split('\n')[0];
  usePageMeta(
    g ? `${g.title}: Coachings` : 'Motivado',
    groupDescription || (g ? `Video-Coachings zum Thema ${g.title}.` : undefined),
  );
  if (!site) return <Loading loading={loading} />;
  if (!g) return <NotFound />;

  const products = site.products.filter((p) => site.launch.includes(p.slug) && p.category.startsWith(g.slug));
  const categories = site.categories
    .filter((c) => c.group === g.slug && products.some((p) => p.category === c.path))
    .sort((a, b) => a.title.localeCompare(b.title, 'de'));
  const groupCategory = site.categories.find((c) => c.path === g.slug);
  const image = GROUP_IMAGE[g.slug];

  return (
    <>
      <div className="page-banner">
        <div className="wrap page-banner__grid">
          <div className="page-banner__text">
            <p className="crumbs">
              <Link to="/">Start</Link> / {g.title}
            </p>
            <h1>{g.title}</h1>
            {groupCategory?.description && <p className="lead">{groupCategory.description.split('\n')[0]}</p>}
          </div>
          {image && (
            <div className="page-banner__image">
              <img src={image} alt="" />
            </div>
          )}
        </div>
      </div>

      <div className="wrap">
        {site.featured
          .filter((f) => f.group === g.slug && site.available.has(f.coaching))
          .map((f) => (
            <section className="section" key={f.coaching} aria-label={f.title}>
              <div className="offer">
                <div>
                  <p className="eyebrow">Schnell-Check</p>
                  <h2>{f.title}</h2>
                  <p className="offer__label" style={{ marginTop: 8 }}>
                    {f.text}
                  </p>
                </div>
                <Link className="button" to={`/coaching/${f.coaching}`}>
                  Jetzt starten
                </Link>
              </div>
            </section>
          ))}
        {categories.map((c) => (
          <section className="section" key={c.path} aria-labelledby={`c-${c.slug}`}>
            <div className="section__head">
              <h2 id={`c-${c.slug}`}>{c.title}</h2>
            </div>
            <ul className="list">
              {products
                .filter((p) => p.category === c.path)
                .map((p) => {
                  const n = p.coachings.filter((k) => modelOf(site, k)).length;
                  return (
                    <li className="list__item" key={p.slug}>
                      <div>
                        <Link className="list__title" to={`/paket/${p.slug}`}>
                          {p.title}
                        </Link>
                        {p.subtitle && <p className="list__sub">{p.subtitle}</p>}
                      </div>
                      <span className="list__meta">{n} Coachings</span>
                    </li>
                  );
                })}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
