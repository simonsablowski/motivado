import { Link, useParams } from 'react-router-dom';
import { coachingTitle, loadCoaching, modelOf, useAsync, useSite } from '../lib/api';
import { Player } from '../player/Player';
import { Loading, NotFound } from './Static';

export function Coaching() {
  const { key = '' } = useParams();
  const { data: site } = useSite();
  const { data: coaching, loading, error } = useAsync(() => loadCoaching(key), [key]);

  if (loading || !site) return <Loading loading />;
  if (error || !coaching) return <NotFound />;

  const product = site.products.find(
    (p) => site.launch.includes(p.slug) && p.coachings.some((k) => modelOf(site, k) === key),
  );
  const title = coachingTitle(site, key);

  return (
    <div className="wrap">
      <div className="coaching-head">
        <div>
          <p className="crumbs" style={{ margin: 0 }}>
            {product ? <Link to={`/paket/${product.slug}`}>{product.title}</Link> : <Link to="/">Start</Link>}
          </p>
          <h1>{title}</h1>
        </div>
      </div>
      <Player
        key={key}
        coaching={coaching}
        title={title}
        backTo={product ? `/paket/${product.slug}` : '/'}
        backLabel={product ? 'Zurück zum Paket' : 'Zur Startseite'}
        linkedTitle={(k) => (site.available.has(k) ? { key: k, title: coachingTitle(site, k) } : undefined)}
      />
    </div>
  );
}
