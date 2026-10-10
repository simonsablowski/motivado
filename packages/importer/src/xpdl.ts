import { XMLParser } from 'fast-xml-parser';

/**
 * Minimal reader for the XPDL 2.1 files exported by BizAgi.
 * Only what the coaching models use is extracted.
 */

export type ActivityKind =
  | 'object' //   TaskManual     -> content node
  | 'options' //  TaskReference  -> question with choices
  | 'text' //     TaskScript     -> text node
  | 'option' //   other Task     -> one choice of an options node
  | 'set' //      BlockActivity  -> embedded sub flow
  | 'splitter' // Route          -> gateway
  | 'start'
  | 'end'
  | 'other';

export interface XActivity {
  id: string;
  name: string;
  description: string;
  kind: ActivityKind;
  /** Id of the ActivitySet a `set` activity embeds. */
  setRef: string | null;
  /** Id of the ActivitySet this activity lives in; `null` for the main flow. */
  container: string | null;
  /** True when the activity has any Implementation/Task element. */
  hasTask: boolean;
}

export interface XTransition {
  id: string;
  from: string;
  to: string;
  /** Condition (legacy `Name` attribute) or empty. */
  name: string;
}

export interface XModel {
  name: string;
  activities: Map<string, XActivity>;
  /** Outgoing transitions per activity, in document order. */
  outgoing: Map<string, XTransition[]>;
  /** First start event of the main flow. */
  start: string | null;
  /** Start event per activity set. */
  setStart: Map<string, string>;
  /** `set` activities per activity set id. */
  setUsers: Map<string, string[]>;
}

type Obj = Record<string, any>;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: false,
  processEntities: true,
  htmlEntities: true,
  isArray: (name) => ['Activity', 'Transition', 'ActivitySet', 'WorkflowProcess'].includes(name),
});

const arr = <T>(v: T | T[] | undefined): T[] => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]);

function text(v: unknown): string {
  if (v === undefined || v === null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object') return text((v as Obj)['#text']);
  return String(v);
}

function kindOf(a: Obj, setIds: Set<string>): { kind: ActivityKind; hasTask: boolean; setRef: string | null } {
  const task = a.Implementation?.Task;
  const hasTask = task !== undefined && task !== null;
  const setRef = a.BlockActivity?.['@_ActivitySetId'] ?? null;
  if (hasTask && task.TaskManual !== undefined) return { kind: 'object', hasTask, setRef: null };
  if (hasTask && task.TaskReference !== undefined) return { kind: 'options', hasTask, setRef: null };
  if (hasTask && task.TaskScript !== undefined) return { kind: 'text', hasTask, setRef: null };
  if (setRef && setIds.has(setRef)) return { kind: 'set', hasTask, setRef };
  if (a.Route !== undefined) return { kind: 'splitter', hasTask, setRef: null };
  if (hasTask) return { kind: 'option', hasTask, setRef: null };
  if (a.Event?.StartEvent !== undefined) return { kind: 'start', hasTask, setRef: null };
  if (a.Event?.EndEvent !== undefined) return { kind: 'end', hasTask, setRef: null };
  return { kind: 'other', hasTask, setRef: null };
}

export function parseXpdl(xml: string, fallbackName = ''): XModel {
  // The legacy importer stripped the default namespace; fast-xml-parser ignores it anyway.
  const doc = parser.parse(xml) as Obj;
  const pkg = doc.Package as Obj;
  const processes = arr<Obj>(pkg?.WorkflowProcesses?.WorkflowProcess);

  const setIds = new Set<string>();
  for (const p of processes) for (const s of arr<Obj>(p.ActivitySets?.ActivitySet)) setIds.add(s['@_Id']);

  const model: XModel = {
    name: pkg?.['@_Name'] ?? fallbackName,
    activities: new Map(),
    outgoing: new Map(),
    start: null,
    setStart: new Map(),
    setUsers: new Map(),
  };

  const addActivities = (list: Obj[], container: string | null) => {
    for (const a of list) {
      const id: string = a['@_Id'];
      const { kind, hasTask, setRef } = kindOf(a, setIds);
      const act: XActivity = {
        id,
        name: text(a['@_Name']),
        description: text(a.Description),
        kind,
        setRef,
        container,
        hasTask,
      };
      model.activities.set(id, act);
      if (kind === 'start') {
        if (container === null) model.start ??= id;
        else if (!model.setStart.has(container)) model.setStart.set(container, id);
      }
      if (kind === 'set' && setRef) {
        const users = model.setUsers.get(setRef) ?? [];
        users.push(id);
        model.setUsers.set(setRef, users);
      }
    }
  };

  const addTransitions = (list: Obj[]) => {
    for (const t of list) {
      const tr: XTransition = {
        id: t['@_Id'] ?? '',
        from: t['@_From'],
        to: t['@_To'],
        name: text(t['@_Name']),
      };
      const out = model.outgoing.get(tr.from) ?? [];
      out.push(tr);
      model.outgoing.set(tr.from, out);
    }
  };

  for (const p of processes) {
    addActivities(arr<Obj>(p.Activities?.Activity), null);
    addTransitions(arr<Obj>(p.Transitions?.Transition));
    for (const s of arr<Obj>(p.ActivitySets?.ActivitySet)) {
      addActivities(arr<Obj>(s.Activities?.Activity), s['@_Id']);
      addTransitions(arr<Obj>(s.Transitions?.Transition));
    }
  }
  return model;
}
