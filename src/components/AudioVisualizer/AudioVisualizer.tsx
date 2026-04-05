import { useEffect, useRef, useLayoutEffect } from 'react';
import { useAudioStore } from '../../store/useAudioStore';
import { TRACKS, type Track } from '../../constants/tracks';
import './AudioVisualizer.css';

// 1. Update the prop interface to expect a ref object
interface AudioVisualizerProps {
  analyserRef: React.MutableRefObject<AnalyserNode | null>;
}

const lightenColor = (hex: string, amount = 0.5, alpha = 0.75): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${Math.round(r + (255 - r) * amount)},${Math.round(g + (255 - g) * amount)},${Math.round(b + (255 - b) * amount)},${alpha})`;
};

const hexToRgba = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

// On mobile (high-refresh-rate phones like S25 Ultra at 120 Hz), cap RAF to 60 fps
// to halve GPU work. Cap DPR to 2 — S25 Ultra DPR is 4, meaning 4× more canvas pixels
// than a standard HD screen, with no visible quality benefit for a music visualizer.
const IS_MOBILE_VIZ = window.innerWidth < 768 || navigator.maxTouchPoints > 0;
const VIZ_FRAME_MS = IS_MOBILE_VIZ ? 1000 / 60 : 0; // 0 = no throttle on desktop
const MAX_DPR = IS_MOBILE_VIZ ? 2 : (window.devicePixelRatio || 1);

// 2. Destructure the newly named prop
export const AudioVisualizer = ({ analyserRef }: AudioVisualizerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const barsReqRef = useRef<number>(0);
  const waveReqRef = useRef<number>(0);
  const { isPlaying, currentTrackId, visualizerMode } = useAudioStore();

  // Canvas resize (DPR-aware, capped on mobile)
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // BARS animation
  useEffect(() => {
    if (visualizerMode !== 'bars' || !isPlaying) {
      if (containerRef.current) {
        for (let i = 1; i <= 20; i++)
          containerRef.current.style.setProperty(`--bg-bar${i}`, '2vh');
        containerRef.current.style.setProperty('--opacity-state', '0');
      }
      return;
    }

    const track = TRACKS.find((t: Track) => t.key === currentTrackId);
    const isVoice = ['omNamahShivay', 'aadidevMahadev', 'ramSankirtan'].includes(currentTrackId || '');
    const category = track?.category ?? '';
    const themeColor = track?.theme || '#06d6a0';

    if (containerRef.current) {
      containerRef.current.style.setProperty('--bar-color', lightenColor(themeColor, 0.5, 0.8));
      containerRef.current.style.setProperty('--bar-color-dim', lightenColor(themeColor, 0.2, 0.25));
      containerRef.current.dataset.category = category;
    }

    // Initialize as null — we create this once the analyser is ready
    let dataArray: Uint8Array | null = null;
    let lastBarsFrame = 0;

    const animate = (now: number) => {
      barsReqRef.current = requestAnimationFrame(animate);
      if (VIZ_FRAME_MS > 0 && now - lastBarsFrame < VIZ_FRAME_MS - 0.5) return;

      // 3. Extract the analyser from the ref ON EVERY FRAME
      const analyser = analyserRef.current;
      if (!analyser || !containerRef.current) return;

      // Lazily instantiate the data array once we know the bin count
      if (!dataArray || dataArray.length !== analyser.frequencyBinCount) {
        dataArray = new Uint8Array(analyser.frequencyBinCount);
      }

      lastBarsFrame = now;
      analyser.getByteFrequencyData(dataArray);
      const bins = dataArray.length;
      const NUM_BARS = 20;

      const getEnergy = (startFrac: number, endFrac: number) => {
        const start = Math.floor(startFrac * bins);
        const end = Math.max(start + 1, Math.floor(endFrac * bins));
        let max = 0, sum = 0;
        // @ts-ignore - TS thinks dataArray might still be null here, but we guarantee it's not above
        for (let i = start; i < end; i++) { if (dataArray[i] > max) max = dataArray[i]; sum += dataArray[i]; }
        const avg = sum / (end - start);
        return isVoice ? ((max * 0.88) + (avg * 0.12)) / 255 : ((max * 0.72) + (avg * 0.28)) / 255;
      };

      const logMin = Math.log10(1);
      const logMax = Math.log10(bins * 0.85);
      let totalEnergy = 0;

      for (let i = 0; i < NUM_BARS; i++) {
        const s = Math.pow(10, logMin + (i / NUM_BARS) * (logMax - logMin)) / bins;
        const e = Math.pow(10, logMin + ((i + 1) / NUM_BARS) * (logMax - logMin)) / bins;
        const raw = getEnergy(Math.min(s, 0.99), Math.min(e, 1.0));
        const v = isVoice ? Math.min(1, Math.pow(raw, 2.5) * 3.8)
          : category === 'devotional' ? Math.min(1, Math.pow(raw, 2.0) * 3.2)
            : category === 'meditation' ? Math.min(1, Math.pow(raw, 1.5) * 1.8)
              : Math.min(1, Math.pow(raw, 1.2) * 2.2);
        const jt = category === 'nature' ? (Math.random() - 0.5) * 4.5
          : category === 'meditation' ? (Math.random() - 0.5) * 1.0
            : isVoice ? 0 : (Math.random() - 0.5) * 2.0;
        const bgH = Math.max(9, Math.min(98, 9 + v * 84 + jt));
        totalEnergy += v;
        containerRef.current!.style.setProperty(`--bg-bar${i + 1}`, `${bgH}vh`);
        containerRef.current!.style.setProperty(`--bar${i + 1}`, `${Math.max(3, Math.min(18, 3 + v * 15))}px`);
      }

      const avgEnergy = totalEnergy / NUM_BARS;
      containerRef.current.style.setProperty('--glow-blur', `${Math.round(avgEnergy * 220)}px`);
      containerRef.current.style.setProperty('--opacity-state', String(Math.min(0.75, 0.25 + avgEnergy * 0.9)));
    };

    animate(0);
    return () => { cancelAnimationFrame(barsReqRef.current); barsReqRef.current = 0; };
  }, [isPlaying, currentTrackId, visualizerMode, analyserRef]);
  // ^ Removed 'analyser' from deps, added 'analyserRef'

  // WAVE animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (visualizerMode !== 'waves' || !isPlaying) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    const track = TRACKS.find((t: Track) => t.key === currentTrackId);
    const category = track?.category ?? '';
    const themeColor = track?.theme || '#06d6a0';

    const NUM_POINTS = 90;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Exponential moving-average height per point — smooths frame-to-frame jitter.
    const smoothA = new Float32Array(NUM_POINTS + 1);
    const smoothB = new Float32Array(NUM_POINTS + 1);
    const lerpA = category === 'meditation' ? 0.07 : 0.16;
    const lerpB = lerpA * 0.38;

    let dataArray: Uint8Array | null = null;
    let lastWaveFrame = 0;

    const animate = (now: number) => {
      waveReqRef.current = requestAnimationFrame(animate);
      if (VIZ_FRAME_MS > 0 && now - lastWaveFrame < VIZ_FRAME_MS - 0.5) return;

      // 4. Extract analyser from ref
      const analyser = analyserRef.current;
      if (!analyser) return;

      if (!dataArray || dataArray.length !== analyser.frequencyBinCount) {
        dataArray = new Uint8Array(analyser.frequencyBinCount);
      }

      lastWaveFrame = now;

      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      const W = window.innerWidth;
      const H = window.innerHeight;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      analyser.getByteFrequencyData(dataArray);
      const bins = dataArray.length;
      const logMin = Math.log10(1);
      const logMax = Math.log10(bins * 0.85);

      const MAX_H = H * 0.55;
      const BASE_Y = H;

      for (let i = 0; i <= NUM_POINTS; i++) {
        const frac = i / NUM_POINTS;
        const binIdx = Math.floor(Math.pow(10, logMin + frac * (logMax - logMin)));
        const raw = dataArray[Math.min(binIdx, bins - 1)] / 255;
        const v = category === 'meditation' ? Math.min(1, Math.pow(raw, 1.5) * 1.8)
          : category === 'devotional' ? Math.min(1, Math.pow(raw, 2.0) * 3.0)
            : Math.min(1, Math.pow(raw, 1.2) * 2.2);
        const target = Math.max(H * 0.025, v * MAX_H);
        smoothA[i] += (target - smoothA[i]) * lerpA;
        smoothB[i] += (smoothA[i] - smoothB[i]) * lerpB;
      }

      const addCurve = (pts: Float32Array, startWith: 'moveTo' | 'lineTo') => {
        const x0 = 0, y0 = BASE_Y - pts[0];
        startWith === 'lineTo' ? ctx.lineTo(x0, y0) : ctx.moveTo(x0, y0);
        for (let i = 0; i < NUM_POINTS; i++) {
          const x1 = ((i + 1) / NUM_POINTS) * W;
          const y1 = BASE_Y - pts[i + 1];
          const mx = (i / NUM_POINTS * W + x1) / 2;
          const my = ((BASE_Y - pts[i]) + y1) / 2;
          ctx.quadraticCurveTo(i / NUM_POINTS * W, BASE_Y - pts[i], mx, my);
        }
        ctx.lineTo(W, BASE_Y - pts[NUM_POINTS]);
      };

      // ── Shadow wave
      ctx.beginPath();
      ctx.moveTo(0, BASE_Y);
      addCurve(smoothB, 'lineTo');
      ctx.lineTo(W, BASE_Y);
      ctx.closePath();
      const gradB = ctx.createLinearGradient(0, BASE_Y - MAX_H, 0, BASE_Y);
      gradB.addColorStop(0, hexToRgba(themeColor, 0.12));
      gradB.addColorStop(0.6, hexToRgba(themeColor, 0.07));
      gradB.addColorStop(1, hexToRgba(themeColor, 0.02));
      ctx.fillStyle = gradB;
      ctx.fill();

      // ── Primary wave
      ctx.beginPath();
      ctx.moveTo(0, BASE_Y);
      addCurve(smoothA, 'lineTo');
      ctx.lineTo(W, BASE_Y);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, BASE_Y - MAX_H, 0, BASE_Y);
      grad.addColorStop(0, hexToRgba(themeColor, 0.52));
      grad.addColorStop(0.45, hexToRgba(themeColor, 0.20));
      grad.addColorStop(1, hexToRgba(themeColor, 0.05));
      ctx.fillStyle = grad;
      ctx.fill();

      // ── Glowing edge
      ([
        [10, 0.03], [5, 0.09], [2, 0.32], [1, 0.78],
      ] as [number, number][]).forEach(([lw, a]) => {
        ctx.beginPath();
        addCurve(smoothA, 'moveTo');
        ctx.strokeStyle = hexToRgba(themeColor, a);
        ctx.lineWidth = lw;
        ctx.stroke();
      });
    };

    animate(0);
    return () => { cancelAnimationFrame(waveReqRef.current); waveReqRef.current = 0; };
  }, [isPlaying, currentTrackId, visualizerMode, analyserRef]);

  return (
    <div className="visualizer-root" ref={containerRef}>
      <div className="visualizer-glow" />
      <canvas
        ref={canvasRef}
        className={`visualizer-canvas${visualizerMode === 'waves' ? ' visualizer-canvas--active' : ''}`}
      />
      <div className={`visualizer-bg-bars${visualizerMode === 'bars' ? '' : ' visualizer-bg-bars--hidden'}`}>
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className="bg-bar" style={{ height: `var(--bg-bar${i + 1}, 2vh)` }} />
        ))}
      </div>
    </div>
  );
};