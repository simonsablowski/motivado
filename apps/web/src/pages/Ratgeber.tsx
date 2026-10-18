import { Link, useParams } from 'react-router-dom';
import { getJson, useAsync, useSite } from '../lib/api';
import { modules } from '../components/catalogue';
import { usePageMeta } from '../lib/meta';
import { GROUP_IMAGE } from '../lib/visuals';
import { Loading, NotFound } from './Static';
import { Crumbs } from '../components/Crumbs';
import { PageHead } from '../components/PageHead';

interface Segment {
  t: string;
  b?: boolean;
  i?: boolean;
  href?: string;
}
type Block =
  { t: 'h'; level: number; text: string } | { t: 'p'; inline: Segment[] } | { t: 'ul' | 'ol'; items: Segment[][] };

interface TopicInfo {
  topic: string;
  title: string;
  heading: string;
  count: number;
}
interface TopicIndex {
  topic: string;
  title: string;
  heading: string;
  intro: Block[];
  articles: { slug: string; title: string; summary: string }[];
  /** Sub-categories of the big topics: article slugs plus the module package that fits. */
  groups?: {
    id: string;
    title: string;
    link: { to: string; label: string };
    slugs: string[];
  }[];
}
interface Article {
  topic: string;
  slug: string;
  title: string;
  heading: string;
  description: string;
  blocks: Block[];
  /** The new articles: key points, matching package, review date, hand-picked neighbours. */
  summary?: string[];
  package?: string;
  reviewed?: string;
  related?: string[];
}

const MONTHS = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
];
const reviewedLabel = (ym: string) => {
  const [y, m] = ym.split('-');
  return MONTHS[Number(m) - 1] ? `${MONTHS[Number(m) - 1]} ${y}` : ym;
};

/** Topic -> photo and the coaching topic page it leads to. */
const TOPIC_META: Record<string, { image: string; group: string; blurb: string }> = {
  beziehung: {
    image: 'beziehung',
    group: 'beziehung',
    blurb: 'Liebe, Partnerschaft, Trennung und Dating.',
  },
  abnehmen: {
    image: 'gesundheit',
    group: 'gesundheit',
    blurb: 'Ernährung, Bewegung und Motivation.',
  },
  schlafen: {
    image: 'schlafen',
    group: 'gesundheit',
    blurb: 'Besser einschlafen, durchschlafen und erholt aufwachen.',
  },
  bewerbung: {
    image: 'karriere',
    group: 'karriere',
    blurb: 'Bewerbung, Vorstellungsgespräch und Karriere.',
  },
  erziehung: {
    image: 'erziehung',
    group: 'erziehung',
    blurb: 'Kinder stärken, Konflikte lösen, Mobbing begegnen.',
  },
};

function Inline({ segments }: { segments: Segment[] }) {
  return (
    <>
      {segments.map((s, i) => {
        let node: React.ReactNode = s.t;
        if (s.b) node = <strong>{node}</strong>;
        if (s.i) node = <em>{node}</em>;
        if (s.href) node = <Link to={s.href}>{node}</Link>;
        return <span key={i}>{node}</span>;
      })}
    </>
  );
}

function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <div className="article">
      {blocks.map((b, i) => {
        if (b.t === 'h') return b.level <= 2 ? <h2 key={i}>{b.text}</h2> : <h3 key={i}>{b.text}</h3>;
        if (b.t === 'p')
          return (
            <p key={i}>
              <Inline segments={b.inline} />
            </p>
          );
        const List = b.t;
        return (
          <List key={i}>
            {b.items.map((it, j) => (
              <li key={j}>
                <Inline segments={it} />
              </li>
            ))}
          </List>
        );
      })}
    </div>
  );
}

