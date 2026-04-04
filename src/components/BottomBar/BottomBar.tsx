import React, { useRef, useEffect, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Moon } from 'lucide-react';
import './BottomBar.css';

interface BottomBarProps {
  emoji: string | undefined;
  title: string | undefined;
  isPlaying: boolean;
  volume: number; // 0-1, linear gain (no overdrive)
  sleepSecondsLeft: number | null;
  onPlayPause: () => void;
  onVolumeChange: (val: number) => void;
  onPrev: () => void;
  onNext: () => void;
  onSetSleepTimer: (seconds: number | null) => void;
  onSleepEndOfTrack: () => void;
}

const SLEEP_PRESETS = [15, 30, 45, 60] as const;

const formatSleep = (secs: number) => {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

export const BottomBar: React.FC<BottomBarProps> = ({
  emoji,
  title,
  isPlaying,
  volume,
  sleepSecondsLeft,
  onPlayPause,
  onVolumeChange,
  onPrev,
  onNext,
  onSetSleepTimer,
  onSleepEndOfTrack,
}) => {
  const volInputRef = useRef<HTMLInputElement>(null);
  const [timerOpen, setTimerOpen] = useState(false);
  const [customMin, setCustomMin] = useState('');
  const timerRef = useRef<HTMLDivElement>(null);
  const customInputRef = useRef<HTMLInputElement>(null);

  const fillPct = Math.round(volume * 100);
  const volLabel = `×${volume.toFixed(1)}`;

  // Update slider track fill directly — bypasses React render loop for 60fps
  const applyVolFill = (v: number) => {
    volInputRef.current?.style.setProperty('--fill', `${Math.round(v * 100)}%`);
  };

  useEffect(() => { applyVolFill(volume); }, [volume]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    applyVolFill(v);
    onVolumeChange(v);
  };

  // Close sleep popover when clicking outside
  useEffect(() => {
    if (!timerOpen) return;
    const h = (e: MouseEvent) => {
      if (!timerRef.current?.contains(e.target as Node)) setTimerOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [timerOpen]);

  const applyCustom = () => {
    const m = parseInt(customMin, 10);
    if (m > 0) {
      onSetSleepTimer(m * 60);
      setTimerOpen(false);
      setCustomMin('');
    }
  };

  return (
    <footer className="bottom-bar">
      {/* Progress line */}
      <div className="bottom-bar__progress">
        <div className="bottom-bar__progress-fill" />
        <span className="bottom-bar__live-dot" />
      </div>

      <div className="bottom-bar__dock">
        {/* ── Row 1 (mobile top row): info + secondary controls ─── */}
        <div className="bottom-bar__top-row">
          {/* Now playing info */}
          <div className="bottom-bar__info">
            {emoji && (
              <>
                <div className="bottom-bar__art">{emoji}</div>
                <div className="bottom-bar__meta">
                  <span className="bottom-bar__track-title">{title}</span>
                  <span className={`bottom-bar__status ${isPlaying ? 'is-playing' : ''}`}>
                    {isPlaying ? '● Playing' : '◌ Paused'}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Volume */}
          <div className="bottom-bar__volume">
            {/* Mute */}
            <button
              className="vol-mute-btn"
              onClick={() => onVolumeChange(volume > 0 ? 0 : 0.8)}
              aria-label="Toggle mute"
            >
              {volume === 0 ? <VolumeX size={17} /> : <Volume2 size={17} />}
            </button>

            {/* Volume slider + level label (always visible) */}
            <div className="vol-wrap">
              <span className="vol-level-badge">{volLabel}</span>
              <input
                ref={volInputRef}
                className="vol-slider"
                type="range"
                min="0" max="1" step="0.01"
                value={volume}
                onChange={handleChange}
                aria-label="Volume"
                style={{ '--fill': `${fillPct}%` } as React.CSSProperties}
              />
            </div>
          </div>
        </div>{/* end top-row */}

        {/* ── Row 2 (mobile bottom row): Play controls + Sleep ──── */}
        <div className="bottom-bar__center">
          <div className="center-balance" />
          <div className="center-btns">
            <button className="skip-btn" onClick={onPrev} aria-label="Previous track">
              <SkipBack size={20} fill="currentColor" />
            </button>
            <button className="play-btn" onClick={onPlayPause} aria-label={isPlaying ? 'Pause' : 'Play'}>
              {isPlaying
                ? <Pause size={24} fill="currentColor" />
                : <Play size={24} fill="currentColor" style={{ marginLeft: 2 }} />
              }
            </button>
            <button className="skip-btn" onClick={onNext} aria-label="Next track">
              <SkipForward size={20} fill="currentColor" />
            </button>
          </div>
          <div className="sleep-timer" ref={timerRef}>
            <button
              className={`sleep-btn ${sleepSecondsLeft ? 'sleep-btn--active' : ''}`}
              onClick={() => setTimerOpen(p => !p)}
              aria-label="Sleep timer"
              title="Sleep timer"
            >
              <Moon size={15} />
              {sleepSecondsLeft !== null && (
                <span className="sleep-countdown">{formatSleep(sleepSecondsLeft)}</span>
              )}
            </button>

            {timerOpen && (
              <div className="sleep-popover">
                <span className="sleep-popover__label">Sleep timer</span>

                {/* Minute presets grid */}
                <div className="sleep-popover__presets">
                  {SLEEP_PRESETS.map(m => (
                    <button
                      key={m}
                      className="sleep-preset"
                      onClick={() => { onSetSleepTimer(m * 60); setTimerOpen(false); }}
                    >
                      {m} min
                    </button>
                  ))}
                </div>

                {/* End of track */}
                <button
                  className="sleep-preset sleep-preset--end-of-track"
                  onClick={() => { onSleepEndOfTrack(); setTimerOpen(false); }}
                >
                  ⏎ End of track
                </button>

                {/* Custom minutes */}
                <div className="sleep-custom">
                  <input
                    ref={customInputRef}
                    className="sleep-custom-input"
                    type="number"
                    min="1"
                    max="999"
                    step="1"
                    placeholder="Custom min"
                    value={customMin}
                    onChange={e => setCustomMin(e.target.value.replace(/[^0-9]/g, ''))}
                    onKeyDown={e => { if (e.key === 'Enter') applyCustom(); }}
                  />
                  <button
                    className="sleep-custom-apply"
                    onClick={applyCustom}
                    disabled={!customMin || parseInt(customMin, 10) <= 0}
                  >
                    Set
                  </button>
                </div>

                {/* Cancel active timer */}
                {sleepSecondsLeft !== null && (
                  <button
                    className="sleep-preset sleep-preset--cancel"
                    onClick={() => { onSetSleepTimer(null); setTimerOpen(false); }}
                  >
                    Cancel ({formatSleep(sleepSecondsLeft)})
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

      </div>
    </footer>
  );
};
