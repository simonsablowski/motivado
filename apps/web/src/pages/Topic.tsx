import { Link, useParams } from 'react-router-dom';
import { modelOf, useSite } from '../lib/api';
import { Loading, NotFound } from './Static';

export function Topic() {
  const { group } = useParams();
  const { data: site, loading } = useSite();
  if (!site) return <Loading loading={loading} />;

  const g = site.groups.find((x) => x.slug === group);
  if (!g) return <NotFound />;

  const products = site.products.filter((p) => site.launch.includes(p.slug) && p.category.startsWith(g.slug));
  const categories = site.categories
    .filter((c) => c.group === g.slug && products.some((p) => p.category === c.path))
    .sort((a, b) => a.title.localeCompare(b.title, 'de'));
  const groupCategory = site.categories.find((c) => c.path === g.slug);

  return (
    <div className="wrap">
      <div className="page-head">
        <p className="crumbs">
          <Link to="/">Start</Link> / {g.title}
        </p>
        <h1>{g.title}</h1>
        {groupCategory?.description && <p className="lead">{groupCategory.description.split('\n')[0]}</p>}
      </div>

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
  );
}