export function RatgeberHub() {
  usePageMeta(
    'Ratgeber',
    'Ratgeber zu Beziehung, Abnehmen, Schlafen, Bewerbung und Erziehung: Wissen, das weiterhilft.',
  );
  const { data, loading } = useAsync(() => getJson<TopicInfo[]>('/content/ratgeber/topics.json'), []);
  if (!data) return <Loading loading={loading} />;
  return (
    <>
      <Crumbs>
        <Link to="/">Start</Link> / Ratgeber
      </Crumbs>
      <PageHead
        title="Ratgeber"
        lead="Hintergrundwissen zu den Themen, bei denen wir mit unseren Modulen helfen: verständlich, praktisch und kostenlos."
      />
      <div className="wrap">
        <div className="topics section">
          {data.map((t) => {
            const meta = TOPIC_META[t.topic];
            return (
              <Link key={t.topic} className="topic" to={`/ratgeber/${t.topic}`}>
                {meta && (
                  <div className="topic__image">
                    <img src={GROUP_IMAGE[meta.image]} alt="" loading="lazy" />
                  </div>
                )}
                <div className="topic__body">
                  <h3>{t.title}</h3>
                  <span className="topic__list">{meta?.blurb}</span>
                  <span className="topic__count">{t.count} Artikel →</span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}

type ArticleLink = { slug: string; title: string; summary: string };

function ArticleCards({ topic, items }: { topic: string; items: ArticleLink[] }) {
  return (
    <div className="acards">
      {items.map((a) => (
        <Link key={a.slug} className="acard" to={`/ratgeber/${topic}/${a.slug}`}>
          <span className="acard__title">{a.title}</span>
          <span className="acard__text">{a.summary}</span>
          <span className="acard__more">Lesen →</span>
        </Link>
      ))}
    </div>
  );
}

export function RatgeberTopic() {
  const { topic = '' } = useParams();
  const { data, loading, error } = useAsync(
    () => getJson<TopicIndex>(`/content/ratgeber/${topic}/index.json`),
    [topic],
  );
  usePageMeta(
    data ? `Ratgeber ${data.title}` : 'Ratgeber',
    data?.articles.length ? `${data.articles.length} Artikel im Ratgeber ${data.title}.` : undefined,
  );
  if (loading) return <Loading />;
  if (error || !data) return <NotFound />;
  const meta = TOPIC_META[topic];
  const bySlug = new Map(data.articles.map((a) => [a.slug, a]));
  return (
    <>
      <Crumbs>
        <Link to="/">Start</Link> / <Link to="/ratgeber">Ratgeber</Link> / {data.title}
      </Crumbs>
      <PageHead title={data.heading}>
        <div className="page-head__intro">
          <Blocks blocks={data.intro} />
        </div>
        {meta && (
          <p>
            <Link className="button" to={`/themen/${meta.group}`}>
              Zu den Modulen
            </Link>
          </p>
        )}
      </PageHead>

      {data.groups && data.groups.length > 1 && (
        <nav className="wrap jump" aria-label="Themen in diesem Ratgeber">
          <span className="jump__label">Springen zu</span>
          {data.groups.map((g) => (
            <a key={g.id} className="pill-link" href={`#${g.id}`}>
              {g.title} <span className="chip__count">{g.slugs.length}</span>
            </a>
          ))}
        </nav>
      )}

      {data.groups && data.groups.length > 0 ? (
        data.groups.map((g) => (
          <section className="wrap section topic-section" id={g.id} key={g.id} aria-labelledby={`${g.id}-h`}>
            <div className="section__head">
              <div>
                <h2 id={`${g.id}-h`}>{g.title}</h2>
                <p className="section__sub">
                  {g.slugs.length === 1 ? '1 Artikel' : `${g.slugs.length} Artikel`} · Das passende Video-Coaching:{' '}
                  <Link to={g.link.to}>{g.link.label}</Link>
                </p>
              </div>
            </div>
            <ArticleCards
              topic={topic}
              items={g.slugs.map((s) => bySlug.get(s)).filter((x): x is ArticleLink => Boolean(x))}
            />
          </section>
        ))
      ) : (
        <section className="wrap section topic-section" aria-labelledby="all-h">
          <div className="section__head">
            <h2 id="all-h">Alle Artikel ({data.articles.length})</h2>
          </div>
          <ArticleCards topic={topic} items={data.articles} />
        </section>
      )}
    </>
  );
}

export function RatgeberArticle() {
  const { topic = '', slug = '' } = useParams();
  const article = useAsync(() => getJson<Article>(`/content/ratgeber/${topic}/${slug}.json`), [topic, slug]);
  const index = useAsync(() => getJson<TopicIndex>(`/content/ratgeber/${topic}/index.json`), [topic]);
  const { data: site } = useSite();
  usePageMeta(article.data?.title ?? 'Ratgeber', article.data?.description);
  if (article.loading) return <Loading />;
  if (article.error || !article.data) return <NotFound />;
  const a = article.data;
  const meta = TOPIC_META[topic];
  const list = index.data?.articles ?? [];
  const at = list.findIndex((x) => x.slug === slug);
  // neighbours within the same sub-category when the topic has them, otherwise the next articles of the topic
  const group = index.data?.groups?.find((g) => g.slugs.includes(slug));
  const bySlug = new Map(list.map((x) => [x.slug, x]));
  const picked = (a.related ?? []).map((s) => bySlug.get(s)).filter((x): x is ArticleLink => Boolean(x));
  const product = a.package
    ? site?.products.find((p) => p.slug === a.package && site.launch.includes(p.slug))
    : undefined;
  const related = (
    picked.length
      ? picked
      : group
        ? group.slugs
            .filter((s) => s !== slug)
            .slice(0, 6)
            .map((s) => bySlug.get(s))
            .filter((x): x is ArticleLink => Boolean(x))
        : at >= 0
          ? [...list.slice(Math.max(0, at - 2), at), ...list.slice(at + 1, at + 4)]
          : []
  ).slice(0, 3);
  return (
    <>
      <Crumbs>
        <Link to="/">Start</Link> / <Link to="/ratgeber">Ratgeber</Link> /{' '}
        <Link to={`/ratgeber/${topic}`}>{index.data?.title ?? topic}</Link>
      </Crumbs>
      <PageHead title={a.heading}>
        {a.reviewed && <p className="article-meta">Zuletzt geprüft: {reviewedLabel(a.reviewed)}</p>}
      </PageHead>
      <div className="wrap article-page">
        {a.summary && a.summary.length > 0 && (
          <aside className="summary" aria-label="Kurz gesagt">
            <h2>Kurz gesagt</h2>
            <ul>
              {a.summary.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </aside>
        )}
        <Blocks blocks={a.blocks} />
        {product ? (
          <div className="tile tile--tint article-cta">
            <p className="eyebrow">Dazu passt</p>
            <h2>{product.title}</h2>
            <p>
              {product.subtitle ? `${product.subtitle} · ` : ''}
              {modules(new Set(product.coachings).size)} interaktives Video-Coaching
            </p>
            <p>
              <Link className="button" to={`/paket/${product.slug}`}>
                Zum Paket
              </Link>
            </p>
          </div>
        ) : (
          meta && (
            <div className="tile tile--tint article-cta">
              <p className="eyebrow">Mehr dazu</p>
              <h2>Interaktives Video-Coaching zum Thema</h2>
              <p>
                <Link className="button" to={`/themen/${meta.group}`}>
                  Module ansehen
                </Link>
              </p>
            </div>
          )
        )}
      </div>
      {related.length > 0 && (
        <section className="wrap section" aria-labelledby="more-h">
          <div className="section__head">
            <h2 id="more-h">Weitere Artikel</h2>
          </div>
          <ArticleCards topic={topic} items={related} />
        </section>
      )}
    </>
  );
}
