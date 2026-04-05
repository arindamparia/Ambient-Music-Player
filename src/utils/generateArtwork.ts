/**
 * Generates a 512×512 PNG data-URL to use as Media Session artwork.
 * Each track gets a unique background derived from its theme color and emoji,
 * so the Android/iOS notification and lock screen show a fitting visual.
 */
export const generateArtwork = (emoji: string, themeColor: string): string => {
  const SIZE = 512;
  const canvas = document.createElement('canvas');
  canvas.width  = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;

  // ── Background: radial gradient from theme color ─────────────────────────
  const r = parseInt(themeColor.slice(1, 3), 16);
  const g = parseInt(themeColor.slice(3, 5), 16);
  const b = parseInt(themeColor.slice(5, 7), 16);

  const bg = ctx.createRadialGradient(SIZE / 2, SIZE / 2, 0, SIZE / 2, SIZE / 2, SIZE * 0.72);
  bg.addColorStop(0,   `rgba(${r},${g},${b}, 1)`);
  bg.addColorStop(0.6, `rgba(${Math.round(r * 0.55)},${Math.round(g * 0.55)},${Math.round(b * 0.55)}, 1)`);
  bg.addColorStop(1,   `rgba(${Math.round(r * 0.18)},${Math.round(g * 0.18)},${Math.round(b * 0.18)}, 1)`);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // ── Subtle noise vignette rings ──────────────────────────────────────────
  for (let i = 3; i >= 1; i--) {
    const ring = ctx.createRadialGradient(SIZE / 2, SIZE / 2, SIZE * 0.22 * i, SIZE / 2, SIZE / 2, SIZE * 0.28 * i);
    ring.addColorStop(0,   'rgba(255,255,255,0.03)');
    ring.addColorStop(0.5, 'rgba(255,255,255,0)');
    ring.addColorStop(1,   'rgba(0,0,0,0.06)');
    ctx.fillStyle = ring;
    ctx.fillRect(0, 0, SIZE, SIZE);
  }

  // ── Glow circle behind emoji ─────────────────────────────────────────────
  const glow = ctx.createRadialGradient(SIZE / 2, SIZE / 2, 0, SIZE / 2, SIZE / 2, SIZE * 0.38);
  glow.addColorStop(0,   `rgba(255,255,255,0.18)`);
  glow.addColorStop(0.5, `rgba(255,255,255,0.06)`);
  glow.addColorStop(1,   'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(SIZE / 2, SIZE / 2, SIZE * 0.38, 0, Math.PI * 2);
  ctx.fill();

  // ── Emoji centred ────────────────────────────────────────────────────────
  ctx.font         = `${Math.round(SIZE * 0.40)}px serif`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, SIZE / 2, SIZE / 2);

  return canvas.toDataURL('image/png');
};

// Cache so we don't regenerate on every re-render
const artworkCache = new Map<string, string>();

export const getCachedArtwork = (emoji: string, themeColor: string): string => {
  const key = `${emoji}-${themeColor}`;
  if (!artworkCache.has(key)) {
    artworkCache.set(key, generateArtwork(emoji, themeColor));
  }
  return artworkCache.get(key)!;
};
