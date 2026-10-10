import { useEffect } from 'react';
import { Link, NavLink, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useSite, type Site } from './lib/api';
import { Coaching } from './pages/Coaching';
import { Home } from './pages/Home';
import { ProductPage } from './pages/Product';
import { RatgeberArticle, RatgeberHub, RatgeberTopic } from './pages/Ratgeber';
import { SITE } from './site.config';
import { Legal, NotFound } from './pages/Static';
import { Team } from './pages/Team';
import { Topic } from './pages/Topic';

/** Groups that have at least one product on this release. */
export function activeGroups(site: Site) {
  return site.groups.filter((g) => site.products.some((p) => site.launch.includes(p.slug) && p.category.startsWith(g.slug)));
}

function Layout() {
  const { data: site } = useSite();
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return (
    <>
      <a className="skip" href="#main">
        Zum Inhalt springen
      </a>
      <div className="sale-bar" role="note" lang="en">
        <div className="wrap">
          The domain <strong>motivado.com</strong> is for sale. Please send enquiries to{' '}
          <a href={`mailto:${SITE.contactEmail}?subject=${encodeURIComponent('Domain motivado.com')}`}>
            {SITE.contactEmail}
          </a>
          .
        </div>
      </div>
      <header className="header">
        <div className="wrap header__inner">
          <Link to="/" className="logo" aria-label="Motivado – zur Startseite">
            <img src="/logo.png" alt="Motivado" width="215" height="55" />
          </Link>
          <nav className="nav" aria-label="Hauptnavigation">
            {site &&
              activeGroups(site).map((g) => (
                <NavLink key={g.slug} to={`/themen/${g.slug}`}>
                  {g.title}
                </NavLink>
              ))}
          </nav>
        </div>
      </header>
      <main id="main">
        <Outlet />
      </main>
      <footer className="footer">
        <div className="wrap footer__grid">
          <div>
            <h3>Themen</h3>
            <ul>
              {site &&
                activeGroups(site).map((g) => (
                  <li key={g.slug}>
                    <Link to={`/themen/${g.slug}`}>{g.title}</Link>
                  </li>
                ))}
            </ul>
          </div>
          <div>
            <h3>Mehr</h3>
            <ul>
              <li>
                <Link to="/team">Experten</Link>
              </li>
              <li>
                <Link to="/ratgeber">Ratgeber</Link>
              </li>
            </ul>
          </div>
          <div>
            <h3>Rechtliches</h3>
            <ul>
              <li>
                <Link to="/impressum">Impressum</Link>
              </li>
              <li>
                <Link to="/datenschutz">Datenschutz</Link>
              </li>
            </ul>
          </div>
        </div>
      </footer>
    </>
  );
}

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="themen/:group" element={<Topic />} />
        <Route path="paket/:slug" element={<ProductPage />} />
        <Route path="coaching/:key" element={<Coaching />} />
        <Route path="ratgeber" element={<RatgeberHub />} />
        <Route path="ratgeber/:topic" element={<RatgeberTopic />} />
        <Route path="ratgeber/:topic/:slug" element={<RatgeberArticle />} />
        <Route path="team" element={<Team />} />
        <Route path="impressum" element={<Legal page="impressum" />} />
        <Route path="datenschutz" element={<Legal page="datenschutz" />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
