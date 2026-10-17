import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PackageCard, ProductImage, modules } from '../components/catalogue';
import { coachingTitle, modelOf, useSite } from '../lib/api';
import { usePageMeta } from '../lib/meta';
import { hasProgress } from '../lib/store';
import { expertPhoto } from '../lib/visuals';
import { Loading, NotFound } from './Static';
import { Crumbs } from '../components/Crumbs';

const SHOWN = 6;

export function ProductPage() {
  const { slug } = useParams();
  const { data: site, loading } = useSite();
  const [all, setAll] = useState(false);
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

  const entries = product.coachings.map((k) => ({ k, model: modelOf(site, k) }));
  const first = entries.find((e) => e.model)?.model;
  const started = first ? hasProgress(first) : false;
  const shown = all ? entries : entries.slice(0, SHOWN);
  const related = site.products
    .filter((p) => p.slug !== product.slug && site.launch.includes(p.slug) && p.category === product.category)
    .slice(0, 3);

  return (
    <>
      <Crumbs>
        <Link to="/">Start</Link> / {group && <Link to={`/themen/${group.slug}`}>{group.title}</Link>}
        {category && category.path !== group?.slug && <> / {category.title}</>} / {product.title}
      </Crumbs>

      <div className="wrap product">
        <div className="product__main">
          <ProductImage product={product} group={group?.slug} className="product__image" />
          <p className="pill">Paket{group ? ` · ${group.title}` : ''}</p>
          <h1>{product.title}</h1>
          {product.subtitle && <p className="lead">{product.subtitle}</p>}
          <div className="prose">
            {blocks.map((b, i) =>
              'items' in b ? (
                <ul className="checks" key={i}>
                  {b.items.map((item, j) => (
                    <li key={j}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p key={i}>{b.text}</p>
              ),
            )}
          </div>
        </div>

        <aside className="product__panel" aria-label="Paket starten">
          <div className="buybox">
            <p className="buybox__title">{modules(entries.length)}</p>
            <p className="buybox__text">Interaktives Video-Coaching, in Ihrem Tempo und jederzeit fortsetzbar.</p>
            {first && (
              <Link className="button button--block" to={`/coaching/${first}`}>
                {started ? 'Fortsetzen' : 'Jetzt starten'}
              </Link>
            )}
            <ul className="buybox__list">
              <li>{modules(entries.length)} mit Video-Coaching</li>
              <li>Fragen und Übungen für Ihre Situation</li>
              <li>Checklisten und Tipps</li>
              <li>In Ihrem Tempo, jederzeit</li>
            </ul>
          </div>
        </aside>
      </div>

      <section className="band band--soft modules-band" aria-labelledby="pkg-h">
        <div className="wrap modules-band__grid">
          <div>
            <h2 id="pkg-h">Das Paket enthält {modules(entries.length)}</h2>
            <p className="section__sub">Beginnen Sie, wo Sie möchten. Ihr Fortschritt wird gespeichert.</p>
            <ol className="rows">
              {shown.map(({ k, model }, i) => {
                const meta = site.coachings[k];
                const title = coachingTitle(site, model ?? k);
                const row = (
                  <>
                    <span className="rows__no">{i + 1}</span>
                    <span className="rows__text">
                      <span className="rows__title">{title}</span>
                      {meta?.subtitle && <span className="rows__sub">{meta.subtitle}</span>}
                    </span>
                    {model ? (
                      <span className="rows__go">{hasProgress(model) ? 'Fortsetzen' : 'Starten'} →</span>
                    ) : (
                      <span className="tag">In Vorbereitung</span>
                    )}
                  </>
                );
                return (
                  <li key={k}>
                    {model ? (
                      <Link className="rows__row" to={`/coaching/${model}`}>
                        {row}
                      </Link>
                    ) : (
                      <div className="rows__row">{row}</div>
                    )}
                  </li>
                );
              })}
            </ol>
            {entries.length > SHOWN && (
              <button type="button" className="button button--ghost" onClick={() => setAll(!all)}>
                {all ? 'Weniger anzeigen' : `Weitere ${entries.length - SHOWN} Module anzeigen`}
              </button>
            )}
          </div>
          {experts.length > 0 && (
            <div className="tile">
              <p className="eyebrow">{experts.length > 1 ? 'Ihre Experten' : 'Ihr Experte'}</p>
              {experts.map((e) => (
                <div className="tile__person tile__person--stack" key={e.id}>
                  <img src={expertPhoto(e.name)} alt="" loading="lazy" />
                  <div>
                    <strong>{e.name}</strong>
                    <span>{e.description}</span>
                  </div>
                </div>
              ))}
              <Link to="/team">Alle Experten →</Link>
            </div>
          )}
        </div>
      </section>

      {related.length > 0 && (
        <section className="wrap section" aria-labelledby="related-h">
          <div className="section__head">
            <h2 id="related-h">Dazu passt</h2>
          </div>
          <div className="pcards pcards--3">
            {related.map((p) => (
              <PackageCard key={p.slug} site={site} product={p} group={group?.slug} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
