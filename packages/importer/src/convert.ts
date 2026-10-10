import type { Coaching, CoachingNode, Edge, NodeProps } from '@motivado/engine';
import { describe } from './describe';
import type { XActivity, XModel, XTransition } from './xpdl';

export interface ImportIssue {
  level: 'error' | 'warning';
  message: string;
  activity?: string;
}

export interface ConvertResult {
  coaching: Coaching;
  issues: ImportIssue[];
  /** False when an error makes the coaching unplayable. */
  ok: boolean;
}

/** A resolved edge target: a content activity or the end (`to: null`). */
interface Raw {
  to: string | null;
  cond: string;
}

const CONTENT = new Set(['object', 'options', 'text']);

/** Safety net for malformed models that contain gateway loops. */
const MAX_DEPTH = 64;

const numeric = (s: string) => /^-?\d+(\.\d+)?$/.test(s);

function sortOptionKeys(a: string | number, b: string | number): number {
  const x = String(a);
  const y = String(b);
  if (numeric(x) && numeric(y)) return Number(x) - Number(y);
  return x < y ? -1 : x > y ? 1 : 0;
}

export function convert(model: XModel, key: string): ConvertResult {
  const issues: ImportIssue[] = [];
  const err = (message: string, activity?: XActivity) =>
    issues.push({ level: 'error', message, ...(activity ? { activity: activity.id } : {}) });
  const warn = (message: string, activity?: XActivity) =>
    issues.push({ level: 'warning', message, ...(activity ? { activity: activity.id } : {}) });

  const out = (id: string): XTransition[] => model.outgoing.get(id) ?? [];
  const act = (id: string) => model.activities.get(id);

  /**
   * Follow a transition into `targetId` until a content node (or the end) is
   * reached, flattening start/end events of embedded sets and gateways.
   *
   * As in the legacy importer, a gateway replaces the condition of the incoming
   * transition with the one of the branch that leaves it.
   */
  function resolve(targetId: string, cond: string, depth = 0): Raw[] {
    const a = act(targetId);
    if (!a) {
      err(`Transition points to unknown activity ${targetId}`);
      return [];
    }
    if (depth > MAX_DEPTH) {
      err('Gateway loop', a);
      return [];
    }
    if (CONTENT.has(a.kind)) return [{ to: a.id, cond }];

    switch (a.kind) {
      case 'end': {
        if (a.container === null) return [{ to: null, cond }];
        // End of an embedded set: continue behind every block that embeds it.
        return (model.setUsers.get(a.container) ?? []).flatMap((block) =>
          out(block).flatMap((t) => resolve(t.to, cond, depth + 1)),
        );
      }
      case 'splitter':
        return out(a.id).flatMap((t) => resolve(t.to, t.name, depth + 1));
      case 'set': {
        const start = a.setRef ? model.setStart.get(a.setRef) : undefined;
        if (!start) {
          err('Embedded set has no start event', a);
          return [];
        }
        return out(start).flatMap((t) => resolve(t.to, t.name, depth + 1));
      }
      case 'option':
        err('Choice task reached from a node that is not a question', a);
        return [];
      case 'start':
        return [];
      default:
        err('Unsupported activity', a);
        return [];
    }
  }

  const condition = (key: string, value: string | number): string =>
    `${key} is ${typeof value === 'number' ? value : `'${value}'`}`;

  /** Key under which an options node stores its answer. */
  const optionsKey = (a: XActivity): string => {
    const k = describe(a.description).key;
    return k ?? a.id.replace(/[^a-z0-9]/gi, '');
  };

  function edgesOf(a: XActivity): Raw[] {
    const raws: Raw[] = [];
    out(a.id).forEach((t, index) => {
      const target = act(t.to);
      if (a.kind === 'options' && target?.kind === 'option') {
        // The choice is the transition into the option task, its follow-ups are the real edges.
        const choice: string | number = t.name !== '' ? t.name : index + 1;
        const extension = condition(optionsKey(a), choice);
        for (const follow of out(target.id)) {
          for (const r of resolve(follow.to, follow.name)) {
            const base = r.cond.replace(` and ${extension}`, '');
            raws.push({ to: r.to, cond: base ? `${base} and ${extension}` : extension });
          }
        }
      } else {
        raws.push(...resolve(t.to, t.name));
      }
    });
    return raws;
  }

  function describeNode(a: XActivity): Pick<CoachingNode, 'type' | 'key' | 'text' | 'props'> | null {
    const d = describe(a.description);
    let props: NodeProps = {};
    const parse = (raw: string | null): boolean => {
      if (!raw) return true;
      try {
        const v = JSON.parse(raw);
        if (v === null || typeof v !== 'object' || Array.isArray(v)) throw new Error('not an object');
        props = v as NodeProps;
        return true;
      } catch {
        err(`Invalid JSON in "${a.description.slice(0, 80)}"`, a);
        return false;
      }
    };

    if (a.kind === 'object') {
      if (!d.type) {
        err(`Object type undefined in "${a.description.slice(0, 80)}"`, a);
        return null;
      }
      if (!parse(d.properties)) return null;
      return { type: d.type, key: d.key, text: d.text ?? '', props };
    }

    if (a.kind === 'text') {
      if (!parse(d.properties)) return null;
      return { type: 'Text', key: null, text: d.text ?? '', props };
    }

    // options
    if (!parse(d.properties)) return null;
    const options = new Map<string | number, { key: string | number; value: string }>();
    for (const t of out(a.id)) {
      const target = act(t.to);
      if (!target?.hasTask) continue;
      const k: string | number = t.name !== '' ? t.name : options.size + 1;
      options.set(k, { key: k, value: target.name });
    }
    const sorted = [...options.entries()].sort(([x], [y]) => sortOptionKeys(x, y)).map(([, v]) => v);
    return { type: 'Options', key: optionsKey(a), text: d.text ?? '', props: { ...props, options: sorted } };
  }

  // ---- discover the reachable nodes and build the graph -------------------------------------
  const ids = new Map<string, string>(); // activity id -> node id
  const nodes: Record<string, CoachingNode> = {};
  const queue: string[] = [];

  const idOf = (activityId: string): string => {
    let id = ids.get(activityId);
    if (!id) {
      id = `n${String(ids.size + 1).padStart(3, '0')}`;
      ids.set(activityId, id);
      queue.push(activityId);
    }
    return id;
  };

  const toEdges = (raws: Raw[]): Edge[] => {
    const seen = new Set<string>();
    const edges: Edge[] = [];
    for (const r of raws) {
      const to = r.to === null ? null : idOf(r.to);
      const sig = `${to}|${r.cond}`;
      if (seen.has(sig)) continue;
      seen.add(sig);
      edges.push(r.cond ? { to, if: r.cond } : { to });
    }
    return edges;
  };

  let start: Edge[] = [];
  if (!model.start) {
    err('No start event');
  } else {
    start = toEdges(out(model.start).flatMap((t) => resolve(t.to, t.name)));
  }

  for (let i = 0; i < queue.length; i++) {
    const a = act(queue[i] as string) as XActivity;
    const described = describeNode(a);
    const id = ids.get(a.id) as string;
    const next = toEdges(edgesOf(a));
    let title = a.name;
    let text = described?.text ?? '';
    // The legacy column held 255 bytes; long titles are really body text.
    if (Buffer.byteLength(title, 'utf8') > 255 && !text) {
      text = title;
      title = '';
    }
    nodes[id] = {
      id,
      type: described?.type ?? 'Unknown',
      key: described?.key ?? null,
      title,
      text,
      props: described?.props ?? {},
      next,
    };
  }

  const domain = key.split('-')[0] ?? key;
  const coaching: Coaching = { key, domain, title: '', description: '', start, nodes };
  return { coaching, issues, ok: !issues.some((i) => i.level === 'error') };
}
