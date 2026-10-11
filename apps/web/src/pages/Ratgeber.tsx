import { Link, useParams } from "react-router-dom";
import { getJson, useAsync } from "../lib/api";
import { usePageMeta } from "../lib/meta";
import { GROUP_IMAGE } from "../lib/visuals";
import { Loading, NotFound } from "./Static";
import { Crumbs } from "../components/Crumbs";

interface Segment {
  t: string;
  b?: boolean;
  i?: boolean;
  href?: string;
}
type Block =
  | { t: "h"; level: number; text: string }
  | { t: "p"; inline: Segment[] }
  | { t: "ul" | "ol"; items: Segment[][] };

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
}

/** Topic -> photo and the coaching topic page it leads to. */
const TOPIC_META: Record<
  string,
  { image: string; group: string; blurb: string }
> = {
  beziehung: {
    image: "beziehung",
    group: "beziehung",
    blurb: "Liebe, Partnerschaft, Trennung und Dating.",
  },
  abnehmen: {
    image: "gesundheit",
    group: "gesundheit",
    blurb: "Ernährung, Bewegung und Motivation.",
  },
  schlafen: {
    image: "schlafen",
    group: "gesundheit",
    blurb: "Besser einschlafen, durchschlafen und erholt aufwachen.",
  },
  bewerbung: {
    image: "karriere",
    group: "karriere",
    blurb: "Bewerbung, Vorstellungsgespräch und Karriere.",
  },
  erziehung: {
    image: "erziehung",
    group: "erziehung",
    blurb: "Kinder stärken, Konflikte lösen, Mobbing begegnen.",
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
        if (b.t === "h")
          return b.level <= 2 ? (
            <h2 key={i}>{b.text}</h2>
          ) : (
            <h3 key={i}>{b.text}</h3>
          );
        if (b.t === "p")
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
    "Ratgeber",
    "Ratgeber zu Beziehung, Abnehmen, Schlafen, Bewerbung und Erziehung: Wissen, das weiterhilft.",
  );
  const { data, loading } = useAsync(
    () => getJson<TopicInfo[]>("/content/ratgeber/topics.json"),
    [],
  );
  if (!data) return <Loading loading={loading} />;
  return (
    <div className="wrap">
      <div className="page-head">
        <Crumbs>
          <Link to="/">Start</Link> / Ratgeber
        </Crumbs>
        <h1>Ratgeber</h1>
        <p className="lead">
          Hintergrundwissen zu den Themen, bei denen wir mit unseren Modulen
          helfen.
        </p>
      </div>
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
  );
}

export function RatgeberTopic() {
  const { topic = "" } = useParams();
  const { data, loading, error } = useAsync(
    () => getJson<TopicIndex>(`/content/ratgeber/${topic}/index.json`),
    [topic],
  );
  usePageMeta(
    data ? `Ratgeber ${data.title}` : "Ratgeber",
    data?.articles.length
      ? `${data.articles.length} Artikel im Ratgeber ${data.title}.`
      : undefined,
  );
  if (loading) return <Loading />;
  if (error || !data) return <NotFound />;
  const meta = TOPIC_META[topic];
  return (
    <div className="wrap">
      <div className="page-head">
        <Crumbs>
          <Link to="/">Start</Link> / <Link to="/ratgeber">Ratgeber</Link> /{" "}
          {data.title}
        </Crumbs>
        <h1>{data.heading}</h1>
      </div>
      <div className="section">
        <Blocks blocks={data.intro} />
        {meta && (
          <div className="offer">
            <p className="offer__label">
              Lieber Schritt für Schritt begleitet werden?
            </p>
            <Link className="button" to={`/themen/${meta.group}`}>
              Zu den Modulen
            </Link>
          </div>
        )}
      </div>
      {data.groups && data.groups.length > 0 ? (
        <>
          <nav className="chips" aria-label="Themen in diesem Ratgeber">
            {data.groups.map((g) => (
              <a key={g.id} className="chip--link" href={`#${g.id}`}>
                {g.title} <span className="chip__count">{g.slugs.length}</span>
              </a>
            ))}
          </nav>
          {data.groups.map((g) => (
            <section
              className="section"
              id={g.id}
              key={g.id}
              aria-labelledby={`${g.id}-h`}
            >
              <div className="section__head">
                <h2 id={`${g.id}-h`}>{g.title}</h2>
                <span className="hint">{g.slugs.length} Artikel</span>
              </div>
              <ul className="index">
                {g.slugs.map((slug) => (
                  <li key={slug}>
                    <Link to={`/ratgeber/${topic}/${slug}`}>
                      {data.articles.find((a) => a.slug === slug)?.title ??
                        slug}
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="index__more">
                Persönlich begleitet: <Link to={g.link.to}>{g.link.label}</Link>
              </p>
            </section>
          ))}
        </>
      ) : (
        <section className="section" aria-labelledby="all-h">
          <div className="section__head">
            <h2 id="all-h">Alle Artikel ({data.articles.length})</h2>
          </div>
          <ul className="index">
            {data.articles.map((a) => (
              <li key={a.slug}>
                <Link to={`/ratgeber/${topic}/${a.slug}`}>{a.title}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export function RatgeberArticle() {
  const { topic = "", slug = "" } = useParams();
  const article = useAsync(
    () => getJson<Article>(`/content/ratgeber/${topic}/${slug}.json`),
    [topic, slug],
  );
  const index = useAsync(
    () => getJson<TopicIndex>(`/content/ratgeber/${topic}/index.json`),
    [topic],
  );
  usePageMeta(article.data?.title ?? "Ratgeber", article.data?.description);
  if (article.loading) return <Loading />;
  if (article.error || !article.data) return <NotFound />;
  const a = article.data;
  const meta = TOPIC_META[topic];
  const list = index.data?.articles ?? [];
  const at = list.findIndex((x) => x.slug === slug);
  // neighbours within the same sub-category when the topic has them, otherwise the next articles of the topic
  const group = index.data?.groups?.find((g) => g.slugs.includes(slug));
  const bySlug = new Map(list.map((x) => [x.slug, x]));
  const related = group
    ? group.slugs
        .filter((s) => s !== slug)
        .slice(0, 8)
        .map((s) => bySlug.get(s))
        .filter((x): x is (typeof list)[number] => Boolean(x))
    : at >= 0
      ? [...list.slice(Math.max(0, at - 4), at), ...list.slice(at + 1, at + 5)]
      : [];
  return (
    <div className="wrap--narrow">
      <div className="page-head">
        <Crumbs>
          <Link to="/">Start</Link> / <Link to="/ratgeber">Ratgeber</Link> /{" "}
          <Link to={`/ratgeber/${topic}`}>{index.data?.title ?? topic}</Link>
        </Crumbs>
        <h1>{a.heading}</h1>
      </div>
      <div className="section">
        <Blocks blocks={a.blocks} />
      </div>
      {meta && (
        <div className="offer">
          <p className="offer__label">
            Persönlich begleitet: unser interaktives Video-Coaching zum Thema.
          </p>
          <Link className="button" to={`/themen/${meta.group}`}>
            Module ansehen
          </Link>
        </div>
      )}
      {related.length > 0 && (
        <section className="section" aria-labelledby="more-h">
          <div className="section__head">
            <h2 id="more-h">Weitere Artikel</h2>
          </div>
          <ul className="index index--single">
            {related.map((r) => (
              <li key={r.slug}>
                <Link to={`/ratgeber/${topic}/${r.slug}`}>{r.title}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
