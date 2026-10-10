import { useState } from 'react';
import { Link } from 'react-router-dom';
import { coachingTitle, modelOf, type Expert, type Product, type Site } from '../lib/api';
import { hasProgress } from '../lib/store';
import { GROUP_IMAGE, expertPhoto } from '../lib/visuals';

/** Sidebar / content box with a coloured top edge. */
export function Box({
  title,
  accent,
  children,
}: {
  title?: string;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={`box${accent ? ' box--accent' : ''}`}>
      {title && <h2 className="box__title">{title}</h2>}
      {children}
    </section>
  );
}

export function People({ experts }: { experts: Expert[] }) {
  return (
    <div className="people">
      {experts.map((e) => (
        <div className="person" key={e.id}>
          <img src={expertPhoto(e.name)} alt="" loading="lazy" />
          <div>
            <h3>{e.name}</h3>
            <p>{e.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ExpertsBox({ experts, title = 'Unsere Experten' }: { experts: Expert[]; title?: string }) {
  if (experts.length === 0) return null;
  return (
    <Box title={title}>
      <People experts={experts} />
      <p style={{ margin: '14px 0 0' }}>
        <Link to="/team">Alle Experten →</Link>
      </p>
    </Box>
  );
}

/**
 * The legacy descriptions are plain text with a headline on the first line,
 * paragraphs and bullet lines ("• ..."). Split them for the introduction box.
 */
export function introOf(text: string): { headline: string; paragraphs: string[]; bullets: string[] } {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const bullets = lines.filter((l) => l.startsWith('•')).map((l) => l.replace(/^•\s*/, ''));
  const rest = lines.filter((l) => !l.startsWith('•'));
  const first = rest[0] ?? '';
  const isHeadline = first.length > 0 && first.length < 90 && !/[.!?]$/.test(first) && rest.length > 1;
  return {
    headline: isHeadline ? first : '',
    paragraphs: isHeadline ? rest.slice(1) : rest,
    bullets,
  };
}

/** Product image with a topic photo as fallback. */
export function ProductImage({ product, group, className }: { product: Product; group?: string; className?: string }) {
  const fallback = group ? GROUP_IMAGE[group] : undefined;
  return (
    <img
      className={className}
      src={`/img/products/${product.slug}.jpg`}
      alt=""
      loading="lazy"
      onError={(e) => {
        const img = e.currentTarget;
        if (fallback && !img.src.endsWith(fallback)) img.src = fallback;
      }}
    />
  );
}

function CoachingMini({ site, catalogueKey }: { site: Site; catalogueKey: string }) {
  const model = modelOf(site, catalogueKey);
  const meta = site.coachings[catalogueKey];
  const title = coachingTitle(site, model ?? catalogueKey);
  const text = meta?.subtitle || meta?.description?.split('\n')[0] || '';
  return (
    <li className="mini">
      <div className="mini__name">
        {model ? (
          <Link className="mini__title" to={`/coaching/${model}`}>
            {title}
          </Link>
        ) : (
          <span className="mini__title">{title}</span>
        )}
        {model && hasProgress(model) && <span className="tag">Begonnen</span>}
      </div>
      {text && <p className="mini__sub">{text}</p>}
    </li>
  );
}

/** A product ("Paket") as a box whose coachings fold out. */
export function Bundle({ site, product, group }: { site: Site; product: Product; group: string }) {
  const [open, setOpen] = useState(false);
  const experts = site.experts.filter((e) => product.experts.includes(e.id));
  const panel = `bundle-${product.slug}`;
  return (
    <article className="bundle">
      <div className="bundle__main">
        <Link className="bundle__media" to={`/paket/${product.slug}`} aria-label={product.title}>
          <ProductImage product={product} group={group} />
          <span className="bundle__play" aria-hidden="true" />
        </Link>
        <div>
          <h3 className="bundle__title">
            <Link to={`/paket/${product.slug}`}>
              {product.title}
              {product.subtitle && <span>{product.subtitle}</span>}
            </Link>
          </h3>
          {experts.length > 0 && (
            <div className="bundle__people">
              {experts.map((e) => (
                <span className="chip" key={e.id}>
                  <img src={expertPhoto(e.name)} alt="" loading="lazy" />
                  {e.name}
                </span>
              ))}
            </div>
          )}
          <p className="bundle__text">{product.description.split('\n')[0]}</p>
          <Link className="button" to={`/paket/${product.slug}`}>
            Zum Paket
          </Link>
        </div>
      </div>
      <div className="bundle__bar">
        <span className="bundle__count">{product.coachings.length} Coachings</span>
        <button
          type="button"
          className="toggle"
          aria-expanded={open}
          aria-controls={panel}
          onClick={() => setOpen(!open)}
        >
          {open ? 'Zuklappen' : 'Inhalte'}
        </button>
      </div>
      <div className="bundle__panel" id={panel} hidden={!open}>
        <ol className="minis" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {product.coachings.map((k) => (
            <CoachingMini key={k} site={site} catalogueKey={k} />
          ))}
        </ol>
      </div>
    </article>
  );
}
