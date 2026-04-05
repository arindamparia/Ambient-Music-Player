import { useEffect } from 'react';
import { TRACKS } from '../constants/tracks';
import { getCachedArtwork } from '../utils/generateArtwork';

interface UseMediaSessionOptions {
  currentTrackId: string | null;
  isPlaying: boolean;
  onPlayPause: () => void;
  onNext: () => void;
  onPrev: () => void;
}

/**
 * Integrates with the OS Media Session API so that:
 * - Track title, category, and app artwork appear in the Android/iOS notification
 *   shade and lock screen while audio plays in the background.
 * - Hardware/software media controls (headset buttons, lock screen buttons,
 *   notification play/pause/next/prev) are wired to the player.
 *
 * Supported: Android Chrome, iOS Safari 16.4+ (PWA), desktop Chrome/Edge/Safari.
 */
export const useMediaSession = ({
  currentTrackId,
  isPlaying,
  onPlayPause,
  onNext,
  onPrev,
}: UseMediaSessionOptions) => {
  // ── Update metadata whenever the track changes ──────────────────────────
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

    // Generate a unique 512×512 artwork for this track (theme color + emoji)
    const artworkDataUrl = getCachedArtwork(track.emoji, track.theme);

    navigator.mediaSession.metadata = new MediaMetadata({
      title:  track.label,
      artist: 'Ambient Music Player',
      album:  categoryLabel,
      artwork: [
        { src: artworkDataUrl, sizes: '512x512', type: 'image/png' },
      ],
    });
  }, [currentTrackId]);

  // ── Sync playback state so the OS shows the correct icon ─────────────────
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }, [isPlaying]);

  // ── Register action handlers for notification / lock-screen controls ─────
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    const handlers: [MediaSessionAction, () => void][] = [
      ['play',          onPlayPause],
      ['pause',         onPlayPause],
      ['nexttrack',     onNext],
      ['previoustrack', onPrev],
      ['stop',          onPlayPause],
    ];

    handlers.forEach(([action, handler]) => {
      try { navigator.mediaSession.setActionHandler(action, handler); }
      catch { /* some browsers don't support all actions */ }
    });

    return () => {
      handlers.forEach(([action]) => {
        try { navigator.mediaSession.setActionHandler(action, null); }
        catch { /* ignore */ }
      });
    };
  }, [onPlayPause, onNext, onPrev]);
};
