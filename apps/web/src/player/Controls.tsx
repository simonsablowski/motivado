
const clock = (s: number) => {
  if (!Number.isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};

export interface StageState {
  playing: boolean;
  current: number;
  duration: number;
  volume: number;
  muted: boolean;
}

interface StageControlsProps extends StageState {
  onToggle: () => void;
  onSeek: (seconds: number) => void;
  onVolume: (level: number) => void;
  onFullscreen: () => void;
}

const LEVELS = 5;

/** Control bar under the coach video: pause, progress, volume, fullscreen. */
export function StageControls({
  playing,
  current,
  duration,
  volume,
  muted,
  onToggle,
  onSeek,
  onVolume,
  onFullscreen,
}: StageControlsProps) {
  const percent = duration > 0 ? Math.min(100, (current / duration) * 100) : 0;
  const level = muted ? 0 : Math.round(volume * LEVELS);
  return (
    <div className="controls" role="group" aria-label="Videosteuerung">
      <button
        type="button"
        className={`ctl ctl--${playing ? 'pause' : 'play'}`}
        onClick={onToggle}
        aria-label={playing ? 'Pause' : 'Abspielen'}
      />
      <input
        className="progress"
        type="range"
        min={0}
        max={duration || 1}
        step={0.1}
        value={current}
        onChange={(e) => onSeek(Number(e.target.value))}
        style={{ ['--p' as string]: `${percent}%` }}
        aria-label="Position im Video"
      />
      <span className="controls__time" aria-hidden="true">
        {clock(current)} / {clock(duration)}
      </span>
      <div className="volume" role="group" aria-label="Lautstärke">
        {Array.from({ length: LEVELS }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            className={`volume__bar${n <= level ? ' is-on' : ''}`}
            style={{ height: 6 + n * 3 }}
            onClick={() => onVolume(n === level ? 0 : n / LEVELS)}
            aria-label={`Lautstärke ${n} von ${LEVELS}`}
          />
        ))}
      </div>
      <button type="button" className="ctl ctl--full" onClick={onFullscreen} aria-label="Vollbild" />
    </div>
  );
}

/** Fixed navigation of a step: back, progress, forward. Always in the same place. */
export function PlayerBar({
  canGoBack,
  onBack,
  step,
  total,
  primary,
  narrow,
}: {
  canGoBack: boolean;
  onBack: () => void;
  step: number;
  total: number;
  primary: React.ReactNode;
  /** Same width as a single-column step (no video). */
  narrow?: boolean;
}) {
  const percent = Math.min(100, Math.round((step / total) * 100));
  return (
    <div className={`playerbar${narrow ? ' playerbar--narrow' : ''}`} role="navigation" aria-label="Schritte">
      <button type="button" className="button button--text" disabled={!canGoBack} onClick={onBack}>
        ‹ Zurück
      </button>
      <div
        className="playerbar__progress"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={step}
        aria-label={`Schritt ${step} von etwa ${total}`}
      >
        {total <= 24 ? (
          Array.from({ length: total }, (_, i) => (
            <span key={i} className={`playerbar__seg${i < step ? ' is-done' : ''}${i === step - 1 ? ' is-now' : ''}`} />
          ))
        ) : (
          <span className="playerbar__fill" style={{ width: `${percent}%` }} />
        )}
      </div>
      <span className="playerbar__count">
        <span className="playerbar__count-long">Schritt </span>
        {step}
        <span className="playerbar__count-long"> von ca. </span>
        <span className="playerbar__count-short">/</span>
        {total}
      </span>
      {primary}
    </div>
  );
}
