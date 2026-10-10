import type { Coaching } from '@motivado/engine';
import { useEffect, useState } from 'react';

export interface Group {
  slug: string;
  title: string;
}
export interface Category {
  slug: string;
  path: string;
  group: string;
  title: string;
  description: string;
  experts: number[];
}
export interface Product {
  slug: string;
  path: string;
  category: string;
  title: string;
  subtitle: string;
  description: string;
  experts: number[];
  coachings: string[];
}
export interface Expert {
  id: number;
  name: string;
  description: string;
}
export interface CoachingMeta {
  title: string;
  subtitle: string;
  description: string;
}

export interface Site {
  groups: Group[];
  categories: Category[];
  products: Product[];
  experts: Expert[];
  coachings: Record<string, CoachingMeta>;
  /** catalogue key -> model key */
  modelMap: Record<string, string>;
  /** Slugs of products published on this release. */
  launch: string[];
  /** Model keys that are shipped with this build. */
  available: Set<string>;
}

const cache = new Map<string, Promise<unknown>>();

export function getJson<T>(path: string): Promise<T> {
  let p = cache.get(path) as Promise<T> | undefined;
  if (!p) {
    p = fetch(path).then((r) => {
      if (!r.ok) throw new Error(`${path}: ${r.status}`);
      return r.json() as Promise<T>;
    });
    cache.set(path, p);
    p.catch(() => cache.delete(path));
  }
  return p;
}

let sitePromise: Promise<Site> | undefined;

export function loadSite(): Promise<Site> {
  sitePromise ??= (async () => {
    const [groups, categories, products, experts, coachings, modelMap, launch, index] = await Promise.all([
      getJson<Group[]>('/content/site/groups.json'),
      getJson<Category[]>('/content/site/categories.json'),
      getJson<Product[]>('/content/site/products.json'),
      getJson<Expert[]>('/content/site/experts.json'),
      getJson<Record<string, CoachingMeta>>('/content/site/coachings.json'),
      getJson<Record<string, string>>('/content/site/model-map.json'),
      getJson<{ products: string[] }>('/content/site/launch.json'),
      getJson<{ key: string }[]>('/content/index.json'),
    ]);
    const { _comment, ...map } = modelMap as Record<string, string>;
    void _comment;
    return {
      groups,
      categories,
      products,
      experts,
      coachings,
      modelMap: map,
      launch: launch.products,
      available: new Set(index.map((c) => c.key)),
    };
  })();
  sitePromise.catch(() => {
    sitePromise = undefined;
  });
  return sitePromise;
}

export function loadCoaching(key: string): Promise<Coaching> {
  return getJson<Coaching>(`/content/coachings/${encodeURIComponent(key)}.json`);
}

export interface Async<T> {
  data: T | undefined;
  error: Error | undefined;
  loading: boolean;
}

export function useAsync<T>(load: () => Promise<T>, deps: unknown[]): Async<T> {
  const [state, setState] = useState<Async<T>>({ data: undefined, error: undefined, loading: true });
  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true, error: undefined }));
    load().then(
      (data) => live && setState({ data, error: undefined, loading: false }),
      (error: Error) => live && setState({ data: undefined, error, loading: false }),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

export const useSite = () => useAsync(loadSite, []);

/** Resolve the model key of a catalogue coaching, if a model ships with this build. */
export function modelOf(site: Site, catalogueKey: string): string | undefined {
  const model = site.modelMap[catalogueKey] ?? catalogueKey;
  return site.available.has(model) ? model : undefined;
}

export function coachingTitle(site: Site, key: string): string {
  const meta = site.coachings[key] ?? site.coachings[Object.entries(site.modelMap).find(([, m]) => m === key)?.[0] ?? ''];
  if (meta?.title) return meta.title;
  return key.replace(/^[a-z0-9]+-/, '').replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());
}
