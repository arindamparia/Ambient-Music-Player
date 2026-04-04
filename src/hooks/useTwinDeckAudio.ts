import { useEffect, useRef, useCallback } from 'react';
import { useAudioStore } from '../store/useAudioStore';
import { AUDIO_URLS, TRACKS } from '../constants/tracks';

const CROSSFADE_SEC = 4.0;
// Linear mapping: slider 0-1 → gain 0-1x. No overdrive — keeps audio clean.
export const sliderToVol = (s: number) => s;
export const volToSlider = (v: number) => v;

export const useTwinDeckAudio = () => {
  const store = useAudioStore();

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);

  const deckARef = useRef<HTMLAudioElement | null>(null);
  const deckBRef = useRef<HTMLAudioElement | null>(null);
  const gainARef = useRef<GainNode | null>(null);
  const gainBRef = useRef<GainNode | null>(null);

  const activeDeckRef = useRef<'A' | 'B'>('A');
  const isFadingRef = useRef(false);
  const fadeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Wake Lock handle — keeps screen alive on mobile while playing
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const isPlayingRef = useRef(store.isPlaying);
  const currentTrackRef = useRef(store.currentTrackId);
  const volSliderRef = useRef(store.volume);

  useEffect(() => { isPlayingRef.current = store.isPlaying; }, [store.isPlaying]);
  useEffect(() => { currentTrackRef.current = store.currentTrackId; }, [store.currentTrackId]);
  useEffect(() => { volSliderRef.current = store.volume; }, [store.volume]);

  const getGainFor = useCallback((audio: HTMLAudioElement) =>
    audio === deckARef.current ? gainARef.current : gainBRef.current, []);

  // ── Wake Lock helpers ──────────────────────────────────────────────────────
  const acquireWakeLock = useCallback(async () => {
    if (!('wakeLock' in navigator)) return;
    try {
      if (wakeLockRef.current && !wakeLockRef.current.released) return;
      wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
    } catch (_) { /* permission denied or not supported */ }
  }, []);

  const releaseWakeLock = useCallback(() => {
    wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;
  }, []);

  // ── Sync Progress to DOM directly (60fps, no React re-render) ─────────────
  useEffect(() => {
    let raf: number;
    const updateProgress = () => {
      raf = requestAnimationFrame(updateProgress);
      if (document.hidden) return; // skip DOM updates when tab is not visible (saves GPU/CPU)
      const active = activeDeckRef.current === 'A' ? deckARef.current : deckBRef.current;
      if (active && active.duration) {
        const percent = (active.currentTime / active.duration) * 100;
        document.documentElement.style.setProperty('--track-progress', `${percent}%`);

        const format = (t: number) => {
          const m = Math.floor(t / 60);
          const s = Math.floor(t % 60);
          return `${m}:${s < 10 ? '0' : ''}${s}`;
        };

        const timeEl = document.getElementById('track-curr-time');
        if (timeEl) timeEl.innerText = format(active.currentTime);

        const durEl = document.getElementById('track-dur-time');
        if (durEl) durEl.innerText = format(active.duration);
      }
    };
    raf = requestAnimationFrame(updateProgress);
    return () => cancelAnimationFrame(raf);
  }, []);

  const doCrossfade = useCallback((fadeOutAudio: HTMLAudioElement, fadeInAudio: HTMLAudioElement) => {
    if (!audioCtxRef.current) return;

    isFadingRef.current = true;
    fadeInAudio.currentTime = 0;

    const fadeOutGain = getGainFor(fadeOutAudio);
    const fadeInGain = getGainFor(fadeInAudio);

    if (!fadeOutGain || !fadeInGain) return;

    const now = audioCtxRef.current.currentTime;
    const targetVol = sliderToVol(volSliderRef.current);

    fadeOutGain.gain.cancelScheduledValues(now);
    fadeInGain.gain.cancelScheduledValues(now);

    fadeOutGain.gain.setValueAtTime(fadeOutGain.gain.value || targetVol, now);
    fadeOutGain.gain.linearRampToValueAtTime(0.001, now + CROSSFADE_SEC);

    fadeInGain.gain.setValueAtTime(0.001, now);
    fadeInGain.gain.linearRampToValueAtTime(targetVol, now + CROSSFADE_SEC);

    fadeInAudio.play().catch(() => {});

    if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);

    fadeTimeoutRef.current = setTimeout(() => {
      if (!audioCtxRef.current) return;
      fadeOutGain.gain.cancelScheduledValues(audioCtxRef.current.currentTime);
      fadeInGain.gain.cancelScheduledValues(audioCtxRef.current.currentTime);

      fadeOutGain.gain.value = 0;
      fadeInGain.gain.value = sliderToVol(volSliderRef.current);

      fadeOutAudio.pause();
      fadeOutAudio.currentTime = 0;
      activeDeckRef.current = activeDeckRef.current === 'A' ? 'B' : 'A';
      isFadingRef.current = false;
    }, CROSSFADE_SEC * 1000 + 150);
  }, [getGainFor]);

  const initAudioSystem = useCallback(() => {
    if (audioCtxRef.current) return;

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioCtxRef.current = new AudioContextClass();

    // Analyser — FFT for visualizer (read-only, does not modify audio)
    analyserRef.current = audioCtxRef.current.createAnalyser();
    analyserRef.current.fftSize = 2048;
    analyserRef.current.smoothingTimeConstant = 0.6;
    analyserRef.current.minDecibels = -85;
    analyserRef.current.maxDecibels = -10;

    // DynamicsCompressor — prevents hard clipping when gain > 1x (overdrive)
    // Transparent at normal volumes, kicks in only at peaks above -3dBFS
    compressorRef.current = audioCtxRef.current.createDynamicsCompressor();
    compressorRef.current.threshold.value = -3;   // compress peaks above -3dBFS
    compressorRef.current.knee.value = 6;          // soft knee — natural limiting
    compressorRef.current.ratio.value = 4;         // 4:1 ratio — gentle
    compressorRef.current.attack.value = 0.003;    // 3ms — fast enough to catch transients
    compressorRef.current.release.value = 0.25;    // 250ms — smooth release

    const makeAudio = () => {
      const a = new Audio();
      a.preload = 'none';
      a.loop = false;
      a.crossOrigin = 'anonymous';
      a.volume = 1;
      return a;
    };

    deckARef.current = makeAudio();
    deckBRef.current = makeAudio();

    gainARef.current = audioCtxRef.current.createGain();
    gainBRef.current = audioCtxRef.current.createGain();

    // Signal chain: Deck → GainNode → Analyser → Compressor → Destination
    const wire = (audio: HTMLAudioElement, gain: GainNode) => {
      const src = audioCtxRef.current!.createMediaElementSource(audio);
      src.connect(gain);
      gain.connect(analyserRef.current!);
    };

    wire(deckARef.current, gainARef.current);
    wire(deckBRef.current, gainBRef.current);

    analyserRef.current.connect(compressorRef.current);
    compressorRef.current.connect(audioCtxRef.current.destination);

    const monitor = (deck: HTMLAudioElement, next: HTMLAudioElement) => {
      deck.addEventListener('timeupdate', () => {
        if (!isPlayingRef.current || isFadingRef.current) return;
        if (deck.duration && deck.currentTime >= deck.duration - CROSSFADE_SEC) {
          doCrossfade(deck, next);
        }
      });
    };

    monitor(deckARef.current, deckBRef.current);
    monitor(deckBRef.current, deckARef.current);
  }, [doCrossfade]);

  // ── Background audio persistence (Spotify/YT Music technique) ─────────────
  // When tab is hidden, browsers may suspend the AudioContext to save battery.
  // We resume it immediately on visibility change and re-acquire Wake Lock.
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        // Resume suspended AudioContext
        if (audioCtxRef.current?.state === 'suspended') {
          audioCtxRef.current.resume().catch(() => {});
        }
        // Re-acquire wake lock (it's automatically released when page is hidden)
        if (isPlayingRef.current) acquireWakeLock();
      } else {
        // Page hidden — ensure decks are still running (browser may have paused them)
        // We don't release wake lock manually; the OS does it. Just re-acquire on return.
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [acquireWakeLock]);

  const attachMediaSession = useCallback((trackKey: string) => {
    if (!('mediaSession' in navigator)) return;
    const track = TRACKS.find(t => t.key === trackKey);

    navigator.mediaSession.metadata = new MediaMetadata({
      title: track?.label || 'Ambient Sound',
      artist: 'Ambient UI',
      album: 'Deep Focus',
    });
    navigator.mediaSession.playbackState = 'playing';

    // Hardware button handlers (headset, lock screen, Car Play)
    navigator.mediaSession.setActionHandler('pause', () => {
      deckARef.current?.pause();
      deckBRef.current?.pause();
      store.setIsPlaying(false);
      navigator.mediaSession.playbackState = 'paused';
      releaseWakeLock();
    });
    navigator.mediaSession.setActionHandler('play', () => {
      const activeDeck = activeDeckRef.current === 'A' ? deckARef.current : deckBRef.current;
      activeDeck?.play().then(() => {
        store.setIsPlaying(true);
        navigator.mediaSession.playbackState = 'playing';
        acquireWakeLock();
      }).catch(() => {});
    });
    navigator.mediaSession.setActionHandler('nexttrack', () => {
      const idx = TRACKS.findIndex(t => t.key === currentTrackRef.current);
      if (idx !== -1) togglePlay(TRACKS[(idx + 1) % TRACKS.length].key);
    });
    navigator.mediaSession.setActionHandler('previoustrack', () => {
      const idx = TRACKS.findIndex(t => t.key === currentTrackRef.current);
      if (idx !== -1) togglePlay(TRACKS[(idx - 1 + TRACKS.length) % TRACKS.length].key);
    });

    // Tell OS this is a "live" radio — hides seek bar on lock screen
    navigator.mediaSession.setPositionState?.({ duration: Infinity, position: 0, playbackRate: 1 });
  }, [store, acquireWakeLock, releaseWakeLock]);

  const togglePlay = useCallback((trackId?: string) => {
    initAudioSystem();

    if (audioCtxRef.current?.state === 'suspended') {
      audioCtxRef.current.resume();
    }

    const trackToPlay = trackId || currentTrackRef.current || 'omNamahShivay';
    const isSameTrack = trackToPlay === currentTrackRef.current;

    // Case 1: Same track, currently playing → PAUSE
    // Pause both decks so any in-progress crossfade is fully stopped.
    if (isSameTrack && isPlayingRef.current) {
      deckARef.current?.pause();
      deckBRef.current?.pause();
      if (fadeTimeoutRef.current) { clearTimeout(fadeTimeoutRef.current); fadeTimeoutRef.current = null; }
      isFadingRef.current = false;
      store.setIsPlaying(false);
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
      releaseWakeLock();
      return;
    }

    // Case 2: Same track, currently paused → RESUME
    if (isSameTrack && !isPlayingRef.current && currentTrackRef.current) {
      const activeDeck = activeDeckRef.current === 'A' ? deckARef.current : deckBRef.current;
      const hasSrc = activeDeck?.src && !activeDeck.src.endsWith('/');
      if (hasSrc) {
        activeDeck?.play().then(() => {
          store.setIsPlaying(true);
          if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
          acquireWakeLock();
        }).catch(console.error);
        return;
      }
    }

    // Case 3: Different track → SWITCH
    store.setCurrentTrack(trackToPlay);

    if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
    isFadingRef.current = false;
    activeDeckRef.current = 'A';

    if (deckARef.current && deckBRef.current && gainARef.current && gainBRef.current) {
      deckARef.current.src = AUDIO_URLS[trackToPlay];
      deckBRef.current.src = AUDIO_URLS[trackToPlay];

      const vol = sliderToVol(volSliderRef.current);
      gainARef.current.gain.cancelScheduledValues(audioCtxRef.current!.currentTime);
      gainBRef.current.gain.cancelScheduledValues(audioCtxRef.current!.currentTime);
      gainARef.current.gain.value = vol;
      gainBRef.current.gain.value = 0;

      deckARef.current.currentTime = 0;
      deckBRef.current.pause();
      deckBRef.current.currentTime = 0;

      deckARef.current.play().then(() => {
        store.setIsPlaying(true);
        attachMediaSession(trackToPlay);
        acquireWakeLock();

        // Pre-buffer deck B silently for gapless crossfade
        if (deckBRef.current?.paused) {
          deckBRef.current.play()
            .then(() => { deckBRef.current?.pause(); deckBRef.current!.currentTime = 0; })
            .catch(() => {});
        }
      }).catch(console.error);
    }
  }, [initAudioSystem, store, attachMediaSession, acquireWakeLock, releaseWakeLock]);

  const nextTrack = useCallback(() => {
    const idx = TRACKS.findIndex(t => t.key === currentTrackRef.current);
    if (idx !== -1) togglePlay(TRACKS[(idx + 1) % TRACKS.length].key);
  }, [togglePlay]);

  const prevTrack = useCallback(() => {
    const idx = TRACKS.findIndex(t => t.key === currentTrackRef.current);
    if (idx !== -1) togglePlay(TRACKS[(idx - 1 + TRACKS.length) % TRACKS.length].key);
  }, [togglePlay]);

  const seekTo = useCallback((percentage: number) => {
    const active = activeDeckRef.current === 'A' ? deckARef.current : deckBRef.current;
    if (active && active.duration) {
      active.currentTime = (percentage / 100) * active.duration;
    }
  }, []);

  useEffect(() => {
    if (!isFadingRef.current && audioCtxRef.current) {
      const targetGain = activeDeckRef.current === 'A' ? gainARef.current : gainBRef.current;
      if (targetGain) {
        targetGain.gain.cancelScheduledValues(audioCtxRef.current.currentTime);
        targetGain.gain.value = sliderToVol(store.volume);
      }
    }
  }, [store.volume]);

  useEffect(() => {
    return () => {
      if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
      deckARef.current?.pause();
      deckBRef.current?.pause();
      audioCtxRef.current?.close().catch(() => {});
      releaseWakeLock();
    };
  }, [releaseWakeLock]);

  const getActiveDeckRemaining = useCallback((): number | null => {
    const active = activeDeckRef.current === 'A' ? deckARef.current : deckBRef.current;
    if (!active) return null;
    const dur = active.duration;
    if (!dur || !isFinite(dur) || isNaN(dur)) return null;
    return Math.max(0, dur - active.currentTime);
  }, []);

  return { togglePlay, nextTrack, prevTrack, seekTo, analyser: analyserRef.current, getActiveDeckRemaining };
};
