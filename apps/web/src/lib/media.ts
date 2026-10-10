import { getJson } from './api';
import { useEffect, useState } from 'react';

const BASE = (import.meta.env.VITE_MEDIA_BASE_URL as string | undefined) ?? '/media';

let mapping: Record<string, string> | undefined;
const waiting: (() => void)[] = [];

getJson<Record<string, string>>('/content/media.json').then(
  (m) => {
    mapping = m;
    waiting.splice(0).forEach((f) => f());
  },
  () => {
    mapping = {};
  },
);

/** Public URL of a media file referenced by a model, `undefined` if it is not available. */
export function mediaUrl(name: string | undefined): string | undefined {
  if (!name || !mapping) return undefined;
  const rel = mapping[name];
  return rel ? `${BASE}/${rel}` : undefined;
}

/** Re-render once the media mapping has loaded. */
export function useMediaReady(): boolean {
  const [ready, setReady] = useState(mapping !== undefined);
  useEffect(() => {
    if (mapping !== undefined) {
      setReady(true);
      return;
    }
    waiting.push(() => setReady(true));
  }, []);
  return ready;
}
