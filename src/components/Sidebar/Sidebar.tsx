import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, ListMusic, PanelLeftClose, Search } from 'lucide-react';
import { TRACKS } from '../../constants/tracks';
import './Sidebar.css';

interface SidebarProps {
  currentTrackId: string | null;
  isPlaying: boolean;
  onSelectTrack: (key: string) => void;
  onClose: () => void;
}

type Category = 'all' | 'devotional' | 'nature';

const TrackItem = ({
  track,
  isCurrent,
  isSelected,
  onSelect,
}: {
  track: typeof TRACKS[number];
  isCurrent: boolean;
  isSelected: boolean;
  onSelect: () => void;
}) => (
  <button
    className={`track-item ${isCurrent ? 'track-item--playing' : ''} ${isSelected ? 'track-item--selected' : ''}`}
    onClick={onSelect}
    title={track.label}
  >
    <div className="track-item__icon">
      <span className="track-item__emoji" style={isCurrent ? { opacity: 0 } : {}}>{track.emoji}</span>
      <div className="track-item__play-overlay">
        {isCurrent
          ? <Pause size={15} fill="currentColor" />
          : <Play size={15} fill="currentColor" style={{ marginLeft: 2 }} />
        }
      </div>
    </div>

    <div className="track-item__meta">
      <span className="track-item__title">{track.label}</span>
      <span className="track-item__genre">Ambient · Radio</span>
    </div>

    {isCurrent && (
      <div className="track-item__eq">
        {Array.from({ length: 4 }).map((_, i) => (
          <span key={i} className="eq-bar" style={{ height: `var(--bar${i + 1}, 3px)` }} />
        ))}
      </div>
    )}
  </button>
);

const CAT_LABELS: Record<Category, string> = {
  all: 'All',
  devotional: '🕉 Devotional',
  nature: '🌿 Nature',
};

export const Sidebar: React.FC<SidebarProps> = ({ currentTrackId, isPlaying, onSelectTrack, onClose }) => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category>('all');

  const filtered = TRACKS.filter(t => {
    const matchesQuery = t.label.toLowerCase().includes(query.toLowerCase());
    const matchesCategory = category === 'all' || t.category === category;
    return matchesQuery && matchesCategory;
  });

  return (
    <aside className="sidebar">
      <div className="sidebar__header">
        <ListMusic size={16} />
        <h2 className="sidebar__title">Library</h2>
        <button className="sidebar__close-btn" onClick={onClose} title="Collapse Library">
          <PanelLeftClose size={17} />
        </button>
      </div>

      {/* Search */}
      <div className="sidebar__search">
        <Search size={13} className="sidebar__search-icon" />
        <input
          className="sidebar__search-input"
          type="text"
          placeholder="Search tracks…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>

      {/* Category tabs */}
      <div className="sidebar__cats">
        {(Object.keys(CAT_LABELS) as Category[]).map(c => (
          <button
            key={c}
            className={`sidebar__cat-btn ${category === c ? 'sidebar__cat-btn--active' : ''}`}
            onClick={() => setCategory(c)}
          >
            {CAT_LABELS[c]}
          </button>
        ))}
      </div>

      <div className="sidebar__track-list">
        {filtered.length === 0 && (
          <div className="sidebar__empty">No tracks found</div>
        )}
        {filtered.map((track, i) => (
          <motion.div
            key={track.key}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.28, delay: i * 0.03, ease: 'easeOut' }}
          >
            <TrackItem
              track={track}
              isCurrent={currentTrackId === track.key && isPlaying}
              isSelected={currentTrackId === track.key && !isPlaying}
              onSelect={() => onSelectTrack(track.key)}
            />
          </motion.div>
        ))}
      </div>
    </aside>
  );
};
