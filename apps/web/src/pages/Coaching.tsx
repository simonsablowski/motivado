import { Link, useParams } from 'react-router-dom';
import { coachingTitle, loadCoaching, modelOf, useAsync, useSite } from '../lib/api';
import { usePageMeta } from '../lib/meta';
import { Player } from '../player/Player';
import { Loading, NotFound } from './Static';
import { Crumbs } from '../components/Crumbs';

export function Coaching() {
  const { key = '' } = useParams();
  const { data: site } = useSite();
  const { data: coaching, loading, error } = useAsync(() => loadCoaching(key), [key]);

  const alias = site ? Object.entries(site.modelMap).find(([, m]) => m === key)?.[0] : undefined;
  const known = site?.coachings[key] ?? (alias ? site?.coachings[alias] : undefined);
  usePageMeta(site ? coachingTitle(site, key) : 'Motivado', known?.subtitle || known?.description?.split('\n')[0]);
  if (loading || !site) return <Loading loading />;
  if (error || !coaching) return <NotFound />;

  const product = site.products.find(
    (p) => site.launch.includes(p.slug) && p.coachings.some((k) => modelOf(site, k) === key),
  );
  const title = coachingTitle(site, key);

  return (
    <div className="wrap wrap--player">
      <div className="coaching-head">
        <div>
          <Crumbs>
            <Link to="/">Start</Link> /{' '}
            {product && (
              <>
                <Link to={`/paket/${product.slug}`}>{product.title}</Link> /{' '}
              </>
            )}
            {title}
          </Crumbs>
          <h1>{title}</h1>
        </div>
      </div>
      <Player
        key={key}
        coaching={coaching}
        title={title}
        backTo={product ? `/paket/${product.slug}` : '/'}
        backLabel={product ? 'Zurück zum Paket' : 'Zur Startseite'}
        linkedTitle={(k) => {
          const model = modelOf(site, k);
          return model ? { key: model, title: coachingTitle(site, model) } : undefined;
        }}
      />
    </div>
  );
}
