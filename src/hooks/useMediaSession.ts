import { useEffect, useRef } from 'react';
import { TRACKS } from '../constants/tracks';
import { getCachedArtworkUrl, prewarmArtworkCache } from '../utils/generateArtwork';

interface UseMediaSessionOptions {
  currentTrackId: string | null;
  isPlaying: boolean;
  onPlayPause: () => void;
  onNext: () => void;
  onPrev: () => void;
}

/**
 * Integrates with the OS Media Session API:
 * - Per-track artwork (emoji + theme color) shown in Android/iOS notification & lock screen
 * - Playback state kept in sync so the OS shows the correct play/pause icon
 * - Action handlers registered ONCE via refs — prevents the blinking caused by
 *   re-registering handlers on every render when callback props change identity
 */
export const useMediaSession = ({
  currentTrackId,
  isPlaying,
  onPlayPause,
  onNext,
  onPrev,
}: UseMediaSessionOptions) => {
  // ── Stable refs — always hold the latest callbacks without causing re-effects ──
  const playPauseRef = useRef(onPlayPause);
  const nextRef      = useRef(onNext);
  const prevRef      = useRef(onPrev);
  // Keep refs up to date on every render (no deps array = always runs)
  useEffect(() => { playPauseRef.current = onPlayPause; });
  useEffect(() => { nextRef.current      = onNext;      });
  useEffect(() => { prevRef.current      = onPrev;      });

  // ── Pre-warm artwork for all tracks on mount (background, low priority) ──
  // This ensures blob: URLs are cached before the user plays any track,
  // so metadata is always set once with artwork (no flicker).
  useEffect(() => {
    const id = requestIdleCallback
      ? requestIdleCallback(() => prewarmArtworkCache(), { timeout: 5000 })
      : setTimeout(() => prewarmArtworkCache(), 2000) as unknown as number;
    return () => {
      requestIdleCallback ? cancelIdleCallback(id) : clearTimeout(id);
    };
  }, []);

  // ── Register action handlers exactly ONCE ────────────────────────────────
  // Each handler delegates to the latest ref value, so no re-registration needed.
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ['play',          () => playPauseRef.current()],
      ['pause',         () => playPauseRef.current()],
      ['nexttrack',     () => nextRef.current()],
      ['previoustrack', () => prevRef.current()],
      ['stop',          () => playPauseRef.current()],
    ];

    handlers.forEach(([action, handler]) => {
      try { navigator.mediaSession.setActionHandler(action, handler); }
      catch { /* browser may not support all actions */ }
    });

    return () => {
      handlers.forEach(([action]) => {
        try { navigator.mediaSession.setActionHandler(action, null); }
        catch { /* ignore */ }
      });
    };
  }, []); // empty — register once only

  // ── Update metadata + artwork when track changes ─────────────────────────
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    const track = TRACKS.find(t => t.key === currentTrackId);
    if (!track) {
      navigator.mediaSession.metadata = null;
      return;
    }

    const categoryLabel =
      track.category === 'devotional' ? 'Devotional · Spiritual' :
      track.category === 'meditation' ? 'Meditation · Healing' :
      'Nature · Ambient';

    // Set metadata exactly ONCE — with artwork included.
    // getCachedArtworkUrl is instant for pre-warmed tracks (Promise.resolve).
    // Setting metadata twice (without then with artwork) causes Android to
    // briefly clear the notification, producing the visible→invisible flicker.
    let cancelled = false;
    getCachedArtworkUrl(track.emoji, track.theme).then(artworkUrl => {
      if (cancelled) return;
      navigator.mediaSession.metadata = new MediaMetadata({
        title:  track.label,
        artist: 'Ambient Music Player',
        album:  categoryLabel,
        artwork: [{ src: artworkUrl, sizes: '512x512', type: 'image/png' }],
      });
    });

    return () => { cancelled = true; };
  }, [currentTrackId]);

  // ── Sync playback state ───────────────────────────────────────────────────
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }, [isPlaying]);
};
