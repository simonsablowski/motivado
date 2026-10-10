import { Link, useParams } from 'react-router-dom';
import { usePageMeta } from '../lib/meta';
import { SITE } from '../site.config';
import { useSite } from '../lib/api';

/**
 * Landing page behind every "buy" call to action. There is no shop yet: this
 * page collects interest by mail. `key` is a product slug or a legacy package
 * key such as `bez-affaeren-paket`.
 */
export function Order() {
  const { key = '' } = useParams();
  const { data: site } = useSite();
  const product = site?.products.find((p) => p.slug === key);
  const name = product?.title ?? 'dieses Paket';
  usePageMeta(product ? `${product.title}: Paket anfragen` : 'Paket anfragen');
  const subject = encodeURIComponent(`Anfrage: ${product?.title ?? key}`);

  return (
    <div className="wrap--narrow">
      <div className="page-head">
        <p className="eyebrow">Paket</p>
        <h1>{product ? product.title : 'Das vollständige Paket'}</h1>
        <p className="lead">
          Das komplette Paket mit allen Coachings ist bald wieder erhältlich. Schreiben Sie uns kurz, dann melden wir
          uns, sobald es soweit ist.
        </p>
      </div>
      <div className="actions">
        <a className="button" href={`mailto:${SITE.contactEmail}?subject=${subject}`}>
          Interesse an {name} melden
        </a>
        {product ? (
          <Link className="button button--quiet" to={`/paket/${product.slug}`}>
            Zurück zum Paket
          </Link>
        ) : (
          <Link className="button button--quiet" to="/">
            Zur Startseite
          </Link>
        )}
      </div>
    </div>
  );
}
