import { useEffect } from 'react';

const SITE = 'Motivado';
const BASE = 'https://motivado.com';

function setMeta(selector: string, attr: 'content' | 'href', value: string): void {
  const el = document.head.querySelector(selector);
  if (el) el.setAttribute(attr, value);
}

/**
 * Per-page title, description and canonical URL. The same values are written
 * into the static HTML of each route at build time (scripts/prerender.mjs), so
 * crawlers and link previews see them without running JavaScript.
 */
export function usePageMeta(title: string, description?: string): void {
  useEffect(() => {
    const full = title === SITE || title.startsWith(`${SITE} –`) ? title : `${title} – ${SITE}`;
    document.title = full;
    setMeta('meta[property="og:title"]', 'content', full);
    if (description) {
      const short = description.length > 160 ? `${description.slice(0, 157).trimEnd()}…` : description;
      setMeta('meta[name="description"]', 'content', short);
      setMeta('meta[property="og:description"]', 'content', short);
    }
    const url = BASE + window.location.pathname;
    setMeta('link[rel="canonical"]', 'href', url);
    setMeta('meta[property="og:url"]', 'content', url);
  }, [title, description]);
}
