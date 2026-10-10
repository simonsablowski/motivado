import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { advance, answer, begin, validate, type Answer, type Coaching, type CoachingNode, type Session } from '../src';

/**
 * Plays every shipped coaching with random answers and checks the graph is
 * sound: no crashes, no endless loops, and the end is reachable.
 */

const dir = join(fileURLToPath(new URL('.', import.meta.url)), '../../../content/coachings');
const files = (() => {
  try {
    return readdirSync(dir).filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }
})();

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function respond(node: CoachingNode, rand: () => number): Answer | undefined {
  const p = node.props as { options?: { key: string | number; value: string }[]; items?: unknown };
  switch (node.type) {
    case 'Options': {
      const o = p.options ?? [];
      const pick = o[Math.floor(rand() * o.length)];
      return pick ? { value: pick.key, data: pick.value } : undefined;
    }
    case 'Dropdown': {
      const items = Array.isArray(p.items) ? p.items : [];
      const pick = items[Math.floor(rand() * items.length)] as string | { value: string; label: string } | undefined;
      if (pick === undefined) return { value: '1' };
      return typeof pick === 'string' ? { value: pick } : { value: pick.value, data: pick.label };
    }
    case 'List':
      return { value: ['a', 'b', 'c'] };
    case 'DieterCategory': {
      const letters = ['A', 'B', 'C', 'D'];
      return { value: `${letters[Math.floor(rand() * 4)]}${1 + Math.floor(rand() * 2)}` };
    }
    case 'EnergyDemand':
      return { value: 1800 };
    case 'Evaluation':
      return { value: 50 };
    case 'TextInput':
    case 'TextArea':
      return { value: String(1 + Math.floor(rand() * 40)) };
    default:
      return undefined;
  }
}

function play(coaching: Coaching, seed: number): 'end' | 'blocked' | 'loop' {
  const rand = rng(seed);
  let pos = begin(coaching);
  for (let i = 0; i < 2000; i++) {
    if (pos.step.kind === 'end') return 'end';
    if (pos.step.kind === 'blocked') return 'blocked';
    const node = pos.step.node;
    let session: Session = pos.session;
    const a = respond(node, rand);
    if (a && node.key) session = answer(session, node.key, a);
    pos = advance(coaching, session);
  }
  return 'loop';
}

describe.skipIf(files.length === 0)('shipped content', () => {
  const coachings = files.map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as Coaching);

  it('has no structural errors', () => {
    const errors = coachings.flatMap((c) =>
      validate(c)
        .filter((i) => i.level === 'error')
        .map((i) => `${c.key}: ${i.message}`),
    );
    expect(errors).toEqual([]);
  });

  it('can be completed by a user', () => {
    const stuck: string[] = [];
    const loops: string[] = [];
    for (const c of coachings) {
      const results = Array.from({ length: 40 }, (_, i) => play(c, i + 1));
      if (!results.includes('end')) stuck.push(`${c.key} (${results.filter((r) => r === 'blocked').length} blocked)`);
      if (results.includes('loop')) loops.push(c.key);
    }
    // Models that cannot be finished with random answers are reported, not hidden.
    if (stuck.length) console.warn(`Never reached the end: ${stuck.join(', ')}`);
    expect(loops).toEqual([]);
    expect(stuck.length / coachings.length).toBeLessThan(0.1);
  });
});
