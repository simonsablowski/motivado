import { Link, useParams } from 'react-router-dom';
import { ExpertsBox, ProductImage, modules } from '../components/catalogue';
import { coachingTitle, modelOf, useSite } from '../lib/api';
import { usePageMeta } from '../lib/meta';
import { hasProgress } from '../lib/store';
import { Loading, NotFound } from './Static';
import { Crumbs } from '../components/Crumbs';

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
  const lines = product.description
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !/^\(s\.u\.\)$/i.test(l));
  // consecutive "•" lines form one list, everything else is a paragraph
  const blocks: ({ text: string } | { items: string[] })[] = [];
  for (const line of lines) {
    if (line.startsWith('•')) {
      const item = line.replace(/^•\s*/, '');
      const last = blocks[blocks.length - 1];
      if (last && 'items' in last) last.items.push(item);
      else blocks.push({ items: [item] });
    } else blocks.push({ text: line });
  }

  return (
    <>
      <div className="page-banner">
        <div className="wrap page-banner__grid">
          <div className="page-banner__text">
            <Crumbs>
              <Link to="/">Start</Link> / {group && <Link to={`/themen/${group.slug}`}>{group.title}</Link>}
              {category && category.path !== group?.slug && <> / {category.title}</>}
            </Crumbs>
            <h1>{product.title}</h1>
            {product.subtitle && <p className="lead">{product.subtitle}</p>}
          </div>
        </div>
      </div>

      <div className="wrap layout">
        <div>
          <div className="product-head">
            <div className="prose">
              {experts.length > 0 && (
                <div className="bundle__people" style={{ marginTop: 0 }}>
                  {experts.map((e) => (
                    <span className="chip" key={e.id}>
                      {e.name}
                    </span>
                  ))}
                </div>
              )}
              {blocks.map((b, i) =>
                'items' in b ? (
                  <ul key={i}>
                    {b.items.map((item, j) => (
                      <li key={j}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p key={i}>{b.text}</p>
                ),
              )}
            </div>
            <ProductImage product={product} group={group?.slug} className="product-head__image" />
          </div>

          <div className="strip">
            <div className="strip__item">Interaktives Video-Coaching</div>
            <div className="strip__item">Übungen, Checklisten und Tipps</div>
            <div className="strip__item">In Ihrem Tempo, jederzeit</div>
          </div>

          <section className="section" aria-labelledby="pkg-h">
            <div className="section__head">
              <h2 id="pkg-h">Das Paket enthält {modules(product.coachings.length)}</h2>
            </div>
            <ol className="cards" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {product.coachings.map((k, i) => {
                const model = modelOf(site, k);
                const meta = site.coachings[k];
                return (
                  <li className="card" key={k}>
                    <div className="card__body">
                      <span className="card__no">{String(i + 1).padStart(2, '0')}</span>
                      <h3>{coachingTitle(site, model ?? k)}</h3>
                      {meta?.subtitle && <span className="card__sub">{meta.subtitle}</span>}
                      {meta?.description && <p className="card__text">{meta.description.split('\n')[0]}</p>}
                      <div className="card__action">
                        {model ? (
                          <Link className="button button--quiet" to={`/coaching/${model}`}>
                            {hasProgress(model) ? 'Fortsetzen' : 'Starten'}
                          </Link>
                        ) : (
                          <span className="tag">In Vorbereitung</span>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        </div>

        <aside className="layout__side" aria-label="Zusatzinformationen">
          <ExpertsBox experts={experts} title={experts.length > 1 ? 'Ihre Experten' : 'Ihr Experte'} />
        </aside>
      </div>
    </>
  );
}
