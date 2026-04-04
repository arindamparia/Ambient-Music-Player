import React from 'react';
import { Play, Pause, ListMusic, PanelLeftClose } from 'lucide-react';
import { TRACKS } from '../../constants/tracks';
import './Sidebar.css';

interface SidebarProps {
  currentTrackId: string | null;
  isPlaying: boolean;
  onSelectTrack: (key: string) => void;
  onClose: () => void;
}

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

export const Sidebar: React.FC<SidebarProps> = ({ currentTrackId, isPlaying, onSelectTrack, onClose }) => (
  <aside className="sidebar">
    <div className="sidebar__header">
      <ListMusic size={16} />
      <h2 className="sidebar__title">Library</h2>
      <button className="sidebar__close-btn" onClick={onClose} title="Collapse Library">
        <PanelLeftClose size={17} />
      </button>
    </div>

    <div className="sidebar__track-list">
      {TRACKS.map((track) => (
        <TrackItem
          key={track.key}
          track={track}
          isCurrent={currentTrackId === track.key && isPlaying}
          isSelected={currentTrackId === track.key && !isPlaying}
          onSelect={() => onSelectTrack(track.key)}
        />
      ))}
    </div>
  </aside>
);
