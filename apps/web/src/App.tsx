import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { CrumbsSlot } from './components/Crumbs';
import { modelOf, useSite, type Site } from './lib/api';
import { topicSections } from './lib/sections';
import { Coaching } from './pages/Coaching';
import { Home } from './pages/Home';
import { ProductPage } from './pages/Product';
import { RatgeberArticle, RatgeberHub, RatgeberTopic } from './pages/Ratgeber';
import { SITE } from './site.config';
import { Legal, NotFound } from './pages/Static';
import { Support } from './pages/Support';
import { Team } from './pages/Team';
import { Topic } from './pages/Topic';

/** Groups that have at least one product on this release. */
export function activeGroups(site: Site) {
  return site.groups.filter((g) =>
    site.products.some((p) => site.launch.includes(p.slug) && p.category.startsWith(g.slug)),
  );
}

/** The module offered for a first try: the first one of the first launched package. */
export function sampleModule(site: Site) {
  return site.products
    .filter((p) => site.launch.includes(p.slug))
    .flatMap((p) => p.coachings)
    .map((k) => modelOf(site, k))
    .find(Boolean);
}

function Layout() {
  const { data: site } = useSite();
  const { pathname } = useLocation();
  const [crumbsSlot, setCrumbsSlot] = useState<HTMLElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    window.scrollTo(0, 0);
    setMenuOpen(false);
  }, [pathname]);
  return (
    <CrumbsSlot.Provider value={crumbsSlot}>
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
            <img src="/logo.svg" alt="Motivado" width="203" height="38" />
          </Link>
          <button
            type="button"
            className="nav__toggle"
            aria-label={menuOpen ? 'Menü schließen' : 'Menü öffnen'}
            aria-expanded={menuOpen}
            aria-controls="main-nav"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="nav__toggle-icon" aria-hidden="true" />
          </button>
          <nav id="main-nav" className={`nav${menuOpen ? ' is-open' : ''}`} aria-label="Hauptnavigation">
            {site &&
              activeGroups(site).map((g) => (
                <div className="nav__item" key={g.slug}>
                  <NavLink className="nav__link" to={`/themen/${g.slug}`}>
                    {g.title}
                  </NavLink>
                  <div className="nav__panel">
                    {topicSections(site, g.slug).map((section) => (
                      <div className="nav__group" key={section.id}>
                        <p className="nav__heading">{section.title}</p>
                        <ul>
                          {section.products.map((p) => (
                            <li key={p.slug}>
                              <Link to={`/paket/${p.slug}`}>{p.title}</Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            {site && sampleModule(site) && (
              <Link className="button nav__cta" to={`/coaching/${sampleModule(site)}`}>
                Kostenlos ausprobieren
              </Link>
            )}
          </nav>
        </div>
      </header>
      <div className="wrap crumbs-row" ref={setCrumbsSlot} />
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
              {SITE.supportUrl && (
                <li>
                  <Link to="/unterstuetzen">Motivado unterstützen</Link>
                </li>
              )}
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
    </CrumbsSlot.Provider>
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
        {SITE.supportUrl && <Route path="unterstuetzen" element={<Support />} />}
        <Route path="impressum" element={<Legal page="impressum" />} />
        <Route path="datenschutz" element={<Legal page="datenschutz" />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
