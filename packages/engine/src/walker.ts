import { check } from './condition';
import { computeAnswer, isComputed } from './compute';
import type { Answer, Coaching, CoachingNode, Edge, Session, Step } from './types';

export interface Position {
  session: Session;
  step: Step;
}

/** Safety net against cycles made only of non-interactive nodes. */
const MAX_AUTO_STEPS = 500;

export function createSession(coaching: string): Session {
  return { coaching, current: null, answers: {}, history: [] };
}

export function valuesOf(session: Session) {
  return (name: string): unknown => session.answers[name]?.value;
}

/**
 * Pick the outgoing edge to follow.
 *
 * Mirrors the legacy API:
 *  1. the first edge whose condition holds wins,
 *  2. if all edges lead to the same node it is taken regardless of conditions,
 *  3. otherwise the first unconditional edge is the default,
 *  4. otherwise nothing applies (`null`): the node is a dead end for this user.
 */
export function chooseEdge(edges: readonly Edge[], values: (name: string) => unknown): Edge | null {
  for (const edge of edges) {
    if (edge.if && check(edge.if, values)) return edge;
  }
  const targets = new Set(edges.map((e) => e.to));
  const first = edges[0];
  if (first && targets.size === 1) return first;
  return edges.find((e) => !e.if) ?? null;
}

function land(coaching: Coaching, session: Session, target: string | null): Position {
  let s = session;
  let id = target;
  for (let i = 0; i < MAX_AUTO_STEPS; i++) {
    if (id === null) return { session: { ...s, current: null }, step: { kind: 'end' } };
    const node = coaching.nodes[id];
    if (!node) return { session: s, step: { kind: 'blocked', node: null } };

    if (isComputed(node)) {
      const computed = computeAnswer(node, s.answers);
      if (computed && node.key) s = { ...s, answers: { ...s.answers, [node.key]: computed } };
      const edge = chooseEdge(node.next, valuesOf(s));
      if (node.next.length === 0) return { session: { ...s, current: null }, step: { kind: 'end' } };
      if (!edge) return { session: { ...s, current: node.id }, step: { kind: 'blocked', node } };
      id = edge.to;
      continue;
    }

    return {
      session: { ...s, current: node.id, history: [...s.history, node.id] },
      step: { kind: 'node', node },
    };
  }
  return { session: s, step: { kind: 'blocked', node: null } };
}

/** Start (or restart) a coaching. */
export function begin(coaching: Coaching, session = createSession(coaching.key)): Position {
  const edge = chooseEdge(coaching.start, valuesOf(session));
  if (!edge) return { session, step: { kind: 'blocked', node: null } };
  return land(coaching, { ...session, current: null, history: [] }, edge.to);
}

/** Leave the current node along the matching edge. */
export function advance(coaching: Coaching, session: Session): Position {
  const node = session.current ? coaching.nodes[session.current] : undefined;
  if (!node) return { session, step: { kind: 'end' } };
  if (node.next.length === 0) return { session: { ...session, current: null }, step: { kind: 'end' } };
  const edge = chooseEdge(node.next, valuesOf(session));
  if (!edge) return { session, step: { kind: 'blocked', node } };
  return land(coaching, session, edge.to);
}

/** Record the user's result for an interaction node. */
export function answer(session: Session, key: string, result: Answer): Session {
  return { ...session, answers: { ...session.answers, [key]: result } };
}

export function nodeOf(coaching: Coaching, session: Session): CoachingNode | undefined {
  return session.current ? coaching.nodes[session.current] : undefined;
}
