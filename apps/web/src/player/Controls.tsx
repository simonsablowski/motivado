import { useState } from 'react';
import { Link } from 'react-router-dom';
import { SITE } from '../site.config';

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

interface ToolbarProps {
  backTo: string;
  backLabel: string;
  onRestart: () => void;
}

/** "Menü" and "Hilfe" as in the original player. */
export function Toolbar({ backTo, backLabel, onRestart }: ToolbarProps) {
  const [open, setOpen] = useState<'menu' | 'help' | null>(null);
  const toggle = (which: 'menu' | 'help') => setOpen(open === which ? null : which);
  return (
    <div className="toolbar">
      <div className="toolbar__buttons">
        <button type="button" className="tool" aria-expanded={open === 'menu'} onClick={() => toggle('menu')}>
          Menü
        </button>
        <button type="button" className="tool" aria-expanded={open === 'help'} onClick={() => toggle('help')}>
          Hilfe
        </button>
      </div>
      {open === 'menu' && (
        <div className="toolbar__panel">
          <Link className="toolbar__item" to={backTo}>
            {backLabel}
          </Link>
          <button
            type="button"
            className="toolbar__item"
            onClick={() => {
              setOpen(null);
              onRestart();
            }}
          >
            Coaching von vorn beginnen
          </button>
        </div>
      )}
      {open === 'help' && (
        <div className="toolbar__panel toolbar__panel--text">
          <p>
            Hören Sie dem Coach zu, beantworten Sie die Fragen rechts und klicken Sie auf <strong>Weiter</strong>. Mit{' '}
            <strong>Zurück</strong> gehen Sie einen Schritt zurück. Ihre Antworten bleiben auf diesem Gerät gespeichert.
          </p>
          <p>
            Fragen oder Probleme? <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>
          </p>
        </div>
      )}
    </div>
  );
}
