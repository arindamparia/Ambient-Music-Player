/**
 * Player.tsx — layout orchestrator only.
 * All UI segments live in their own components (Sidebar, NowPlaying, BottomBar).
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Menu, X } from 'lucide-react';
import { TRACKS } from '../constants/tracks';
import { useAudioStore } from '../store/useAudioStore';
import { useTwinDeckAudio } from '../hooks/useTwinDeckAudio';
import { useMediaSession } from '../hooks/useMediaSession';
import { AudioVisualizer } from './AudioVisualizer/AudioVisualizer';
import { Sidebar } from './Sidebar/Sidebar';
import { NowPlaying } from './NowPlaying/NowPlaying';
import { BottomBar } from './BottomBar/BottomBar';
import { ParticleOverlay } from './ParticleOverlay/ParticleOverlay';
import './Player.css';

export const Player: React.FC = () => {
  const { currentTrackId, isPlaying, volume, setVolume } = useAudioStore();
  const { togglePlay, nextTrack, prevTrack, analyserRef, getActiveDeckRemaining } = useTwinDeckAudio();

  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768);
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMobile = () => window.innerWidth < 768;

  // Show controls and (re)start the 4s inactivity timer
  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (isPlaying) {
      hideTimerRef.current = setTimeout(() => setControlsVisible(false), 4000);
    }
  }, [isPlaying]);

  // Reset timer whenever isPlaying changes
  useEffect(() => {
    if (!isPlaying) {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      setTimeout(() => setControlsVisible(true), 0);
    } else {
      setTimeout(() => showControls(), 0);
    }
    return () => { if (hideTimerRef.current) clearTimeout(hideTimerRef.current); };
  }, [isPlaying, showControls]);

  const currentTrack = TRACKS.find(t => t.key === currentTrackId);
  const themeColor = currentTrack?.theme ?? '#4c1d95';

  // ── Sleep Timer ───────────────────────────────────────────────────────────
  const [sleepEnd, setSleepEnd] = useState<number | null>(null);
  const [sleepLeft, setSleepLeft] = useState<number | null>(null);
  const [sleepTotal, setSleepTotal] = useState<number | null>(null);

  const handleSetSleepTimer = useCallback((seconds: number | null) => {
    if (seconds === null) {
      setSleepEnd(null);
      setSleepLeft(null);
      setSleepTotal(null);
      return;
    }
    const end = Date.now() + seconds * 1000;
    setSleepEnd(end);
    setSleepLeft(Math.ceil(seconds));
    setSleepTotal(Math.ceil(seconds));
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
        setSleepTotal(null);
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

  // ── Media Session (OS notification + lock screen controls) ───────────────
  const handleMediaPlayPause = useCallback(() => togglePlay(), [togglePlay]);
  useMediaSession({
    currentTrackId,
    isPlaying,
    onPlayPause: handleMediaPlayPause,
    onNext: nextTrack,
    onPrev: prevTrack,
  });

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSelectTrack = (key: string) => {
    togglePlay(key);
    if (isMobile()) setSidebarOpen(false);
  };

  const handlePlayPause = () => togglePlay();

  return (
    <div
      className={`player ${sidebarOpen ? 'player--sidebar-open' : ''}${!controlsVisible ? ' player--controls-hidden' : ''}`}
      style={{ '--theme-color': themeColor } as React.CSSProperties}
      data-category={currentTrack?.category ?? ''}
      onPointerMove={showControls}
      onPointerDown={showControls}
      onKeyDown={showControls}
    >
      {/* Full-screen reactive visualizer (z-index: 0) */}
      <AudioVisualizer analyserRef={analyserRef} />

      {/* Category-specific particle effects (z-index: 1) */}
      <ParticleOverlay />

      {/* Atmospheric blob/aurora layer — category-aware ambient glow */}
      <div className="player__atmos" aria-hidden="true" />

      {/* Per-track color tint overlay */}
      <div className="player__tint" />

      {/* Film grain texture */}
      <div className="player__grain" aria-hidden="true" />

      {/* Vignette */}
      <div className="player__vignette" aria-hidden="true" />

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
          onPointerDown={(e) => { e.preventDefault(); setSidebarOpen(false); }}
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
        isPlaying={isPlaying}
        onOpenSidebar={() => setSidebarOpen(true)}
        onPlayPause={handlePlayPause}
      />

      {/* == BOTTOM BAR == */}
      <BottomBar
        emoji={currentTrack?.emoji}
        title={currentTrack?.label}
        isPlaying={isPlaying}
        volume={volume}
        sleepSecondsLeft={sleepLeft}
        sleepTotalSeconds={sleepTotal}
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
