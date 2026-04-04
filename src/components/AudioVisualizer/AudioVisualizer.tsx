import { useEffect, useRef } from 'react';
import { useAudioStore } from '../../store/useAudioStore';
import { TRACKS, type Track } from '../../constants/tracks';
import './AudioVisualizer.css';

interface AudioVisualizerProps {
  analyser: AnalyserNode | null;
}

// Lighten a hex color by blending toward white — keeps hue, guarantees visibility
const lightenColor = (hex: string, amount = 0.5, alpha = 0.75): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lr = Math.round(r + (255 - r) * amount);
  const lg = Math.round(g + (255 - g) * amount);
  const lb = Math.round(b + (255 - b) * amount);
  return `rgba(${lr},${lg},${lb},${alpha})`;
};

export const AudioVisualizer = ({ analyser }: AudioVisualizerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>(0);
  const { isPlaying, currentTrackId } = useAudioStore();

  useEffect(() => {
    if (!analyser || !containerRef.current || !isPlaying) {
      // Reset bars when not playing
      if (containerRef.current) {
        for (let i = 1; i <= 20; i++) {
          containerRef.current.style.setProperty(`--bg-bar${i}`, '2vh');
        }
        containerRef.current.style.setProperty('--opacity-state', '0');
      }
      return;
    }

    const track = TRACKS.find((t: Track) => t.key === currentTrackId);
    const isVoice = ['omNamahShivay', 'aadidevMahadev', 'ramSankirtan'].includes(currentTrackId || '');
    const category = track?.category ?? '';
    const themeColor = track?.theme || '#06d6a0';

    // Set per-bar color + category attribute for CSS overrides
    if (containerRef.current) {
      containerRef.current.style.setProperty('--bar-color', lightenColor(themeColor, 0.5, 0.8));
      containerRef.current.style.setProperty('--bar-color-dim', lightenColor(themeColor, 0.2, 0.25));
      containerRef.current.dataset.category = category;
    }

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const animate = () => {
      requestRef.current = requestAnimationFrame(animate);
      if (!analyser || !containerRef.current) return;

      analyser.getByteFrequencyData(dataArray);

      const bins = dataArray.length; // 1024 bins with fftSize=2048
      const NUM_BARS = 20;

      const getEnergy = (startFrac: number, endFrac: number) => {
        const start = Math.floor(startFrac * bins);
        const end = Math.max(start + 1, Math.floor(endFrac * bins));
        let max = 0, sum = 0;
        for (let i = start; i < end; i++) {
          if (dataArray[i] > max) max = dataArray[i];
          sum += dataArray[i];
        }
        const avg = sum / (end - start);
        return isVoice
          ? ((max * 0.88) + (avg * 0.12)) / 255
          : ((max * 0.72) + (avg * 0.28)) / 255;
      };

      // 20 logarithmically-spaced bands: bass→treble left→right
      // With 1024 bins, each band covers a distinct frequency slice → natural multiple peaks
      const logMin = Math.log10(1);
      const logMax = Math.log10(bins * 0.85); // cap at ~87% of nyquist to skip noise floor

      let totalEnergy = 0;

      for (let i = 0; i < NUM_BARS; i++) {
        const s = Math.pow(10, logMin + (i / NUM_BARS) * (logMax - logMin)) / bins;
        const e = Math.pow(10, logMin + ((i + 1) / NUM_BARS) * (logMax - logMin)) / bins;

        const raw = getEnergy(Math.min(s, 0.99), Math.min(e, 1.0));

        // Devotional: sharp flame-like spikes (mantra/chant transients)
        // Nature: gentle organic curves (wind/rain/birds)
        // Voice overrides within devotional for extra sharpness
        const v = isVoice
          ? Math.min(1, Math.pow(raw, 2.5) * 3.8)
          : category === 'devotional'
            ? Math.min(1, Math.pow(raw, 2.0) * 3.2)
            : Math.min(1, Math.pow(raw, 1.2) * 2.2);  // nature: softer

        const jt = category === 'nature'
          ? (Math.random() - 0.5) * 4.5  // more organic movement
          : isVoice ? 0 : (Math.random() - 0.5) * 2.0;
        const bgH = Math.max(9, Math.min(98, 9 + v * 84 + jt));
        const smH = Math.max(3, Math.min(18, 3 + v * 15));

        totalEnergy += v;
        containerRef.current!.style.setProperty(`--bg-bar${i + 1}`, `${bgH}vh`);
        containerRef.current!.style.setProperty(`--bar${i + 1}`, `${smH}px`);
      }

      const avgEnergy = totalEnergy / NUM_BARS;
      containerRef.current.style.setProperty('--glow-blur', `${Math.round(avgEnergy * 220)}px`);
      containerRef.current.style.setProperty(
        '--opacity-state',
        String(Math.min(0.75, 0.25 + avgEnergy * 0.9))
      );
    };
    animate();
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [analyser, isPlaying, currentTrackId]);

  return (
    <div className="visualizer-root" ref={containerRef}>
      <div className="visualizer-glow" />
      <div className="visualizer-bg-bars">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="bg-bar"
            style={{ height: `var(--bg-bar${i + 1}, 2vh)` }}
          />
        ))}
      </div>
    </div>
  );
};
