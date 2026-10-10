import type { Answer, CoachingNode } from './types';

/**
 * Nodes that are never shown: value computations, and the pure routing nodes of
 * the models (a text or video step with no title, text or media).
 */
export function isComputed(node: CoachingNode): boolean {
  if (node.type === 'AddValue' || node.type === 'SetValue') return true;
  const hasMedia = Boolean((node.props as { video?: unknown }).video);
  return (node.type === 'Text' || node.type === 'Video') && !node.title.trim() && !node.text.trim() && !hasMedia;
}

function toNumber(v: unknown): number {
  if (typeof v === 'number') return v;
  const n = Number(String(v ?? '').trim().replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function resolve(raw: unknown, answers: Record<string, Answer>): unknown {
  if (typeof raw === 'string' && raw.startsWith('#')) return answers[raw.slice(1)]?.value;
  return raw;
}

/**
 * Result of a computed node, or `null` when it produces nothing.
 *
 * AddValue: `{"operation":"add|subtract|multiply","values":[...]}` where every
 * value is a number or a `#key` reference. Without operation it adds.
 * SetValue: `{"value": x}` or `{"values": [...]}`.
 */
export function computeAnswer(node: CoachingNode, answers: Record<string, Answer>): Answer | null {
  const props = node.props as { operation?: string; value?: unknown; values?: unknown[] };

  if (node.type === 'SetValue') {
    if (props.value !== undefined) return { value: resolve(props.value, answers) };
    if (Array.isArray(props.values)) return { value: props.values.map((v) => resolve(v, answers)) };
    return null;
  }

  if (node.type === 'AddValue' && Array.isArray(props.values) && props.values.length > 0) {
    const nums = props.values.map((v) => toNumber(resolve(v, answers)));
    const [first = 0, ...rest] = nums;
    let result: number;
    switch (props.operation) {
      case 'subtract':
        result = rest.reduce((a, b) => a - b, first);
        break;
      case 'multiply':
        result = rest.reduce((a, b) => a * b, first);
        break;
      default:
        result = nums.reduce((a, b) => a + b, 0);
    }
    return { value: Math.round(result * 1e6) / 1e6 };
  }

  return null;
}
