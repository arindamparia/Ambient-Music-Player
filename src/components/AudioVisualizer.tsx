import { useEffect, useRef } from 'react';
import { useAudioStore } from '../store/useAudioStore';
import { TRACKS } from '../constants/tracks';
import './AudioVisualizer.css';

interface AudioVisualizerProps {
  analyser: AnalyserNode | null;
}

// Map theme hex → rgba for CSS bar gradient
const hexToRgba = (hex: string, alpha: number) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
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

    const track = TRACKS.find(t => t.key === currentTrackId);
    const isVoice = ['omNamahShivay', 'aadidevMahadev', 'ramSankirtan'].includes(currentTrackId || '');
    const themeColor = track?.theme || '#06d6a0';

    // Set per-bar color using theme
    if (containerRef.current) {
      containerRef.current.style.setProperty(
        '--bar-color',
        hexToRgba(themeColor, 0.6)
      );
    }

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const animate = () => {
      requestRef.current = requestAnimationFrame(animate);
      if (!analyser || !containerRef.current) return;

      analyser.getByteFrequencyData(dataArray);

      const bins = dataArray.length; // 128 for fftSize=256

      // Build 20 reactive bands spread across spectrum
      const numBands = 20;
      const getEnergy = (startFrac: number, endFrac: number) => {
        const start = Math.floor(startFrac * bins);
        const end = Math.floor(endFrac * bins);
        let max = 0, sum = 0;
        for (let i = start; i < end; i++) {
          if (dataArray[i] > max) max = dataArray[i];
          sum += dataArray[i];
        }
        const avg = sum / Math.max(1, end - start);
        return isVoice
          ? ((max * 0.88) + (avg * 0.12)) / 255
          : ((max * 0.72) + (avg * 0.28)) / 255;
      };

      // Logarithmic spacing — bass bands are wider, treble narrower
      const logBands: Array<[number, number]> = [];
      const logMin = Math.log10(1);
      const logMax = Math.log10(bins);
      for (let i = 0; i < numBands; i++) {
        const s = Math.pow(10, logMin + (i / numBands) * (logMax - logMin)) / bins;
        const e = Math.pow(10, logMin + ((i + 1) / numBands) * (logMax - logMin)) / bins;
        logBands.push([Math.min(s, 0.99), Math.min(e, 1.0)]);
      }

      let totalEnergy = 0;

      logBands.forEach(([s, e], i) => {
        let raw = getEnergy(s, e);

        // Apply steeper curve for voice — more punchy reactivity
        let v: number;
        if (isVoice) {
          v = Math.min(1, Math.pow(raw, 2.2) * 3.5);
        } else {
          v = Math.min(1, Math.pow(raw, 1.6) * 2.4);
        }

        // Random organic micro-jitter for nature sounds
        const jt = isVoice ? 0 : (Math.random() - 0.5) * 3;

        // Bars fill 5vh minimum up to 98vh (nearly full screen!)
        const bgH = Math.max(5, Math.min(98, 5 + v * 88 + jt));

        // Small EQ bars (used in sidebar track row)
        const smH = Math.max(3, Math.min(18, 3 + v * 15));

        totalEnergy += v;

        containerRef.current!.style.setProperty(`--bg-bar${i + 1}`, `${bgH}vh`);
        containerRef.current!.style.setProperty(`--bar${i + 1}`, `${smH}px`);
      });

      const avgEnergy = totalEnergy / numBands;
      const glowSize = Math.round(avgEnergy * 220);
      containerRef.current.style.setProperty('--glow-blur', `${glowSize}px`);
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
