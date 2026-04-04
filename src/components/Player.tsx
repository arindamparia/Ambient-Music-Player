/**
 * Player.tsx — layout orchestrator only.
 * All UI segments live in their own components (Sidebar, NowPlaying, BottomBar).
 */
import React, { useState } from 'react';
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
  const { togglePlay, analyser } = useTwinDeckAudio();

  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768);
  const isMobile = () => window.innerWidth < 768;

  const currentTrack = TRACKS.find(t => t.key === currentTrackId);
  const themeColor = currentTrack?.theme ?? '#4c1d95';

  const handleSelectTrack = (key: string) => {
    togglePlay(key);
    if (isMobile()) setSidebarOpen(false);
  };

  const handlePlayPause = () => togglePlay();

  return (
    <div
      className={`player ${sidebarOpen ? 'player--sidebar-open' : ''}`}
      style={{ '--theme-color': themeColor } as React.CSSProperties}
    >
      {/* Full-screen reactive visualizer (z-index: 0) */}
      <AudioVisualizer analyser={analyser} />

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
        onPlayPause={handlePlayPause}
        onVolumeChange={setVolume}
      />
    </div>
  );
};
