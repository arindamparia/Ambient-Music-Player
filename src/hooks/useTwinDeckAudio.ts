import { useEffect, useRef, useCallback } from 'react';
import { useAudioStore } from '../store/useAudioStore';
import { AUDIO_URLS, TRACKS } from '../constants/tracks';

const CROSSFADE_SEC = 4.0;
export const sliderToVol = (s: number) => s <= 0.5 ? s * 2 : 1 + (s - 0.5) * 4;
export const volToSlider = (v: number) => v <= 1 ? v / 2 : 0.5 + (v - 1) / 4;

export const useTwinDeckAudio = () => {
  const store = useAudioStore();
  
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  
  const deckARef = useRef<HTMLAudioElement | null>(null);
  const deckBRef = useRef<HTMLAudioElement | null>(null);
  const gainARef = useRef<GainNode | null>(null);
  const gainBRef = useRef<GainNode | null>(null);
  
  const activeDeckRef = useRef<'A' | 'B'>('A');
  const isFadingRef = useRef(false);
  const fadeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isPlayingRef = useRef(store.isPlaying);
  const currentTrackRef = useRef(store.currentTrackId);
  const volSliderRef = useRef(store.volume);

  useEffect(() => { isPlayingRef.current = store.isPlaying; }, [store.isPlaying]);
  useEffect(() => { currentTrackRef.current = store.currentTrackId; }, [store.currentTrackId]);
  useEffect(() => { volSliderRef.current = store.volume; }, [store.volume]);

  const getGainFor = useCallback((audio: HTMLAudioElement) => 
    audio === deckARef.current ? gainARef.current : gainBRef.current, []);

  // Sync Progress to DOM directly (bypassing React render loop for 60fps)
  useEffect(() => {
    let raf: number;
    const updateProgress = () => {
       raf = requestAnimationFrame(updateProgress);
       const active = activeDeckRef.current === 'A' ? deckARef.current : deckBRef.current;
       if (active && active.duration) {
           const percent = (active.currentTime / active.duration) * 100;
           document.documentElement.style.setProperty('--track-progress', `${percent}%`);
           
           // Format time strings
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

    fadeInAudio.play().catch(() => { });

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
    
    analyserRef.current = audioCtxRef.current.createAnalyser();
    analyserRef.current.fftSize = 256; // Increased resolution to capture more bands for 12 lines
    analyserRef.current.smoothingTimeConstant = 0.55; // Snappier, more reactive!
    analyserRef.current.minDecibels = -85;
    analyserRef.current.maxDecibels = -10;

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

    const wire = (audio: HTMLAudioElement, gain: GainNode) => {
      const src = audioCtxRef.current!.createMediaElementSource(audio);
      src.connect(gain);
      gain.connect(analyserRef.current!);
    };
    
    wire(deckARef.current, gainARef.current);
    wire(deckBRef.current, gainBRef.current);
    
    analyserRef.current.connect(audioCtxRef.current.destination);

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

  const attachMediaSession = useCallback((trackKey: string) => {
    if (!('mediaSession' in navigator)) return;
    const track = TRACKS.find(t => t.key === trackKey);

    navigator.mediaSession.metadata = new MediaMetadata({
      title: track?.label || 'Ambient Sound',
      artist: 'Ambient UI',
      album: 'Deep Focus',
    });
    navigator.mediaSession.playbackState = 'playing';

    navigator.mediaSession.setActionHandler('pause', () => {
      deckARef.current?.pause();
      deckBRef.current?.pause();
      store.setIsPlaying(false);
      navigator.mediaSession.playbackState = 'paused';
    });
  }, [store]);

  const togglePlay = useCallback((trackId?: string) => {
    initAudioSystem();
    const trackToPlay = trackId || currentTrackRef.current || 'omNamahShivay';
    
    if (audioCtxRef.current?.state === 'suspended') {
      audioCtxRef.current.resume();
    }

    if (trackToPlay === currentTrackRef.current && isPlayingRef.current && !trackId) {
      deckARef.current?.pause();
      deckBRef.current?.pause();
      store.setIsPlaying(false);
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
      return;
    }

    store.setCurrentTrack(trackToPlay);
    
    if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
    isFadingRef.current = false;
    activeDeckRef.current = 'A';

    if (deckARef.current && deckBRef.current && gainARef.current && gainBRef.current) {
        if (currentTrackRef.current !== trackToPlay || !deckARef.current.src) {
           deckARef.current.src = AUDIO_URLS[trackToPlay];
           deckBRef.current.src = AUDIO_URLS[trackToPlay];
        }
        
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

            if (deckBRef.current?.paused) {
                deckBRef.current.play().then(() => {
                     deckBRef.current?.pause();
                     deckBRef.current!.currentTime = 0;
                }).catch(() => {});
            }
        }).catch(console.error);
    }
  }, [initAudioSystem, store, attachMediaSession]);

  const nextTrack = useCallback(() => {
     const idx = TRACKS.findIndex(t => t.key === currentTrackRef.current);
     if (idx !== -1) {
       const nxt = TRACKS[(idx + 1) % TRACKS.length];
       togglePlay(nxt.key);
     }
  }, [togglePlay]);

  const prevTrack = useCallback(() => {
     const idx = TRACKS.findIndex(t => t.key === currentTrackRef.current);
     if (idx !== -1) {
       const prv = TRACKS[(idx - 1 + TRACKS.length) % TRACKS.length];
       togglePlay(prv.key);
     }
  }, [togglePlay]);

  // Actual seeking
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
      audioCtxRef.current?.close().catch(()=>{});
    }
  }, []);

  return { togglePlay, nextTrack, prevTrack, seekTo, analyser: analyserRef.current };
};
