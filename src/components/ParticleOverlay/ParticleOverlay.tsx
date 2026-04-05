import { useMemo, useRef, useLayoutEffect, useEffect } from 'react';
import { useAudioStore } from '../../store/useAudioStore';
import { TRACKS } from '../../constants/tracks';
import './ParticleOverlay.css';

const rand = (min: number, max: number) => min + Math.random() * (max - min);

// Cap canvas RAF to 60 fps on mobile (high-refresh-rate phones like S25 Ultra run at 120 Hz
// by default, doubling CPU/GPU work and causing unnecessary heating).
const IS_MOBILE = window.innerWidth < 768 || navigator.maxTouchPoints > 0;
const FRAME_MS  = IS_MOBILE ? 1000 / 60 : 0; // 0 = no throttle (run at native refresh)

type ParticleType = 'rain' | 'leaves' | 'petals' | 'fireflies' | 'bubbles' | null;

const getParticleType = (category: string, trackKey: string | null): ParticleType => {
  if (category === 'devotional') return 'petals';
  if (category === 'meditation') return 'fireflies';
  if (category === 'nature') {
    if (trackKey === 'rain' || trackKey === 'rain2') return 'rain';
    if (trackKey === 'ocean' || trackKey === 'river') return 'bubbles';
    return 'leaves';
  }
  return null;
};

// ── Canvas Rain ───────────────────────────────────────────────────────────────
const WIND_SLOPE  = -0.22;
const DROP_COUNT  = 160;

interface Drop   { x: number; y: number; len: number; speed: number; opacity: number; width: number; }
interface Splash { x: number; y: number; rx: number; alpha: number; }

const RainCanvas = ({ active }: { active: boolean }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);
  const activeRef = useRef(active);
  useEffect(() => { activeRef.current = active; }, [active]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current!;
    const ctx    = canvas.getContext('2d')!;
    let W = 0, H = 0;
    const drops: Drop[]    = Array.from({ length: DROP_COUNT }, () => ({ x:0,y:0,len:0,speed:0,opacity:0,width:0 }));
    const splashes: Splash[] = [];

    const seedDrop = (d: Drop, preseeded: boolean) => {
      d.len     = 14 + Math.random() * 32;
      d.speed   = 8  + Math.random() * 18;
      const layer = Math.random();
      if (layer < 0.3)      { d.opacity = 0.06 + Math.random() * 0.1;  d.width = 0.4 + Math.random() * 0.6; d.speed *= 0.65; d.len *= 0.7; }
      else if (layer < 0.8) { d.opacity = 0.16 + Math.random() * 0.18; d.width = 0.8 + Math.random() * 0.8; }
      else                  { d.opacity = 0.34 + Math.random() * 0.2;  d.width = 1.4 + Math.random() * 1.2; d.speed *= 1.25; }
      const spawnW = W + H * Math.abs(WIND_SLOPE) + 100;
      d.x = Math.random() * spawnW;
      d.y = preseeded ? Math.random() * (H + d.len) - d.len : -d.len;
    };

    const resize = () => {
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = W; canvas.height = H;
      drops.forEach(d => seedDrop(d, true));
    };
    resize();
    window.addEventListener('resize', resize);

    let lastFrame = 0;
    const draw = (now: number) => {
      rafRef.current = requestAnimationFrame(draw);
      if (FRAME_MS > 0 && now - lastFrame < FRAME_MS - 0.5) return;
      lastFrame = now;
      if (!activeRef.current || document.hidden) return;
      ctx.clearRect(0, 0, W, H);
      for (const d of drops) {
        const dx = WIND_SLOPE * d.len, dy = d.len;
        const grad = ctx.createLinearGradient(d.x, d.y, d.x + dx, d.y + dy);
        grad.addColorStop(0,   `rgba(185,220,255,0)`);
        grad.addColorStop(0.4, `rgba(185,220,255,${d.opacity * 0.45})`);
        grad.addColorStop(1,   `rgba(210,238,255,${d.opacity})`);
        ctx.save(); ctx.strokeStyle = grad; ctx.lineWidth = d.width; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + dx, d.y + dy); ctx.stroke(); ctx.restore();
        d.y += d.speed; d.x += d.speed * WIND_SLOPE;
        if (d.y - d.len > H) {
          if (Math.random() < 0.18) splashes.push({ x: d.x, y: H - 3, rx: 0, alpha: Math.min(d.opacity * 2.2, 0.6) });
          seedDrop(d, false);
        }
      }
      for (let i = splashes.length - 1; i >= 0; i--) {
        const s = splashes[i];
        ctx.save(); ctx.strokeStyle = `rgba(185,220,255,${s.alpha})`; ctx.lineWidth = 0.6;
        ctx.beginPath(); ctx.ellipse(s.x, s.y, s.rx * 2.4, s.rx * 0.55, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
        s.rx += 0.8; s.alpha -= 0.042;
        if (s.alpha <= 0) splashes.splice(i, 1);
      }
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(rafRef.current); window.removeEventListener('resize', resize); };
  }, []);

  return <canvas ref={canvasRef} className="particle-canvas" />;
};

