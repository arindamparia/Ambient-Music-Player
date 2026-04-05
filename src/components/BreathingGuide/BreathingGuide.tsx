import { useState, useEffect } from 'react';
import { useAudioStore } from '../../store/useAudioStore';
import { TRACKS } from '../../constants/tracks';
import './BreathingGuide.css';

type Phase = 'inhale' | 'hold-in' | 'exhale' | 'hold-out';

const PHASES: Phase[] = ['inhale', 'hold-in', 'exhale', 'hold-out'];
const DURATIONS: Record<Phase, number> = {
  'inhale':   4000,
  'hold-in':  1500,
  'exhale':   5000,
  'hold-out': 1500,
};
const LABELS: Record<Phase, string> = {
  'inhale':   'Inhale',
  'hold-in':  'Hold',
  'exhale':   'Exhale',
  'hold-out': '',
};

export const BreathingGuide = () => {
  const { isPlaying, currentTrackId } = useAudioStore();
  const track = TRACKS.find(t => t.key === currentTrackId);
  const show = track?.category === 'meditation' && isPlaying;

  const [phaseIdx, setPhaseIdx] = useState(0);
  const phase = PHASES[phaseIdx];

  useEffect(() => {
    if (!show) { setTimeout(() => setPhaseIdx(0), 0); return; }
    const t = setTimeout(() => setPhaseIdx(i => (i + 1) % 4), DURATIONS[phase]);
    return () => clearTimeout(t);
  }, [phaseIdx, show, phase]);

  if (!show) return null;

  return (
    <div className="breathing-guide" aria-hidden="true">
      <div className={`breathing-guide__ring breathing-guide__ring--${phase}`} />
      {LABELS[phase] && (
        <span className={`breathing-guide__label breathing-guide__label--${phase}`}>
          {LABELS[phase]}
        </span>
      )}
    </div>
  );
};
