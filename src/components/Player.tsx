/**
 * Player.tsx — layout orchestrator only.
 * All UI segments live in their own components (Sidebar, NowPlaying, BottomBar).
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Menu, X } from 'lucide-react';
import { TRACKS } from '../constants/tracks';
import { useAudioStore } from '../store/useAudioStore';
import { useTwinDeckAudio } from '../hooks/useTwinDeckAudio';
import { AudioVisualizer } from './AudioVisualizer/AudioVisualizer';
import { Sidebar } from './Sidebar/Sidebar';
import { NowPlaying } from './NowPlaying/NowPlaying';
import { BottomBar } from './BottomBar/BottomBar';
import './Player.css';

export const Player: React.FC = () => {
  const { currentTrackId, isPlaying, volume, setVolume } = useAudioStore();
  const { togglePlay, nextTrack, prevTrack, analyser, getActiveDeckRemaining } = useTwinDeckAudio();

  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768);
  const isMobile = () => window.innerWidth < 768;

  const currentTrack = TRACKS.find(t => t.key === currentTrackId);
  const themeColor = currentTrack?.theme ?? '#4c1d95';

  // ── Sleep Timer ───────────────────────────────────────────────────────────
  const [sleepEnd, setSleepEnd] = useState<number | null>(null);
  const [sleepLeft, setSleepLeft] = useState<number | null>(null);

  // Accepts seconds (not minutes) for uniform handling of all timer sources
  const handleSetSleepTimer = useCallback((seconds: number | null) => {
    if (seconds === null) {
      setSleepEnd(null);
      setSleepLeft(null);
      return;
    }
    const end = Date.now() + seconds * 1000;
    setSleepEnd(end);
    setSleepLeft(Math.ceil(seconds));
  }, []);

  const handleSleepEndOfTrack = useCallback(() => {
    const remaining = getActiveDeckRemaining();
    if (remaining !== null && remaining > 0) {
      handleSetSleepTimer(Math.ceil(remaining));
    }
  }, [getActiveDeckRemaining, handleSetSleepTimer]);

  useEffect(() => {
    if (!sleepEnd) return;
    const id = setInterval(() => {
      const left = Math.max(0, Math.ceil((sleepEnd - Date.now()) / 1000));
      setSleepLeft(left);
      if (left <= 0) {
        setSleepEnd(null);
        setSleepLeft(null);
        if (useAudioStore.getState().isPlaying) togglePlay();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [sleepEnd, togglePlay]);

  // ── Keyboard Shortcuts ────────────────────────────────────────────────────
  const keydownRef = useRef<((e: KeyboardEvent) => void) | null>(null);
  useEffect(() => {
    keydownRef.current = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const key = e.key;
      if (key === ' ')           { e.preventDefault(); togglePlay(); }
      else if (key === 'ArrowLeft')  { e.preventDefault(); prevTrack(); }
      else if (key === 'ArrowRight') { e.preventDefault(); nextTrack(); }
      else if (key === 'm' || key === 'M') {
        const v = useAudioStore.getState().volume;
        setVolume(v > 0 ? 0 : 0.8);
      } else if (key === 'ArrowUp') {
        e.preventDefault();
        setVolume(Math.min(1, useAudioStore.getState().volume + 0.05));
      } else if (key === 'ArrowDown') {
        e.preventDefault();
        setVolume(Math.max(0, useAudioStore.getState().volume - 0.05));
      }
    };
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => keydownRef.current?.(e);
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── Power saving: pause CSS animations & RAF when tab is hidden ───────────
  useEffect(() => {
    const onVisibility = () => {
      document.documentElement.dataset.hidden = document.hidden ? 'true' : 'false';
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSelectTrack = (key: string) => {
    togglePlay(key);
    if (isMobile()) setSidebarOpen(false);
  };

  const handlePlayPause = () => togglePlay();

  return (
    <div
      className={`player ${sidebarOpen ? 'player--sidebar-open' : ''}`}
      style={{ '--theme-color': themeColor } as React.CSSProperties}
      data-category={currentTrack?.category ?? ''}
    >
      {/* Full-screen reactive visualizer (z-index: 0) */}
      <AudioVisualizer analyser={analyser} />

      {/* Atmospheric blob/aurora layer — category-aware ambient glow */}
      <div className="player__atmos" aria-hidden="true" />

      {/* Per-track color tint overlay */}
      <div className="player__tint" />

      {/* Mobile hamburger — only visible on small screens */}
      <button
        className="player__mobile-menu"
        onClick={() => setSidebarOpen(prev => !prev)}
        aria-label={sidebarOpen ? 'Close library' : 'Open library'}
      >
        {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
        {!sidebarOpen && <span>Library</span>}
      </button>

      {/* Backdrop — closes sidebar when clicking outside (mobile + desktop) */}
      {sidebarOpen && (
        <div
          className="player__backdrop"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* == SIDEBAR == */}
      <Sidebar
        currentTrackId={currentTrackId}
        isPlaying={isPlaying}
        onSelectTrack={handleSelectTrack}
        onClose={() => setSidebarOpen(false)}
      />

      {/* == MAIN STAGE == */}
      <NowPlaying
        emoji={currentTrack?.emoji}
        title={currentTrack?.label}
        sidebarOpen={sidebarOpen}
        onOpenSidebar={() => setSidebarOpen(true)}
      />

      {/* == BOTTOM BAR == */}
      <BottomBar
        emoji={currentTrack?.emoji}
        title={currentTrack?.label}
        isPlaying={isPlaying}
        volume={volume}
        sleepSecondsLeft={sleepLeft}
        onPlayPause={handlePlayPause}
        onVolumeChange={setVolume}
        onPrev={prevTrack}
        onNext={nextTrack}
        onSetSleepTimer={handleSetSleepTimer}
        onSleepEndOfTrack={handleSleepEndOfTrack}
      />
    </div>
  );
};