// ── Canvas Petals + Emoji Flowers (Devotional) ───────────────────────────────
// Marigold/rose petals AND lotus/blossom emojis fall together with the same
// physics: identical sway, rotation, and velocity ranges feel unified.

interface Petal { x: number; y: number; vx: number; vy: number; rot: number; rotSpeed: number; size: number; opacity: number; swayAmp: number; swayOffset: number; r: number; g: number; b: number; }
interface EmojiFlower { x: number; y: number; vx: number; vy: number; rot: number; rotSpeed: number; size: number; opacity: number; swayAmp: number; swayOffset: number; emoji: string; }

// Warm devotional palette: marigold, golden, rose, saffron
const PETAL_COLS   = [[255,160,30],[255,205,55],[255,120,80],[240,80,110],[255,230,100]] as const;
const PETAL_COUNT  = 32;
const FLOWER_EMOJIS = ['🪷', '🌸'] as const;
const FLOWER_COUNT  = 16;

const PetalsCanvas = ({ active, themeColor }: { active: boolean; themeColor: string }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);
  const activeRef = useRef(active);
  useEffect(() => { activeRef.current = active; }, [active]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current!;
    const ctx    = canvas.getContext('2d')!;
    let W = 0, H = 0, t = 0;

    const petals: Petal[] = Array.from({ length: PETAL_COUNT }, () =>
      ({ x:0,y:0,vx:0,vy:0,rot:0,rotSpeed:0,size:0,opacity:0,swayAmp:0,swayOffset:0,r:0,g:0,b:0 }));

    const flowers: EmojiFlower[] = Array.from({ length: FLOWER_COUNT }, () =>
      ({ x:0,y:0,vx:0,vy:0,rot:0,rotSpeed:0,size:0,opacity:0,swayAmp:0,swayOffset:0,emoji:'' }));

    const seedPetal = (p: Petal, preseeded: boolean) => {
      const [r,g,b] = PETAL_COLS[Math.floor(Math.random() * PETAL_COLS.length)];
      p.r = r; p.g = g; p.b = b;
      p.x = Math.random() * W;
      p.y = preseeded ? Math.random() * H : -(p.size + 10);
      p.vx = (Math.random() - 0.5) * 0.35;
      p.vy = +(0.8 + Math.random() * 0.45);
      p.rot = Math.random() * Math.PI * 2;
      p.rotSpeed = (Math.random() - 0.5) * 0.035;
      p.size = 3.5 + Math.random() * 5;
      p.opacity = 0.4 + Math.random() * 0.45;
      p.swayAmp = 0.25 + Math.random() * 0.6;
      p.swayOffset = Math.random() * Math.PI * 2;
    };

    const seedFlower = (f: EmojiFlower, preseeded: boolean) => {
      f.emoji = FLOWER_EMOJIS[Math.floor(Math.random() * FLOWER_EMOJIS.length)];
      f.x = Math.random() * W;
      f.y = preseeded ? Math.random() * H : -(f.size + 10);
      f.vx = (Math.random() - 0.5) * 0.25;
      f.vy = +(0.8 + Math.random() * 0.45);   // identical speed range to petals
      f.rot = Math.random() * Math.PI * 2;
      f.rotSpeed = (Math.random() - 0.5) * 0.02;
      f.size = 14 + Math.random() * 12;         // 14–26 px
      f.opacity = 0.45 + Math.random() * 0.45;
      f.swayAmp = 0.3 + Math.random() * 0.5;
      f.swayOffset = Math.random() * Math.PI * 2;
    };

    const resize = () => {
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = W; canvas.height = H;
      petals.forEach(p => seedPetal(p, true));
      flowers.forEach(f => seedFlower(f, true));
    };
    resize();
    window.addEventListener('resize', resize);

    let lastFrame = 0;
    const draw = (now: number) => {
      rafRef.current = requestAnimationFrame(draw);
      if (FRAME_MS > 0 && now - lastFrame < FRAME_MS - 0.5) return;
      lastFrame = now;
      if (!activeRef.current || document.hidden) return;
      ctx.clearRect(0, 0, W, H);
      t += 0.016;

      // ── Ellipse petals ───────────────────────────────────────────────────
      for (const p of petals) {
        const swayDx = Math.sin(t * 1.1 + p.swayOffset) * p.swayAmp * 0.5;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = `rgb(${p.r},${p.g},${p.b})`;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size * 0.48, p.size, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        p.x += p.vx + swayDx;
        p.y += p.vy;
        p.rot += p.rotSpeed;
        if (p.y > H + 20) seedPetal(p, false);
        if (p.x < -20)    p.x = W + 20;
        if (p.x > W + 20) p.x = -20;
      }

      // ── Emoji flowers (same physics as petals) ───────────────────────────
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      for (const f of flowers) {
        const swayDx = Math.sin(t * 1.1 + f.swayOffset) * f.swayAmp * 0.5;
        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.rotate(f.rot);
        ctx.globalAlpha = f.opacity;
        ctx.font = `${f.size}px serif`;
        ctx.fillText(f.emoji, 0, 0);
        ctx.restore();
        f.x += f.vx + swayDx;
        f.y += f.vy;
        f.rot += f.rotSpeed;
        if (f.y > H + 30) seedFlower(f, false);
        if (f.x < -30)    f.x = W + 30;
        if (f.x > W + 30) f.x = -30;
      }
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(rafRef.current); window.removeEventListener('resize', resize); };
  }, [themeColor]);

  return <canvas ref={canvasRef} className="particle-canvas" />;
};

