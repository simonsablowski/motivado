import type { Product, Site } from './api';

/** The legacy site filed some sleep products under the bare topic; give that section a real name. */
const CATEGORY_TITLE: Record<string, string> = { gesundheit: 'Schlaf und Erholung' };

/**
 * Topics whose legacy categories do not match the content get their own grouping
 * (by the situation a visitor is in). Package slugs, in display order.
 */
const SECTIONS: Record<string, { title: string; packages: string[] }[]> = {
  beziehung: [
    {
      title: 'Partner finden',
      packages: [
        'flirten',
        'online-dating',
        'traummann',
        'traumfrau-kennenlernen',
        'passender-partner',
        'ungewollt-single',
        'vom-date-zur-beziehung',
      ],
    },
    {
      title: 'Beziehung und Erotik',
      packages: ['beziehung-starken', 'balance-in-der-beziehung', 'eifersucht', 'besser-aussehen', 'verfuehrung'],
    },
    {
      title: 'Krise und Trennung',
      packages: ['ex-zurueck', 'liebeskummer', 'betrogen-wordenbez-bet-paket', 'die-affare', 'sich-trennen'],
    },
  ],
};

export interface Section {
  id: string;
  title: string;
  products: Product[];
  /** Legacy introduction text of the category, when the section is a legacy category. */
  intro?: string;
}

const idOf = (title: string) =>
  title
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** The packages of a topic on this release, grouped for the topic page and the navigation. */
export function topicSections(site: Site, group: string): Section[] {
  const launched = site.products.filter((p) => site.launch.includes(p.slug) && p.category.startsWith(group));
  const custom = SECTIONS[group];
  if (custom) {
    const sections: Section[] = custom.map((s) => ({
      id: idOf(s.title),
      title: s.title,
      products: s.packages
        .map((slug) => launched.find((p) => p.slug === slug))
        .filter((p): p is Product => Boolean(p)),
    }));
    // a package that is launched but not listed above must not disappear
    const listed = new Set(custom.flatMap((s) => s.packages));
    const rest = launched.filter((p) => !listed.has(p.slug));
    if (rest.length > 0) sections.push({ id: 'weitere', title: 'Weitere Pakete', products: rest });
    return sections.filter((s) => s.products.length > 0);
  }
  return site.categories
    .filter((c) => c.group === group && launched.some((p) => p.category === c.path))
    .sort((a, b) => a.title.localeCompare(b.title, 'de'))
    .map((c) => ({
      id: c.slug,
      title: CATEGORY_TITLE[c.path] ?? c.title,
      products: launched.filter((p) => p.category === c.path),
      intro: c.description,
    }));
}
