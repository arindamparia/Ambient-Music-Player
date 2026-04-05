import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ListMusic, PanelLeftOpen, BarChart2, Activity } from 'lucide-react';
import { useAudioStore } from '../../store/useAudioStore';
import { BreathingGuide } from '../BreathingGuide/BreathingGuide';
import './NowPlaying.css';

interface NowPlayingProps {
  emoji: string | undefined;
  title: string | undefined;
  sidebarOpen: boolean;
  isPlaying: boolean;
  onOpenSidebar: () => void;
  onPlayPause: () => void;
}

export const NowPlaying: React.FC<NowPlayingProps> = ({
  emoji,
  title,
  sidebarOpen,
  isPlaying,
  onOpenSidebar,
  onPlayPause,
}) => {
  const { visualizerMode, setVisualizerMode } = useAudioStore();

  return (
    <div className="now-playing">
      {/* Open Library button — visible only when sidebar is collapsed */}
      <AnimatePresence>
        {!sidebarOpen && (
          <motion.button
            key="open-btn"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
            className="open-library-btn"
            onClick={onOpenSidebar}
            title="Open Library"
          >
            <PanelLeftOpen size={18} />
            <span>Library</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Visualizer mode toggle — top-right */}
      <button
        className="viz-toggle-btn"
        onClick={() => setVisualizerMode(visualizerMode === 'bars' ? 'waves' : 'bars')}
        title={visualizerMode === 'bars' ? 'Switch to wave visualizer' : 'Switch to bar visualizer'}
        aria-label="Toggle visualizer mode"
      >
        {visualizerMode === 'bars' ? <Activity size={15} /> : <BarChart2 size={15} />}
        <span>{visualizerMode === 'bars' ? 'Wave' : 'Bars'}</span>
      </button>

      {/* Breathing guide (meditation only, renders behind hero) */}
      <BreathingGuide />

      <AnimatePresence mode="popLayout">
        {emoji && title ? (
          <motion.div
            key={title}
            initial={{ opacity: 0, scale: 0.92, y: 24, filter: 'blur(12px) saturate(0)' }}
            animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px) saturate(1)' }}
            exit={{ opacity: 0, scale: 1.04, filter: 'blur(22px) saturate(0)' }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="now-playing__hero"
          >
            <div
              className={`now-playing__orb${isPlaying ? ' now-playing__orb--playing' : ''}`}
              onClick={onPlayPause}
              role="button"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >{emoji}</div>
            <h1 className="now-playing__title">{title}</h1>
            <p className="now-playing__subtitle">Ambient · Radio</p>
          </motion.div>
        ) : (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="now-playing__idle"
          >
            <ListMusic size={36} />
            <p>Choose a soundscape from the Library</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