// ── Canvas Fireflies (Meditation) ────────────────────────────────────────────
// Soft glowing orbs drift in gentle sine-wave paths and pulse like slow breaths.
// The trail fade (partial clear) gives each orb a comet-like persistence.

interface Firefly { baseX: number; baseY: number; vx: number; vy: number; phase: number; phaseSpeed: number; amplitude: number; size: number; opacity: number; pulsePhase: number; pulseSpeed: number; }

const FIREFLY_COUNT = 24;

const FirefliesCanvas = ({ active, themeColor }: { active: boolean; themeColor: string }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);
  const activeRef = useRef(active);
  useEffect(() => { activeRef.current = active; }, [active]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current!;
    const ctx    = canvas.getContext('2d')!;
    let W = 0, H = 0;

    const tr = parseInt(themeColor.slice(1, 3), 16);
    const tg = parseInt(themeColor.slice(3, 5), 16);
    const tb = parseInt(themeColor.slice(5, 7), 16);

    const flies: Firefly[] = Array.from({ length: FIREFLY_COUNT }, () =>
      ({ baseX:0,baseY:0,vx:0,vy:0,phase:0,phaseSpeed:0,amplitude:0,size:0,opacity:0,pulsePhase:0,pulseSpeed:0 }));

    const seed = (f: Firefly) => {
      f.baseX = Math.random() * W;
      f.baseY = H * 0.1 + Math.random() * H * 0.8;
      f.vx = (Math.random() - 0.5) * 0.10;
      f.vy = -(0.06 + Math.random() * 0.12);
      f.phase = Math.random() * Math.PI * 2;
      f.phaseSpeed = 0.007 + Math.random() * 0.011;
      f.amplitude = 18 + Math.random() * 40;
      f.size = 2.5 + Math.random() * 4.5;
      f.opacity = 0.45 + Math.random() * 0.5;
      f.pulsePhase = Math.random() * Math.PI * 2;
      f.pulseSpeed = 0.018 + Math.random() * 0.028;
    };

    const resize = () => {
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = W; canvas.height = H;
      flies.forEach(seed);
    };
    resize();
    window.addEventListener('resize', resize);

    let lastFrame = 0;
    const draw = (now: number) => {
      rafRef.current = requestAnimationFrame(draw);
      if (FRAME_MS > 0 && now - lastFrame < FRAME_MS - 0.5) return;
      lastFrame = now;
      if (!activeRef.current || document.hidden) return;

      // Partial clear → luminous trail effect
      ctx.fillStyle = 'rgba(0,0,0,0.055)';
      ctx.fillRect(0, 0, W, H);

      for (const f of flies) {
        f.phase += f.phaseSpeed;
        f.pulsePhase += f.pulseSpeed;
        f.baseX += f.vx;
        f.baseY += f.vy;

        const x = f.baseX + Math.sin(f.phase) * f.amplitude;
        const y = f.baseY + Math.cos(f.phase * 0.6) * (f.amplitude * 0.35);
        const pulse = 0.5 + 0.5 * Math.sin(f.pulsePhase);
        const alpha = f.opacity * pulse;
        const coreR = f.size * (0.75 + 0.25 * pulse);

        // Soft glow halo
        const grad = ctx.createRadialGradient(x, y, 0, x, y, coreR * 5.5);
        grad.addColorStop(0,   `rgba(${tr},${tg},${tb},${alpha})`);
        grad.addColorStop(0.35,`rgba(${tr},${tg},${tb},${alpha * 0.35})`);
        grad.addColorStop(1,   `rgba(${tr},${tg},${tb},0)`);
        ctx.beginPath(); ctx.fillStyle = grad;
        ctx.arc(x, y, coreR * 5.5, 0, Math.PI * 2); ctx.fill();

        // Bright white core
        ctx.beginPath(); ctx.fillStyle = `rgba(255,255,255,${alpha * 0.92})`;
        ctx.arc(x, y, coreR * 0.45, 0, Math.PI * 2); ctx.fill();

        if (f.baseY < -20)    { f.baseY = H + 20; f.baseX = Math.random() * W; f.phase = Math.random() * Math.PI * 2; }
        if (f.baseX < -60)    f.baseX = W + 60;
        if (f.baseX > W + 60) f.baseX = -60;
      }
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(rafRef.current); window.removeEventListener('resize', resize); };
  }, [themeColor]);

  return <canvas ref={canvasRef} className="particle-canvas" />;
};

