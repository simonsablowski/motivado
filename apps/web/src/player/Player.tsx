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
import { StageControls, Toolbar } from './Controls';
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
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stageBox = useRef<HTMLDivElement>(null);

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
    setDuration(0);
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

  /**
   * One step back. The history always ends with the node on screen; from the
   * end screen the last visited node is shown again.
   */
  const history = pos.session.history;
  const canGoBack = pos.step.kind === 'end' ? history.length > 0 : history.length > 1;
  const goBack = () => {
    if (!canGoBack) return;
    const atEnd = pos.step.kind !== 'node';
    const target = atEnd ? history[history.length - 1] : history[history.length - 2];
    const to = target ? coaching.nodes[target] : undefined;
    if (!to) return;
    const session: Session = {
      ...pos.session,
      current: to.id,
      history: atEnd ? history : history.slice(0, -1),
    };
    saveSession(session);
    setPos({ session, step: { kind: 'node', node: to } });
  };

  // ---- video control -------------------------------------------------------------------------
  const toggle = () => {
    const v = video.current;
    if (!v) return;
    if (v.paused) void v.play().catch(() => undefined);
    else v.pause();
  };
  const seek = (s: number) => {
    if (video.current) video.current.currentTime = s;
    setTime(s);
  };
  const setLevel = (level: number) => {
    const v = video.current;
    setVolume(level || volume);
    setMuted(level === 0);
    if (v) {
      v.muted = level === 0;
      if (level > 0) v.volume = level;
    }
  };
  const fullscreen = () => {
    const box = stageBox.current;
    if (!box) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void box.requestFullscreen?.();
  };

  const actions = (primary: React.ReactNode) => (
    <div className="actions">
      <button type="button" className="button button--quiet" disabled={!canGoBack} onClick={goBack}>
        ‹ Zurück
      </button>
      {primary}
      <span className="step-count">Schritt {history.length}</span>
    </div>
  );

  if (pos.step.kind === 'end') {
    return (
      <div className="player">
        <Toolbar backTo={backTo} backLabel={backLabel} onRestart={restart} />
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
            {canGoBack && (
              <button type="button" className="button button--quiet" onClick={goBack}>
                ‹ Zurück
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (pos.step.kind === 'blocked' || !node) {
    return (
      <div className="player">
        <Toolbar backTo={backTo} backLabel={backLabel} onRestart={restart} />
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
      <Toolbar backTo={backTo} backLabel={backLabel} onRestart={restart} />
      <div className={`player__grid${hasVideo ? ' player__grid--split' : ''}`}>
        {hasVideo && (
          <div className="stage" ref={stageBox}>
            <video
              key={videoUrl}
              ref={video}
              className="stage__video"
              src={videoUrl}
              autoPlay
              playsInline
              preload="auto"
              onClick={toggle}
              onLoadedMetadata={(e) => {
                setDuration(e.currentTarget.duration);
                e.currentTarget.volume = volume;
                e.currentTarget.muted = muted;
              }}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
              onEnded={() => {
                setTime(Infinity);
                setPlaying(false);
              }}
            />
            {slide && <img className="stage__slide" src={slide} alt="" />}
            <StageControls
              playing={playing}
              current={Number.isFinite(time) ? time : duration}
              duration={duration}
              volume={volume}
              muted={muted}
              onToggle={toggle}
              onSeek={seek}
              onVolume={setLevel}
              onFullscreen={fullscreen}
            />
          </div>
        )}
        <div className="panel-wrap">
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
                {actions(
                  last ? (
                    <button type="button" className="button button--quiet" onClick={proceed}>
                      Überspringen
                    </button>
                  ) : (
                    <button type="button" className="button" disabled={!complete} onClick={proceed}>
                      Weiter ›
                    </button>
                  ),
                )}
              </>
            ) : (
              <>
                <p className="hint">Hören Sie zu …</p>
                {actions(null)}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
