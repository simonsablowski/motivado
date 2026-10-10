import { Link, useParams } from 'react-router-dom';
import { coachingTitle, modelOf, useSite } from '../lib/api';
import { usePageMeta } from '../lib/meta';
import { hasProgress } from '../lib/store';
import { GROUP_IMAGE, expertPhoto } from '../lib/visuals';
import { Loading, NotFound } from './Static';

export function ProductPage() {
  const { slug } = useParams();
  const { data: site, loading } = useSite();
  const product = site?.products.find((p) => p.slug === slug && site.launch.includes(p.slug));
  usePageMeta(product ? product.title : 'Motivado', product ? product.description.split('\n')[0] : undefined);
  if (!site) return <Loading loading={loading} />;
  if (!product) return <NotFound />;

  const group = site.groups.find((g) => product.category.startsWith(g.slug));
  const category = site.categories.find((c) => c.path === product.category);
  const experts = site.experts.filter((e) => product.experts.includes(e.id));
  const playable = product.coachings.filter((k) => modelOf(site, k)).length;

  return (
    <>
      <div className="page-banner">
        <div className="wrap page-banner__grid">
          <div className="page-banner__text">
            <p className="crumbs">
              <Link to="/">Start</Link> / {group && <Link to={`/themen/${group.slug}`}>{group.title}</Link>}
              {category && <> / {category.title}</>}
            </p>
            <h1>{product.title}</h1>
            {product.subtitle && <p className="lead">{product.subtitle}</p>}
          </div>
          {group && GROUP_IMAGE[group.slug] && (
            <div className="page-banner__image">
              <img src={GROUP_IMAGE[group.slug]} alt="" />
            </div>
          )}
        </div>
      </div>
      <div className="wrap">
      <div className="product-layout section">
        <div>
          <div className="prose">
            {product.description.split('\n').map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>

          <div className="section__head" style={{ marginTop: 48 }}>
            <h2>{product.coachings.length} Coachings</h2>
            <span className="hint">{playable} davon jetzt verfügbar</span>
          </div>
          <ol className="list" style={{ listStyle: 'none' }}>
            {product.coachings.map((k) => {
              const model = modelOf(site, k);
              const meta = site.coachings[k];
              return (
                <li className="list__item" key={k}>
                  <div>
                    {model ? (
                      <Link className="list__title" to={`/coaching/${model}`}>
                        {coachingTitle(site, model)}
                      </Link>
                    ) : (
                      <span className="list__title">{coachingTitle(site, k)}</span>
                    )}
                    {meta?.subtitle && <p className="list__sub">{meta.subtitle}</p>}
                  </div>
                  {model ? (
                    <Link className="button button--quiet" to={`/coaching/${model}`}>
                      {hasProgress(model) ? 'Fortsetzen' : 'Starten'}
                    </Link>
                  ) : (
                    <span className="tag">In Vorbereitung</span>
                  )}
                </li>
              );
            })}
          </ol>
        </div>

        <aside className="aside" aria-label="Paket">
          <h3>Das Paket</h3>
          <p className="hint" style={{ margin: '8px 0 16px' }}>
            {product.coachings.length} interaktive Video-Coachings mit {experts.map((e) => e.name).join(', ') || 'unseren Experten'}.
          </p>
          <Link className="button" to={`/bestellen/${product.slug}`}>
            Paket anfragen
          </Link>
          {experts.map((e) => (
            <div className="expert expert--plain" key={e.id} style={{ marginTop: 24 }}>
              <img className="expert__photo" src={expertPhoto(e.name)} alt={e.name} />
              <h3 style={{ marginTop: 12 }}>{e.name}</h3>
              <p>{e.description}</p>
            </div>
          ))}
        </aside>
      </div>
      </div>
    </>
  );
}