// ── Main overlay ──────────────────────────────────────────────────────────────
export const ParticleOverlay = () => {
  const { isPlaying, currentTrackId } = useAudioStore();
  const track     = TRACKS.find(t => t.key === currentTrackId);
  const category  = track?.category ?? '';
  const themeColor = track?.theme ?? '#06d6a0';
  const type      = getParticleType(category, currentTrackId);

  const leafParticles = useMemo(() =>
    Array.from({ length: 14 }, (_, i) => {
      const dur = rand(7, 13);
      return {
        id: i, x: rand(-5, 85),
        delay: rand(-dur, 0),
        duration: dur,
        opacity: rand(0.45, 0.78),
        sx: `${rand(3, 7)}vw`,
        size: rand(14, 21),
        variant: (['a', 'b', 'c'] as const)[i % 3],
        emoji: (['🍃', '🍃', '🍂', '🌿', '🍁'] as const)[Math.floor(rand(0, 5))],
      };
    }), []);

  const bubbleParticles = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => ({
      id: i, x: rand(15, 85),
      delay: rand(0, 9),
      duration: rand(7, 13),
      size: rand(10, 32),
      opacity: rand(0.15, 0.4),
    })), []);

  if (!type || !isPlaying) return null;

  return (
    <div className={`particle-overlay particle-overlay--${type}`} aria-hidden="true">

      {type === 'rain'      && <RainCanvas      active={isPlaying} />}
      {type === 'fireflies' && <FirefliesCanvas active={isPlaying} themeColor={themeColor} />}

      {type === 'petals' && <PetalsCanvas active={isPlaying} themeColor={themeColor} />}

      {type === 'leaves' && leafParticles.map(p => (
        <div
          key={p.id}
          className={`particle particle--leaf particle--leaf-${p.variant}`}
          style={{
            left: `${p.x}vw`, fontSize: `${p.size}px`,
            '--p-opacity':  p.opacity, '--p-delay': `${p.delay}s`,
            '--p-duration': `${p.duration}s`, '--p-sx': p.sx,
          } as React.CSSProperties}
        >{p.emoji}</div>
      ))}

      {type === 'bubbles' && bubbleParticles.map(p => (
        <div
          key={p.id}
          className="particle particle--bubble"
          style={{
            left: `${p.x}vw`, width: `${p.size}px`, height: `${p.size}px`,
            '--p-opacity': p.opacity, '--p-delay': `${p.delay}s`, '--p-duration': `${p.duration}s`,
          } as React.CSSProperties}
        />
      ))}

    </div>
  );
};
