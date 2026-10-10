/**
 * Condition language of the coaching models.
 *
 *   expr    := and ('or' and)*
 *   and     := cmp ('and' cmp)*
 *   cmp     := operand (op operand)? | '(' expr ')'
 *   op      := is | not | lt | le | gt | ge
 *   operand := 'string' | number | variable
 *
 * The legacy API translated this into PHP and called eval(). This is a real
 * parser and an interpreter, no code is ever executed. Comparison follows PHP's
 * loose semantics (`'1' == 1`, unset variable == 0) because the models were
 * written against them.
 */

export type Scalar = string | number | boolean | null;
export type Values = (name: string) => unknown;

export type Operand = { k: 'var'; name: string } | { k: 'lit'; v: string | number };

export type Condition =
  | { k: 'or' | 'and'; l: Condition; r: Condition }
  | { k: 'cmp'; op: CmpOp; l: Operand; r: Operand }
  | { k: 'val'; o: Operand };

export type CmpOp = 'is' | 'not' | 'lt' | 'le' | 'gt' | 'ge';

const CMP_OPS: ReadonlySet<string> = new Set(['is', 'not', 'lt', 'le', 'gt', 'ge']);

export class ConditionError extends Error {
  constructor(message: string, readonly source: string) {
    super(`${message} in condition: ${source}`);
  }
}

type Token = { t: 'word' | 'str' | '(' | ')'; v: string };

const SYMBOLS = /[=<>!&|]/;
const SYMBOL_WORDS: Record<string, string> = {
  '=': 'is',
  '==': 'is',
  '!=': 'not',
  '<>': 'not',
  '<': 'lt',
  '<=': 'le',
  '>': 'gt',
  '>=': 'ge',
  '&&': 'and',
  '||': 'or',
};

function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src.charAt(i);
    if (/\s/.test(c)) {
      i++;
    } else if (c === '(' || c === ')') {
      out.push({ t: c, v: c });
      i++;
    } else if (c === "'" || c === '"') {
      const end = src.indexOf(c, i + 1);
      if (end < 0) throw new ConditionError('Unterminated string', src);
      out.push({ t: 'str', v: src.slice(i + 1, end) });
      i = end + 1;
    } else if (SYMBOLS.test(c)) {
      // Symbolic spellings some models use: = == != <> < <= > >= && ||
      let j = i;
      while (j < src.length && SYMBOLS.test(src.charAt(j))) j++;
      const word = SYMBOL_WORDS[src.slice(i, j)];
      if (!word) throw new ConditionError(`Unknown operator "${src.slice(i, j)}"`, src);
      out.push({ t: 'word', v: word });
      i = j;
    } else {
      let j = i;
      while (j < src.length && !/[\s()'"=<>!&|]/.test(src.charAt(j))) j++;
      out.push({ t: 'word', v: src.slice(i, j) });
      i = j;
    }
  }
  return out;
}

const NUMERIC = /^-?\d+(\.\d+)?$/;

export function parseCondition(src: string): Condition {
  const tokens = tokenize(src);
  let pos = 0;
  const peek = () => tokens[pos];
  const isWord = (t: Token | undefined, w: string) => t?.t === 'word' && t.v.toLowerCase() === w;

  const operand = (rhs: boolean): Operand => {
    const t = tokens[pos++];
    if (!t || t.t === '(' || t.t === ')') throw new ConditionError('Operand expected', src);
    if (t.t === 'str') return { k: 'lit', v: t.v };
    if (rhs && NUMERIC.test(t.v)) return { k: 'lit', v: Number(t.v) };
    return { k: 'var', name: t.v };
  };

  const cmp = (): Condition => {
    if (peek()?.t === '(') {
      pos++;
      const inner = or();
      if (tokens[pos++]?.t !== ')') throw new ConditionError('Missing )', src);
      return inner;
    }
    const l = operand(false);
    const t = peek();
    if (t?.t === 'word' && CMP_OPS.has(t.v.toLowerCase())) {
      pos++;
      return { k: 'cmp', op: t.v.toLowerCase() as CmpOp, l, r: operand(true) };
    }
    return { k: 'val', o: l };
  };

  const and = (): Condition => {
    let l = cmp();
    while (isWord(peek(), 'and')) {
      pos++;
      l = { k: 'and', l, r: cmp() };
    }
    return l;
  };

  const or = (): Condition => {
    let l = and();
    while (isWord(peek(), 'or')) {
      pos++;
      l = { k: 'or', l, r: and() };
    }
    return l;
  };

  if (tokens.length === 0) throw new ConditionError('Empty condition', src);
  const result = or();
  if (pos < tokens.length) throw new ConditionError(`Unexpected "${tokens[pos]?.v}"`, src);
  return result;
}

/** Names of all variables a condition reads. */
export function conditionVariables(c: Condition): string[] {
  switch (c.k) {
    case 'or':
    case 'and':
      return [...conditionVariables(c.l), ...conditionVariables(c.r)];
    case 'cmp':
      return [c.l, c.r].flatMap((o) => (o.k === 'var' ? [o.name] : []));
    case 'val':
      return c.o.k === 'var' ? [c.o.name] : [];
  }
}

const isNumeric = (v: unknown): v is number | string =>
  typeof v === 'number' || (typeof v === 'string' && NUMERIC.test(v.trim()));

function looseEquals(a: unknown, b: unknown): boolean {
  if (a === undefined) a = null;
  if (b === undefined) b = null;
  if (a === null || b === null) {
    const other = a === null ? b : a;
    return other === null || other === '' || other === 0 || other === false;
  }
  if (typeof a === 'boolean' || typeof b === 'boolean') return Boolean(a) === Boolean(b);
  if (isNumeric(a) && isNumeric(b)) return Number(a) === Number(b);
  if (typeof a === 'object' || typeof b === 'object') return false;
  return String(a) === String(b);
}

function compare(a: unknown, b: unknown): number {
  if (isNumeric(a) && isNumeric(b)) return Number(a) - Number(b);
  const x = a == null ? '' : String(a);
  const y = b == null ? '' : String(b);
  return x < y ? -1 : x > y ? 1 : 0;
}

function resolve(o: Operand, values: Values): unknown {
  return o.k === 'lit' ? o.v : values(o.name);
}

export function evaluateCondition(c: Condition, values: Values): boolean {
  switch (c.k) {
    case 'or':
      return evaluateCondition(c.l, values) || evaluateCondition(c.r, values);
    case 'and':
      return evaluateCondition(c.l, values) && evaluateCondition(c.r, values);
    case 'val': {
      const v = resolve(c.o, values);
      return !(v == null || v === '' || v === 0 || v === '0' || v === false);
    }
    case 'cmp': {
      const a = resolve(c.l, values);
      const b = resolve(c.r, values);
      switch (c.op) {
        case 'is':
          return looseEquals(a, b);
        case 'not':
          return !looseEquals(a, b);
        case 'lt':
          return compare(a, b) < 0;
        case 'le':
          return compare(a, b) <= 0;
        case 'gt':
          return compare(a, b) > 0;
        case 'ge':
          return compare(a, b) >= 0;
      }
    }
  }
}

const cache = new Map<string, Condition | ConditionError>();

/** Parse (memoised) and evaluate. A malformed condition is simply false. */
export function check(source: string, values: Values): boolean {
  let parsed = cache.get(source);
  if (!parsed) {
    try {
      parsed = parseCondition(source);
    } catch (e) {
      parsed = e instanceof ConditionError ? e : new ConditionError(String(e), source);
    }
    cache.set(source, parsed);
  }
  return parsed instanceof ConditionError ? false : evaluateCondition(parsed, values);
}
