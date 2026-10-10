import { conditionVariables, parseCondition } from './condition';
import { templateReferences } from './template';
import type { Coaching } from './types';

export interface Issue {
  level: 'error' | 'warning';
  code:
    | 'no-start'
    | 'missing-node'
    | 'bad-condition'
    | 'unreachable'
    | 'no-default'
    | 'unknown-variable'
    | 'unknown-reference';
  node?: string;
  message: string;
}

/**
 * Static checks on a coaching. Errors make the coaching unplayable, warnings are
 * things worth a look (many are intentional in the legacy models).
 *
 * `externalKeys`: answer keys that legitimately come from other coachings,
 * e.g. `geschlecht`.
 */
export function validate(coaching: Coaching, externalKeys: ReadonlySet<string> = new Set()): Issue[] {
  const issues: Issue[] = [];
  const keys = new Set<string>();
  for (const n of Object.values(coaching.nodes)) if (n.key) keys.add(n.key);
  const known = (name: string) => keys.has(name) || externalKeys.has(name);

  if (coaching.start.length === 0) {
    issues.push({ level: 'error', code: 'no-start', message: 'Coaching has no entry edge' });
  }

  const edgeOwner: [string | undefined, (typeof coaching.start)[number]][] = [
    ...coaching.start.map((e) => [undefined, e] as [undefined, typeof e]),
    ...Object.values(coaching.nodes).flatMap((n) => n.next.map((e) => [n.id, e] as [string, typeof e])),
  ];

  for (const [owner, edge] of edgeOwner) {
    if (edge.to !== null && !coaching.nodes[edge.to]) {
      issues.push({
        level: 'error',
        code: 'missing-node',
        ...(owner ? { node: owner } : {}),
        message: `Edge points to unknown node ${edge.to}`,
      });
    }
    if (edge.if) {
      try {
        for (const v of conditionVariables(parseCondition(edge.if))) {
          if (!known(v)) {
            issues.push({
              level: 'warning',
              code: 'unknown-variable',
              ...(owner ? { node: owner } : {}),
              message: `Condition uses "${v}", which no node in this coaching sets`,
            });
          }
        }
      } catch (e) {
        issues.push({
          level: 'error',
          code: 'bad-condition',
          ...(owner ? { node: owner } : {}),
          message: String((e as Error).message),
        });
      }
    }
  }

  for (const n of Object.values(coaching.nodes)) {
    const targets = new Set(n.next.map((e) => e.to));
    if (n.next.length > 1 && targets.size > 1 && n.next.every((e) => e.if)) {
      issues.push({
        level: 'warning',
        code: 'no-default',
        node: n.id,
        message: 'All outgoing edges are conditional; the coaching stops if none matches',
      });
    }
    for (const ref of templateReferences(`${n.title}\n${n.text}`)) {
      if (!known(ref)) {
        issues.push({
          level: 'warning',
          code: 'unknown-reference',
          node: n.id,
          message: `Text references #${ref}, which no node in this coaching sets`,
        });
      }
    }
  }

  const seen = new Set<string>();
  const stack = coaching.start.flatMap((e) => (e.to ? [e.to] : []));
  while (stack.length > 0) {
    const id = stack.pop() as string;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const e of coaching.nodes[id]?.next ?? []) if (e.to) stack.push(e.to);
  }
  for (const id of Object.keys(coaching.nodes)) {
    if (!seen.has(id)) {
      issues.push({ level: 'warning', code: 'unreachable', node: id, message: 'Node is not reachable from the start' });
    }
  }

  return issues;
}
