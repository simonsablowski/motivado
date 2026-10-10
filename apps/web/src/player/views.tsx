import { display, interpolate, type Answer, type CoachingNode } from '@motivado/engine';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { mediaUrl } from '../lib/media';

/**
 * One view per legacy object type. A view reports the user's input through
 * `onChange` (`undefined` while the input is incomplete) and never advances
 * by itself.
 */

export interface ViewProps {
  node: CoachingNode;
  answers: Record<string, Answer>;
  /** Seconds of the coach video, `Infinity` when there is none or it ended. */
  time: number;
  onChange: (answer: Answer | undefined) => void;
  /** Title of another coaching, for hand-over nodes. */
  coachingLink?: { key: string; title: string } | undefined;
}

/** Types that need input before the user may continue. */
export const INTERACTIVE = new Set(['Options', 'TextInput', 'TextArea', 'List', 'Dropdown', 'Evaluation']);

type Props = Record<string, unknown>;
const props = (n: CoachingNode): Props => n.props as Props;

function Prose({ text }: { text: string }) {
  if (!text.trim()) return null;
  const paragraphs = text.replace(/\r/g, '').split(/\n{2,}/);
  return (
    <div className="prose">
      {paragraphs.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  );
}

function Heading({ node, answers }: { node: CoachingNode; answers: Record<string, Answer> }) {
  const title = interpolate(node.title, answers).trim();
  const text = interpolate(node.text, answers);
  const generic = /^(buy|evaluation|setvalue|addvalue|cut)$/i.test(title);
  return (
    <>
      {title && !generic && <h2 className="question">{title}</h2>}
      <Prose text={text} />
    </>
  );
}

function Options({ node, answers, onChange }: ViewProps) {
  const options = (props(node).options as { key: string | number; value: string }[] | undefined) ?? [];
  const key = node.key ?? node.id;
  const [selected, setSelected] = useState<string | number | undefined>(answers[key]?.value as string | number | undefined);
  return (
    <>
      <Heading node={node} answers={answers} />
      <div className="choices" role="radiogroup">
        {options.map((o) => (
          <button
            key={String(o.key)}
            type="button"
            role="radio"
            aria-checked={selected === o.key}
            className={`choice${selected === o.key ? ' is-selected' : ''}`}
            onClick={() => {
              setSelected(o.key);
              onChange({ value: o.key, data: o.value });
            }}
          >
            {interpolate(o.value, answers)}
          </button>
        ))}
      </div>
    </>
  );
}

function TextInput({ node, answers, onChange }: ViewProps) {
  const key = node.key ?? node.id;
  const kind = String(props(node).type ?? 'char');
  const [value, setValue] = useState(String(answers[key]?.value ?? ''));
  const inputType = kind === 'date' ? 'date' : kind === 'number' || kind === 'int' ? 'number' : 'text';
  useEffect(() => {
    onChange(value.trim() ? { value: value.trim() } : undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <>
      <Heading node={node} answers={answers} />
      <input
        className="field"
        type={inputType}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label={interpolate(node.title, answers)}
      />
    </>
  );
}

function TextArea({ node, answers, onChange }: ViewProps) {
  const key = node.key ?? node.id;
  const [value, setValue] = useState(String(answers[key]?.value ?? ''));
  useEffect(() => {
    onChange(value.trim() ? { value: value.trim() } : undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <>
      <Heading node={node} answers={answers} />
      <textarea className="field" rows={5} value={value} onChange={(e) => setValue(e.target.value)} />
    </>
  );
}

function ListInput({ node, answers, onChange }: ViewProps) {
  const key = node.key ?? node.id;
  const wanted = Math.max(1, Number(props(node).items) || 3);
  const stored = answers[key]?.value;
  const [items, setItems] = useState<string[]>(
    Array.isArray(stored) && stored.length > 0 ? stored.map(String) : Array.from({ length: wanted }, () => ''),
  );
  useEffect(() => {
    const filled = items.map((s) => s.trim()).filter(Boolean);
    onChange(filled.length > 0 ? { value: filled } : undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);
  return (
    <>
      <Heading node={node} answers={answers} />
      <ol className="list-input">
        {items.map((v, i) => (
          <li key={i}>
            <input
              className="field"
              value={v}
              onChange={(e) => setItems(items.map((x, j) => (j === i ? e.target.value : x)))}
              aria-label={`Punkt ${i + 1}`}
            />
          </li>
        ))}
      </ol>
      <button type="button" className="button button--quiet" onClick={() => setItems([...items, ''])}>
        + Punkt hinzufügen
      </button>
    </>
  );
}

function Dropdown({ node, answers, onChange }: ViewProps) {
  const key = node.key ?? node.id;
  const items = ((props(node).items as (string | { label: string; value: string })[] | undefined) ?? []).map((i) =>
    typeof i === 'string' ? { label: i, value: i } : i,
  );
  const [value, setValue] = useState<string>(String(answers[key]?.value ?? ''));
  useEffect(() => {
    const item = items.find((i) => i.value === value);
    onChange(item ? { value: item.value, data: item.label } : undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <>
      <Heading node={node} answers={answers} />
      <select className="field" value={value} onChange={(e) => setValue(e.target.value)}>
        <option value="">Bitte wählen …</option>
        {items.map((i) => (
          <option key={i.value + i.label} value={i.value}>
            {i.label}
          </option>
        ))}
      </select>
    </>
  );
}

/** Items of a list that is referenced by `#key` or given inline. */
function referenced(raw: unknown, answers: Record<string, Answer>): string[] {
  if (typeof raw === 'string' && raw.startsWith('#')) {
    const v = answers[raw.slice(1)]?.value;
    return Array.isArray(v) ? v.map(String) : v ? [String(v)] : [];
  }
  if (Array.isArray(raw)) {
    return raw.map((e) => (typeof e === 'string' ? e : String((e as { element?: string }).element ?? '')));
  }
  return [];
}

function Evaluation({ node, answers, onChange }: ViewProps) {
  const p = props(node);
  const steps = Math.max(2, Number(p.steps) || 5);
  const weighted = p.weightedcriteria as { name: string; weightFactor?: number }[] | undefined;
  const criteria = useMemo(
    () => (weighted ? weighted.map((c) => c.name) : referenced(p.criteria, answers)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [node.id],
  );
  const asks = weighted ? 1 : 2;
  const [rows, setRows] = useState<{ weight?: number; rate?: number }[]>(criteria.map(() => ({})));
  useEffect(() => {
    const complete = rows.length > 0 && rows.every((r) => r.rate !== undefined && (asks === 1 || r.weight !== undefined));
    if (!complete) return onChange(undefined);
    let total = 0;
    let max = 0;
    rows.forEach((r, i) => {
      const w = weighted ? (weighted[i]?.weightFactor ?? 1) : (r.weight ?? 1);
      total += w * (r.rate ?? 0);
      max += w * steps;
    });
    onChange({ value: Math.round((total / (max || 1)) * 100), data: rows.map((r, i) => ({ name: criteria[i], ...r })) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);
  const scale = (current: number | undefined, set: (n: number) => void, label: string) => (
    <div className="scale" role="radiogroup" aria-label={label}>
      {Array.from({ length: steps }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={current === n}
          className={`scale__step${current === n ? ' is-selected' : ''}`}
          onClick={() => set(n)}
        >
          {n}
        </button>
      ))}
    </div>
  );
  return (
    <>
      <Heading node={node} answers={answers} />
      {!weighted && <p className="hint">{String(p.titleWeight ?? '')} / {String(p.titleRate ?? '')}</p>}
      <div className="evaluation">
        {criteria.map((name, i) => (
          <div className="evaluation__row" key={name + i}>
            <div className="evaluation__name">{name}</div>
            {!weighted && (
              <div>
                <span className="hint">Wichtigkeit</span>
                {scale(rows[i]?.weight, (n) => setRows(rows.map((r, j) => (j === i ? { ...r, weight: n } : r))), 'Wichtigkeit')}
              </div>
            )}
            <div>
              <span className="hint">{weighted ? 'Trifft zu' : 'Bewertung'}</span>
              {scale(rows[i]?.rate, (n) => setRows(rows.map((r, j) => (j === i ? { ...r, rate: n } : r))), 'Bewertung')}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function Bullets({ node, answers, time }: ViewProps) {
  const p = props(node);
  const elements = (p.elements as { element: string; second?: number }[] | undefined) ?? [];
  const shown = elements.filter((e) => (e.second ?? 0) <= time);
  return (
    <>
      <Heading node={node} answers={answers} />
      <ul className="bullets">
        {shown.map((e, i) => (
          <li key={i}>{interpolate(e.element, answers)}</li>
        ))}
      </ul>
    </>
  );
}

function ListView({ node, answers, time }: ViewProps) {
  const p = props(node);
  let items = referenced(p.elementsReference ?? p.elements, answers);
  if (typeof p.startIndex === 'number' || typeof p.endIndex === 'number') {
    const start = Math.max(0, (Number(p.startIndex) || 1) - 1);
    items = items.slice(start, Number(p.endIndex) || undefined);
  }
  const timed = Array.isArray(p.elements) ? (p.elements as { second?: number }[]) : [];
  return (
    <>
      <Heading node={node} answers={answers} />
      <ul className="bullets">
        {items.map((t, i) => (
          <li key={i} hidden={(timed[i]?.second ?? 0) > time}>
            {t}
          </li>
        ))}
      </ul>
    </>
  );
}

function Documents({ node, answers }: ViewProps) {
  const docs = (props(node).documents as { name: string; file: string }[] | undefined) ?? [];
  return (
    <>
      <Heading node={node} answers={answers} />
      <ul className="documents">
        {docs.map((d) => {
          const url = mediaUrl(d.file);
          return (
            <li key={d.file}>
              {url ? (
                <a className="document" href={url} target="_blank" rel="noreferrer">
                  <span>{d.name}</span>
                  <span className="document__type">PDF</span>
                </a>
              ) : (
                <span className="document is-unavailable">
                  <span>{d.name}</span>
                  <span className="document__type">nicht verfügbar</span>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

function Buy({ node, answers }: ViewProps) {
  const key = String(props(node).key ?? '');
  return (
    <>
      <Heading node={node} answers={answers} />
      <div className="offer">
        <p className="offer__label">Das vollständige Coaching-Paket</p>
        <Link className="button" to={`/bestellen/${encodeURIComponent(key)}`}>
          Jetzt Paket ansehen
        </Link>
      </div>
    </>
  );
}

function Handover({ node, answers, coachingLink }: ViewProps) {
  return (
    <>
      <Heading node={node} answers={answers} />
      {coachingLink && (
        <div className="offer">
          <p className="offer__label">Weiter mit</p>
          <Link className="button" to={`/coaching/${coachingLink.key}`}>
            {coachingLink.title}
          </Link>
        </div>
      )}
    </>
  );
}

export function NodeView(p: ViewProps) {
  switch (p.node.type) {
    case 'Options':
      return <Options {...p} />;
    case 'TextInput':
      return <TextInput {...p} />;
    case 'TextArea':
      return <TextArea {...p} />;
    case 'List':
      return <ListInput {...p} />;
    case 'Dropdown':
      return <Dropdown {...p} />;
    case 'Evaluation':
      return <Evaluation {...p} />;
    case 'BulletPoints':
    case 'Keywords':
      return <Bullets {...p} />;
    case 'ListView':
      return <ListView {...p} />;
    case 'DocumentDownload':
      return <Documents {...p} />;
    case 'Buy':
      return <Buy {...p} />;
    case 'Coaching':
      return <Handover {...p} />;
    default:
      return <Heading node={p.node} answers={p.answers} />;
  }
}

export { display };
