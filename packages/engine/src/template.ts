import type { Answer } from './types';

/** `#variable` or `#variable|'fallback'` inside texts. */
const TEMPLATE = /#([A-Za-z0-9_]+)(?:\|'([^']*)')?/g;

export function templateReferences(text: string): string[] {
  return [...text.matchAll(TEMPLATE)].map((m) => m[1] as string);
}

/** Text shown for an answer: its label when it has one, otherwise the value. */
export function display(answer: Answer | undefined): string | undefined {
  if (!answer) return undefined;
  const v = typeof answer.data === 'string' && answer.data !== '' ? answer.data : answer.value;
  if (v === undefined || v === null || v === '') return undefined;
  if (Array.isArray(v)) return v.map(String).join(', ');
  return String(v);
}

export function interpolate(text: string, answers: Record<string, Answer>): string {
  return text.replace(TEMPLATE, (_all, name: string, fallback: string | undefined) => {
    return display(answers[name]) ?? fallback ?? '';
  });
}
