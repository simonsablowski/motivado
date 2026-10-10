import { Link } from 'react-router-dom';
import { useSite } from '../lib/api';
import { Loading } from './Static';

export function Team() {
  const { data: site, loading } = useSite();
  if (!site) return <Loading loading={loading} />;
  return (
    <div className="wrap">
      <div className="page-head">
        <p className="crumbs">
          <Link to="/">Start</Link> / Experten
        </p>
        <h1>Unsere Experten</h1>
        <p className="lead">Die Menschen vor der Kamera: Coaches, Psychologen und Berater mit Praxiserfahrung.</p>
      </div>
      <div className="experts section">
        {site.experts.map((e) => (
          <div className="expert" key={e.id}>
            <h3>{e.name}</h3>
            <p>{e.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
