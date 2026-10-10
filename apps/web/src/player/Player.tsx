import {
  advance,
  answer as storeAnswer,
  begin,
  createSession,
  type Answer,
  type Coaching,
  type CoachingNode,
  type Position,
  type Session,
  type VideoEvent,
} from '@motivado/engine';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadAnswers, loadSession, saveSession, clearProgress } from '../lib/store';
import { mediaUrl, useMediaReady } from '../lib/media';
import { INTERACTIVE, NodeView } from './views';

interface Props {
  coaching: Coaching;
  title: string;
  /** Where "back" leads and the follow-up coachings shown at the end. */
  backTo: string;
  backLabel: string;
  linkedTitle: (key: string) => { key: string; title: string } | undefined;
}

interface Stage {
  video?: string;
  events: VideoEvent[];
}

function stageOf(node: CoachingNode): Stage {
  const p = node.props as { video?: { url?: string }; events?: VideoEvent[] };
  return { ...(p.video?.url ? { video: p.video.url } : {}), events: p.events ?? [] };
}

/** Whether the interaction panel is shown at `time`, following the timed show/hide events. */
function panelVisible(events: VideoEvent[], time: number): boolean {
  let visible = true;
  for (const e of [...events].sort((a, b) => a.second - b.second)) {
    if (e.second > time) break;
    if (e.type === 'show') visible = true;
    if (e.type === 'hide') visible = false;
  }
  return visible;
}

function slideAt(events: VideoEvent[], time: number): string | undefined {
  let url: string | undefined;
  for (const e of [...events].sort((a, b) => a.second - b.second)) {
    if (e.second > time) break;
    if (e.type === 'slide') url = e.url;
  }
  return url;
}

function gather(coaching: Coaching, session: Session, group: CoachingNode): { members: CoachingNode[]; after: Session } {
  const count = Math.max(1, Number((group.props as { count?: number }).count) || 1);
  const members: CoachingNode[] = [];
  let s = session;
  for (let i = 0; i < count; i++) {
    const r = advance(coaching, s);
    if (r.step.kind !== 'node') break;
    members.push(r.step.node);
    s = r.session;
  }
  return { members, after: s };
}

