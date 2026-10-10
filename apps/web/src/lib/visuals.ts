/** Photos of the original site, keyed by topic group. */
export const GROUP_IMAGE: Record<string, string> = {
  beziehung: '/img/beziehung.jpg',
  gesundheit: '/img/gesundheit.jpg',
  karriere: '/img/karriere.jpg',
  erziehung: '/img/erziehung.jpg',
};

/** Portrait of an expert: /img/experts/<first>_<last>.jpg */
export function expertPhoto(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z\s]/g, '')
    .trim()
    .replace(/\s+/g, '_');
  return `/img/experts/${slug}.jpg`;
}
