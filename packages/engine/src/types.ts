/**
 * Content model of a coaching.
 *
 * A coaching is a directed graph of nodes ("objects" in the legacy system).
 * Each node shows something to the user (a video, a text, a question, ...).
 * Edges may carry a condition that is evaluated against the user's answers.
 */

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

/** Edge to another node. `to: null` ends the coaching. */
export interface Edge {
  to: string | null;
  /** Condition source, e.g. `krankheit is 'diab' and alter gt 40`. */
  if?: string;
}

/** Timed UI event on a video clip. */
export interface VideoEvent {
  type: 'show' | 'hide' | 'slide' | string;
  second: number;
  url?: string;
}

export interface VideoRef {
  /** Logical clip name as used by the models, e.g. `REL_Zweigleisig_V1.flv`. */
  url: string;
}

export interface NodeProps {
  video?: VideoRef;
  events?: VideoEvent[];
  [key: string]: unknown;
}

export interface CoachingNode {
  id: string;
  /** Legacy object type: Video, Text, Options, TextInput, ... */
  type: string;
  /** Answer key. Interaction nodes store their result under it. */
  key: string | null;
  title: string;
  /** Body text (legacy `description`). May contain `#key|'fallback'` templates. */
  text: string;
  props: NodeProps;
  next: Edge[];
}

export interface Coaching {
  key: string;
  /** Content domain derived from the key prefix, e.g. `bez`, `ges`. */
  domain: string;
  title: string;
  description: string;
  /** Entry edges (legacy transitions from the virtual node 0). */
  start: Edge[];
  nodes: Record<string, CoachingNode>;
}

/** The result a user produced for one interaction node. */
export interface Answer {
  value: unknown;
  /** Human readable counterpart, e.g. the selected option label. */
  data?: unknown;
}

export interface Session {
  coaching: string;
  /** Node the user is currently on; `null` before start. */
  current: string | null;
  answers: Record<string, Answer>;
  /** Node ids visited, in order. */
  history: string[];
}

export type Step =
  | { kind: 'node'; node: CoachingNode }
  /** The coaching is over. */
  | { kind: 'end' }
  /** Several outgoing edges exist but none applies. Content bug or missing input. */
  | { kind: 'blocked'; node: CoachingNode | null };
