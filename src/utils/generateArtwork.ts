import { TRACKS } from '../constants/tracks';

/**
 * Generates a 512×512 PNG blob URL for use as Media Session artwork.
 * Uses blob: URLs (not data: URLs) because Chrome Android's MediaMetadata
 * rejects data: URLs — only http(s): and blob: URLs are accepted as artwork.
 */
const drawArtworkToCanvas = (emoji: string, themeColor: string): HTMLCanvasElement => {
  const SIZE = 512;
  const canvas = document.createElement('canvas');
  canvas.width  = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;

  const r = parseInt(themeColor.slice(1, 3), 16);
  const g = parseInt(themeColor.slice(3, 5), 16);
  const b = parseInt(themeColor.slice(5, 7), 16);

  // Background: radial gradient from theme color
  const bg = ctx.createRadialGradient(SIZE / 2, SIZE / 2, 0, SIZE / 2, SIZE / 2, SIZE * 0.72);
  bg.addColorStop(0,   `rgb(${r},${g},${b})`);
  bg.addColorStop(0.6, `rgb(${Math.round(r * 0.55)},${Math.round(g * 0.55)},${Math.round(b * 0.55)})`);
  bg.addColorStop(1,   `rgb(${Math.round(r * 0.18)},${Math.round(g * 0.18)},${Math.round(b * 0.18)})`);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Subtle vignette rings
  for (let i = 3; i >= 1; i--) {
    const ring = ctx.createRadialGradient(SIZE / 2, SIZE / 2, SIZE * 0.22 * i, SIZE / 2, SIZE / 2, SIZE * 0.28 * i);
    ring.addColorStop(0,   'rgba(255,255,255,0.03)');
    ring.addColorStop(0.5, 'rgba(255,255,255,0)');
    ring.addColorStop(1,   'rgba(0,0,0,0.06)');
    ctx.fillStyle = ring;
    ctx.fillRect(0, 0, SIZE, SIZE);
  }

  // Glow circle behind emoji
  const glow = ctx.createRadialGradient(SIZE / 2, SIZE / 2, 0, SIZE / 2, SIZE / 2, SIZE * 0.38);
  glow.addColorStop(0,   'rgba(255,255,255,0.18)');
  glow.addColorStop(0.5, 'rgba(255,255,255,0.06)');
  glow.addColorStop(1,   'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(SIZE / 2, SIZE / 2, SIZE * 0.38, 0, Math.PI * 2);
  ctx.fill();

  // Emoji centred
  ctx.font         = `${Math.round(SIZE * 0.40)}px serif`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, SIZE / 2, SIZE / 2);

  return canvas;
};

// Cache maps key → blob: URL (revoke-safe; we never revoke during the session)
const artworkCache = new Map<string, string>();

/**
 * Returns a Promise that resolves to a blob: URL for the track artwork.
 * Results are cached so each track only generates once per session.
 */
export const getCachedArtworkUrl = (emoji: string, themeColor: string): Promise<string> => {
  const key = `${emoji}-${themeColor}`;
  if (artworkCache.has(key)) return Promise.resolve(artworkCache.get(key)!);

  return new Promise<string>((resolve) => {
    const canvas = drawArtworkToCanvas(emoji, themeColor);
    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        artworkCache.set(key, url);
        resolve(url);
      } else {
        // Fallback to static icon if blob creation fails
        resolve('/icon.png');
      }
    }, 'image/png');
  });
};

/**
 * Pre-generates blob: URLs for all tracks so that getCachedArtworkUrl
 * resolves instantly (via Promise.resolve) when a track is played.
 * Call this once on mount during idle time.
 */
export const prewarmArtworkCache = (): void => {
  TRACKS.forEach(track => {
    getCachedArtworkUrl(track.emoji, track.theme);
  });
};
