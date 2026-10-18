import { Link } from 'react-router-dom';
import { useSite, type Expert } from '../lib/api';
import { usePageMeta } from '../lib/meta';
import { expertPhoto } from '../lib/visuals';
import { Loading } from './Static';
import { Crumbs } from '../components/Crumbs';
import { PageHead } from '../components/PageHead';

export function ExpertCard({ expert }: { expert: Expert }) {
  return (
    <div className="expert">
      <img className="expert__photo" src={expertPhoto(expert.name)} alt={expert.name} loading="lazy" />
      <div className="expert__body">
        <h3>{expert.name}</h3>
        <p>{expert.description}</p>
      </div>
    </div>
  );
}

export function Team() {
  const { data: site, loading } = useSite();
  usePageMeta('Unsere Experten', 'Coaches, Psychologen und Berater mit Praxiserfahrung: die Menschen vor der Kamera.');
  if (!site) return <Loading loading={loading} />;
  return (
    <>
      <Crumbs>
        <Link to="/">Start</Link> / Experten
      </Crumbs>
      <PageHead
        title="Unsere Experten"
        lead="Die Menschen vor der Kamera: Coaches, Psychologen und Berater mit Praxiserfahrung."
      />
      <div className="wrap">
        <div className="experts section">
          {site.experts.map((e) => (
            <ExpertCard key={e.id} expert={e} />
          ))}
        </div>
      </div>
    </>
  );
}