export function Player({ coaching, title, backTo, backLabel, linkedTitle }: Props) {
  useMediaReady();
  const initial = useMemo<Position>(() => {
    const saved = loadSession(coaching.key);
    if (saved && saved.current && coaching.nodes[saved.current]) {
      return { session: saved, step: { kind: 'node', node: coaching.nodes[saved.current] as CoachingNode } };
    }
    return begin(coaching, { ...createSession(coaching.key), answers: loadAnswers() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coaching.key]);

  const [pos, setPos] = useState<Position>(initial);
  const [pending, setPending] = useState<Record<string, Answer | undefined>>({});
  const [time, setTime] = useState(0);
  const panel = useRef<HTMLDivElement>(null);

  const node = pos.step.kind === 'node' ? pos.step.node : undefined;
  const group = useMemo(
    () => (node?.type === 'Group' ? gather(coaching, pos.session, node) : undefined),
    [node, pos.session, coaching],
  );
  const views = useMemo<CoachingNode[]>(() => (node ? (group ? [node, ...group.members] : [node]) : []), [node, group]);
  const stage = useMemo(() => (node ? stageOf(node) : { events: [] as VideoEvent[] }), [node]);
  const videoUrl = mediaUrl(stage.video);
  const hasVideo = Boolean(videoUrl);

  // New step: reset per-step state and move focus to the content.
  useEffect(() => {
    setPending({});
    setTime(hasVideo ? 0 : Infinity);
    panel.current?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node?.id]);

  const visible = !hasVideo || panelVisible(stage.events, time);
  const slide = mediaUrl(slideAt(stage.events, time));
  const setAnswer = useCallback((key: string, a: Answer | undefined) => {
    setPending((p) => (p[key] === a ? p : { ...p, [key]: a }));
  }, []);

  const needsInput = views.filter((v) => INTERACTIVE.has(v.type));
  const complete = needsInput.every((v) => pending[v.key ?? v.id] !== undefined);

  const proceed = () => {
    if (!node) return;
    let session = group ? group.after : pos.session;
    for (const v of views) {
      const a = pending[v.key ?? v.id];
      if (!a) continue;
      const { also, ...own } = a;
      if (v.key) session = storeAnswer(session, v.key, own);
      for (const [k, extra] of Object.entries(also ?? {})) session = storeAnswer(session, k, extra);
    }
    const next = advance(coaching, session);
    saveSession(next.session, next.step.kind === 'end');
    setPos(next);
  };

  const restart = () => {
    clearProgress(coaching.key);
    setPos(begin(coaching, { ...createSession(coaching.key), answers: loadAnswers() }));
  };

  if (pos.step.kind === 'end') {
    return (
      <div className="player">
        <div className="panel panel--end" ref={panel} tabIndex={-1}>
          <p className="eyebrow">{title}</p>
          <h2 className="question">Geschafft – dieses Coaching ist abgeschlossen.</h2>
          <p className="prose">Ihre Antworten bleiben auf diesem Gerät gespeichert. Sie können das Coaching jederzeit wiederholen.</p>
          <div className="actions">
            <Link className="button" to={backTo}>
              {backLabel}
            </Link>
            <button type="button" className="button button--quiet" onClick={restart}>
              Noch einmal von vorn
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (pos.step.kind === 'blocked' || !node) {
    return (
      <div className="player">
        <div className="panel" ref={panel} tabIndex={-1}>
          <h2 className="question">An dieser Stelle geht es leider nicht weiter.</h2>
          <p className="prose">
            Für Ihre bisherigen Angaben ist in diesem Coaching kein Weg hinterlegt. Das liegt an uns, nicht an Ihnen.
          </p>
          <div className="actions">
            <button type="button" className="button" onClick={restart}>
              Neu starten
            </button>
            <Link className="button button--quiet" to={backTo}>
              {backLabel}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const linkKey = String((node.props as { key?: string }).key ?? '');
  const handover = node.type === 'Coaching' ? linkedTitle(linkKey) : undefined;
  const last = node.type === 'Buy' || (node.type === 'Coaching' && handover);
  const answers = { ...pos.session.answers, ...Object.fromEntries(Object.entries(pending).filter(([, a]) => a)) } as Record<string, Answer>;

  return (
    <div className="player">
      {hasVideo && (
        <div className="stage">
          <video
            key={videoUrl}
            className="stage__video"
            src={videoUrl}
            controls
            autoPlay
            playsInline
            preload="auto"
            onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
            onEnded={() => setTime(Infinity)}
          />
          {slide && <img className="stage__slide" src={slide} alt="" />}
        </div>
      )}
      {!hasVideo && stage.video && (
        <p className="notice">Das Video zu diesem Schritt ist in dieser Version noch nicht verfügbar.</p>
      )}
      <div className="panel" ref={panel} tabIndex={-1} aria-live="polite">
        {visible ? (
          <>
            {views.map((v) => (
              <div className="view" key={v.id}>
                <NodeView
                  node={v}
                  answers={answers}
                  time={time}
                  coachingLink={v.type === 'Coaching' ? handover : undefined}
                  onChange={(a) => setAnswer(v.key ?? v.id, a)}
                />
              </div>
            ))}
            <div className="actions">
              {!last && (
                <button type="button" className="button" disabled={!complete} onClick={proceed}>
                  Weiter
                </button>
              )}
              {last && (
                <button type="button" className="button button--quiet" onClick={proceed}>
                  Überspringen
                </button>
              )}
              <span className="step-count">Schritt {pos.session.history.length}</span>
            </div>
          </>
        ) : (
          <p className="hint">Hören Sie zu …</p>
        )}
      </div>
    </div>
  );
}
