import { describe, expect, it } from 'vitest';
import {
  advance,
  answer,
  begin,
  check,
  chooseEdge,
  computeAnswer,
  interpolate,
  parseCondition,
  validate,
  type Coaching,
  type CoachingNode,
} from '../src';

const vals = (o: Record<string, unknown>) => (n: string) => o[n];

describe('conditions', () => {
  it('compares with PHP-like loose equality', () => {
    expect(check("geschlecht is 'f'", vals({ geschlecht: 'f' }))).toBe(true);
    expect(check('menu is 2', vals({ menu: '2' }))).toBe(true);
    expect(check('menu is 2', vals({ menu: 1 }))).toBe(false);
    expect(check("menu not 'a'", vals({ menu: 'b' }))).toBe(true);
  });

  it('treats unset variables as null', () => {
    expect(check("krankheit is 'ms'", vals({}))).toBe(false);
    expect(check('anzahl is 0', vals({}))).toBe(true);
  });

  it('supports relational operators', () => {
    expect(check('alter gt 40', vals({ alter: '41' }))).toBe(true);
    expect(check('alter le 40', vals({ alter: 40 }))).toBe(true);
    expect(check("wert lt '0.5'", vals({ wert: '0.24' }))).toBe(true);
  });

  it('honours and/or precedence and parentheses', () => {
    const v = vals({ a: 1, b: 2, c: 3 });
    expect(check('a is 9 and b is 2 or c is 3', v)).toBe(true);
    expect(check('a is 9 and (b is 2 or c is 3)', v)).toBe(false);
  });

  it('accepts symbolic operators used by some models', () => {
    expect(check("position='(Fach)-Hochschulabsolvent/in'", vals({ position: '(Fach)-Hochschulabsolvent/in' }))).toBe(true);
    expect(check('a >= 3 && b != 2', vals({ a: 3, b: 1 }))).toBe(true);
  });

  it('accepts hex style variable names', () => {
    expect(check('260f97f62c97440ea287836c03a502c8 is 1', vals({ '260f97f62c97440ea287836c03a502c8': 1 }))).toBe(true);
  });

  it('treats malformed conditions as false and never executes code', () => {
    expect(check("a is 'x", vals({ a: 'x' }))).toBe(false);
    expect(() => parseCondition('1; system("rm -rf /")')).toThrow();
  });
});

describe('templates', () => {
  const answers = { name: { value: 'Anna' }, art: { value: '2', data: 'Mal länger, mal kurz' } };
  it('substitutes answers, labels and fallbacks', () => {
    expect(interpolate('Hallo #name!', answers)).toBe('Hallo Anna!');
    expect(interpolate('Du bist #art', answers)).toBe('Du bist Mal länger, mal kurz');
    expect(interpolate("Wie läuft #firma|'das Geschäft'?", answers)).toBe('Wie läuft das Geschäft?');
    expect(interpolate('Leer: #nix', answers)).toBe('Leer: ');
  });
});

const node = (id: string, over: Partial<CoachingNode> = {}): CoachingNode => ({
  id,
  type: 'Text',
  key: null,
  title: '',
  text: '',
  props: {},
  next: [],
  ...over,
});

const coaching: Coaching = {
  key: 'test',
  domain: 'tst',
  title: '',
  description: '',
  start: [{ to: 'intro' }],
  nodes: {
    intro: node('intro', { next: [{ to: 'ask' }] }),
    ask: node('ask', {
      type: 'Options',
      key: 'wahl',
      next: [
        { to: 'a', if: 'wahl is 1' },
        { to: 'b', if: 'wahl is 2' },
      ],
    }),
    a: node('a', { next: [{ to: 'calc' }] }),
    b: node('b', { next: [{ to: null }] }),
    calc: node('calc', {
      type: 'AddValue',
      key: 'summe',
      props: { operation: 'multiply', values: [3, '#wahl'] },
      next: [{ to: 'done' }],
    }),
    done: node('done', { next: [] }),
  },
};

describe('walker', () => {
  it('stops at a question and follows the matching edge', () => {
    let pos = begin(coaching);
    expect(pos.step).toMatchObject({ kind: 'node', node: { id: 'intro' } });
    pos = advance(coaching, pos.session);
    expect(pos.step).toMatchObject({ kind: 'node', node: { id: 'ask' } });

    const blocked = advance(coaching, pos.session);
    expect(blocked.step.kind).toBe('blocked');

    const session = answer(pos.session, 'wahl', { value: 1 });
    pos = advance(coaching, session);
    expect(pos.step).toMatchObject({ node: { id: 'a' } });
  });

  it('runs computed nodes silently and ends the coaching', () => {
    let pos = begin(coaching);
    pos = advance(coaching, pos.session);
    pos = advance(coaching, answer(pos.session, 'wahl', { value: 1 }));
    pos = advance(coaching, pos.session);
    expect(pos.step).toMatchObject({ node: { id: 'done' } });
    expect(pos.session.answers.summe?.value).toBe(3);
    expect(advance(coaching, pos.session).step.kind).toBe('end');
  });

  it('takes an unconditional default when no condition matches', () => {
    const edges = [{ to: 'x', if: 'a is 1' }, { to: 'y' }];
    expect(chooseEdge(edges, vals({ a: 2 }))?.to).toBe('y');
    expect(chooseEdge(edges, vals({ a: 1 }))?.to).toBe('x');
  });

  it('follows a single target even if its condition is false (legacy behaviour)', () => {
    expect(chooseEdge([{ to: 'x', if: 'a is 1' }], vals({ a: 2 }))?.to).toBe('x');
  });
});

describe('computed values', () => {
  it('handles subtract with references', () => {
    const n = node('n', { type: 'AddValue', props: { operation: 'subtract', values: [1, '#tellong'] } });
    expect(computeAnswer(n, { tellong: { value: '0.2' } })?.value).toBe(0.8);
  });
});

describe('validation', () => {
  it('reports bad edges and unreachable nodes', () => {
    const broken: Coaching = {
      ...coaching,
      nodes: {
        ...coaching.nodes,
        orphan: node('orphan'),
        a: node('a', { next: [{ to: 'ghost' }] }),
      },
    };
    const codes = validate(broken).map((i) => i.code);
    expect(codes).toContain('missing-node');
    expect(codes).toContain('unreachable');
  });
});
