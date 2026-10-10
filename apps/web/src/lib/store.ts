import type { Answer, Session } from '@motivado/engine';

/**
 * Progress lives in the browser only. Answers are shared between coachings
 * (profile data like gender is reused), position and history are per coaching.
 */

const ANSWERS = 'motivado:answers:v1';
const PROGRESS = 'motivado:progress:v1:';

interface Progress {
  current: string | null;
  history: string[];
  finished?: boolean;
}

function read<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode or full storage: the session simply is not persisted */
  }
}

export function loadAnswers(): Record<string, Answer> {
  return read<Record<string, Answer>>(ANSWERS) ?? {};
}

export function loadSession(coaching: string): Session | undefined {
  const progress = read<Progress>(PROGRESS + coaching);
  if (!progress || progress.finished) return undefined;
  return { coaching, current: progress.current, history: progress.history, answers: loadAnswers() };
}

export function saveSession(session: Session, finished = false): void {
  write(ANSWERS, session.answers);
  write(PROGRESS + session.coaching, { current: session.current, history: session.history, finished } satisfies Progress);
}

export function clearProgress(coaching: string): void {
  try {
    localStorage.removeItem(PROGRESS + coaching);
  } catch {
    /* ignore */
  }
}

export function hasProgress(coaching: string): boolean {
  const p = read<Progress>(PROGRESS + coaching);
  return Boolean(p && !p.finished && p.history.length > 0);
}

export function resetAll(): void {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('motivado:'))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}
