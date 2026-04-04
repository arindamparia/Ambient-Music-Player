import React from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';
import './BottomBar.css';

interface BottomBarProps {
  emoji: string | undefined;
  title: string | undefined;
  isPlaying: boolean;
  volume: number;
  onPlayPause: () => void;
  onVolumeChange: (val: number) => void;
}

export const BottomBar: React.FC<BottomBarProps> = ({
  emoji,
  title,
  isPlaying,
  volume,
  onPlayPause,
  onVolumeChange,
}) => {
  const volInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    volInputRef.current?.style.setProperty('--fill', `${Math.round(volume * 100)}%`);
  }, [volume]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    e.target.style.setProperty('--fill', `${Math.round(v * 100)}%`);
    onVolumeChange(v);
  };

  return (
    <footer className="bottom-bar">
      {/* Progress line — read only, radio mode */}
      <div className="bottom-bar__progress">
        <div className="bottom-bar__progress-fill" />
        <span className="bottom-bar__live-dot" />
      </div>

      <div className="bottom-bar__dock">
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

        {/* Play / Pause */}
        <div className="bottom-bar__center">
          <button className="play-btn" onClick={onPlayPause} aria-label={isPlaying ? 'Pause' : 'Play'}>
            {isPlaying
              ? <Pause size={24} fill="currentColor" />
              : <Play size={24} fill="currentColor" style={{ marginLeft: 2 }} />
            }
          </button>
        </div>

        {/* Volume */}
        <div className="bottom-bar__volume">
          <button
            className="vol-mute-btn"
            onClick={() => onVolumeChange(volume > 0 ? 0 : 0.8)}
            aria-label="Toggle mute"
          >
            {volume === 0 ? <VolumeX size={17} /> : <Volume2 size={17} />}
          </button>
          <input
            ref={volInputRef}
            className="vol-slider"
            type="range"
            min="0" max="1" step="0.01"
            value={volume}
            onChange={handleChange}
            aria-label="Volume"
          />
        </div>
      </div>
    </footer>
  );
};
