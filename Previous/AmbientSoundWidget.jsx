import React, { useState, useRef, useEffect, useCallback } from 'react';
import '../styles/AmbientSoundWidget.css';

const AUDIO_URLS = {
  // ── New tracks (priority) ──────────────────────────────────────────────────
  omNamahShivay: 'https://res.cloudinary.com/dnju7wfma/video/upload/v1775153821/Om_Namah_Shivay_h7hx0r.mp3',
  aadidevMahadev: 'https://res.cloudinary.com/dnju7wfma/video/upload/v1775153339/Aadidev_Mahadev_He_Shivaya_Shambho_tkoco6.mp3',
  ramSankirtan: 'https://res.cloudinary.com/dnju7wfma/video/upload/v1775154585/Shri_Ram_Naam_Sankirtanam_lnhm8t.mp3',
  healing: 'https://res.cloudinary.com/dnju7wfma/video/upload/v1774780549/HealingSound.mp3',
  windMandir: 'https://res.cloudinary.com/dnju7wfma/video/upload/v1774779620/Winds_Through_the_Old_Mandir_Flute___Sitar_in_Timeless_Tranquility_MP3_160K_llh2me.mp3',
  shivaDeep: 'https://res.cloudinary.com/dnju7wfma/video/upload/v1774779618/SHIVA___Beautiful_Indian_Background_Music___Deep___Mystical_Meditation_Music___Ambient_Hindu_Music_MP3_160K_sgrn1q.mp3',
  meditation: 'https://res.cloudinary.com/dnju7wfma/video/upload/v1774774806/Temple_Rhythms_Tabla__Flute___Sitar_Tranquility___1_Hour_Indian_Meditation_Music_MP3_160K_aspm1l.mp3',
  krishnaFlute: 'https://res.cloudinary.com/dnju7wfma/video/upload/v1774779598/Flute_of_Peace___Shri_Krishna_Relaxing_Instrumental_MP3_160K_ugj3b0.mp3',
  // ── Original tracks ────────────────────────────────────────────────────────
  rain: 'https://res.cloudinary.com/dnju7wfma/video/upload/v1774378667/rain_fe6smc.mp3',
  rain2: 'https://res.cloudinary.com/dnju7wfma/video/upload/v1774378667/rain2_uycmn6.mp3',
  ocean: 'https://res.cloudinary.com/dnju7wfma/video/upload/v1774378668/ocean_gzek2u.mp3',
  forest: 'https://res.cloudinary.com/dnju7wfma/video/upload/v1774378667/forest_l804pd.mp3',
  forest2: 'https://res.cloudinary.com/dnju7wfma/video/upload/v1774382236/forest2_xg9jbw.mp3',
  forest3: 'https://res.cloudinary.com/dnju7wfma/video/upload/v1774378667/forest3_xlypzq.mp3',
  river: 'https://res.cloudinary.com/dnju7wfma/video/upload/v1774382577/river_ffhhlr.mp3',
};

const TRACKS = [
  // ── New tracks first (highest priority) ───────────────────────────────────
  { key: 'omNamahShivay', emoji: '🕉️', label: 'Om Namah Shivay' },
  { key: 'aadidevMahadev', emoji: '🏔️', label: 'Aadidev Mahadev' },
  { key: 'ramSankirtan', emoji: '🪷', label: 'Shri Ram Sankirtanam' },
  { key: 'healing', emoji: '✨', label: 'Healing Sounds' },
  { key: 'windMandir', emoji: '🛕', label: 'Winds of the Mandir' },
  { key: 'shivaDeep', emoji: '🔱', label: 'Shiva — Deep Mystical' },
  { key: 'meditation', emoji: '🪘', label: 'Indian Meditation' },
  { key: 'krishnaFlute', emoji: '🪈', label: 'Krishna Flute of Peace' },
  // ── Original tracks ────────────────────────────────────────────────────────
  { key: 'rain', emoji: '🌧️', label: 'Calming Rain' },
  { key: 'rain2', emoji: '⛈️', label: 'Rain & Thunderstorms' },
  { key: 'ocean', emoji: '🌊', label: 'Ocean Waves' },
  { key: 'forest', emoji: '🌲', label: 'Forest Ambience' },
  { key: 'forest2', emoji: '🍃', label: 'Wind & Crickets' },
  { key: 'forest3', emoji: '🐦', label: 'Nature Birds' },
  { key: 'river', emoji: '🛶', label: 'River & Birds' },
];

const CROSSFADE_SEC = 4.0;
const SNAPS = [0, 0.5, 1, 1.5, 2, 2.5, 3];

// Non-linear slider mapping: lower half = 0–1×, upper half = 1–3×
const sliderToVol = (s) => s <= 0.5 ? s * 2 : 1 + (s - 0.5) * 4;
const volToSlider = (v) => v <= 1 ? v / 2 : 0.5 + (v - 1) / 4;
const fmtVol = (vol) => vol % 1 === 0 ? `${vol.toFixed(0)}×` : `${vol.toFixed(1)}×`;

const getSavedSlider = () => {
  const v = localStorage.getItem('lst_ambient_vol');
  return v !== null ? volToSlider(parseFloat(v)) : 0.5;
};

// ── Live Bars — shown in toggle button when playing (Guide §2) ───────────────
function LiveBars({ className = '' }) {
  return (
    <span className={`live-bars ${className}`.trim()} aria-label="Playing">
      <span /><span /><span /><span />
    </span>
  );
}

export default function AmbientSoundWidget() {
  // ── UI state ──────────────────────────────────────────────────────────────
  const [panelOpen, setPanelOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [loadingTrack, setLoadingTrack] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [volSlider, setVolSlider] = useState(getSavedSlider);

  // ── Audio refs (no re-render needed) ─────────────────────────────────────
  const audioA = useRef(null);
  const audioB = useRef(null);
  const audioCtx = useRef(null);
  const gainA = useRef(null);
  const gainB = useRef(null);
  const activeDeck = useRef('A');
  const isFading = useRef(false);
  const fadeRaf = useRef(null);
  const fadeTimeout = useRef(null);

  // ── Visualizer refs ──────────────────────────────────────────────────────
  const analyser = useRef(null);
  const dataArray = useRef(null);
  const visualizeRaf = useRef(null);

  // Ref to hold the toggleTrack function to avoid circular dependencies
  const toggleTrackRef = useRef(null);

  // DOM ref for the volume input — used to update --fill CSS var (Guide §3)
  const volInputRef = useRef(null);

  // Mirror state into refs so event-listener closures always read current values
  const isPlayingRef = useRef(false);
  const currentTrackRef = useRef(null);
  const volSliderRef = useRef(volSlider);

  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { currentTrackRef.current = currentTrack; }, [currentTrack]);
  useEffect(() => { volSliderRef.current = volSlider; }, [volSlider]);

  // ── Init --fill on mount so the track is filled from the saved position ───
  useEffect(() => {
    volInputRef.current?.style.setProperty('--fill', `${Math.round(volSlider * 100)}%`);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Close panel on outside click ─────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (!e.target.closest('#ambient-widget')) setPanelOpen(false);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  // ── Resume AudioContext when tab regains visibility/focus ─────────────────
  useEffect(() => {
    const resume = () => {
      if (audioCtx.current && audioCtx.current.state === 'suspended') {
        audioCtx.current.resume().catch(() => { });
      }
    };
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('focus', resume);
    return () => {
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('focus', resume);
    };
  }, []);

  // ── Cleanup on unmount ───────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      cancelAnimationFrame(fadeRaf.current);
      clearTimeout(fadeTimeout.current);
      cancelAnimationFrame(visualizeRaf.current);
      if (audioA.current) { audioA.current.pause(); audioA.current.src = ''; }
      if (audioB.current) { audioB.current.pause(); audioB.current.src = ''; }
      if (audioCtx.current && audioCtx.current.state !== 'closed') {
        audioCtx.current.close().catch(() => { });
      }
      // Clear media session
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'none';
        ['play', 'pause', 'nexttrack', 'previoustrack', 'seekforward', 'seekbackward', 'seekto']
          .forEach(a => { try { navigator.mediaSession.setActionHandler(a, null); } catch { } });
      }
    };
  }, []);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const gainFor = (audio) => audio === audioA.current ? gainA.current : gainB.current;

  // ── Media Session — takes over OS notification controls ───────────────────
  const attachMediaSession = useCallback((trackKey) => {
    if (!('mediaSession' in navigator)) return;
    const track = TRACKS.find(t => t.key === trackKey);

    navigator.mediaSession.metadata = new MediaMetadata({
      title: track?.label || 'Ambient Sound',
      artist: 'LifeStyle Tracker',
      album: 'Calm Background Sounds',
    });

    navigator.mediaSession.playbackState = 'playing';

    // ── 1. THE "LIVE STREAM" TRICK TO HIDE THE SEEK BAR ──
    if ('setPositionState' in navigator.mediaSession) {
      try {
        navigator.mediaSession.setPositionState({
          duration: Infinity,
          playbackRate: 1,
          position: 0
        });
      } catch (e) {
        console.warn('setPositionState not supported', e);
      }
    }

    // ── 2. THE EVENT SWALLOWER TO DISABLE SEEKING ──
    ['seekforward', 'seekbackward', 'seekto'].forEach(action => {
      try {
        navigator.mediaSession.setActionHandler(action, () => {
          // Intentionally empty. Do absolutely nothing if they try to seek.
        });
      } catch { }
    });

    // Play / Pause
    navigator.mediaSession.setActionHandler('pause', () => {
      audioA.current?.pause();
      audioB.current?.pause();
      cancelAnimationFrame(fadeRaf.current);
      clearTimeout(fadeTimeout.current);
      setIsPlaying(false);
      navigator.mediaSession.playbackState = 'paused';
    });

    navigator.mediaSession.setActionHandler('play', () => {
      const key = currentTrackRef.current;
      if (key) {
        const deck = activeDeck.current === 'A' ? audioA.current : audioB.current;
        deck?.play().then(() => {
          setIsPlaying(true);
          navigator.mediaSession.playbackState = 'playing';
        }).catch(() => { });
      }
    });

    // Next / Previous cycles through ambient tracks using the ref
    const idx = TRACKS.findIndex(t => t.key === trackKey);
    navigator.mediaSession.setActionHandler('nexttrack', () => {
      if (toggleTrackRef.current) {
        toggleTrackRef.current(TRACKS[(idx + 1) % TRACKS.length].key);
      }
    });
    navigator.mediaSession.setActionHandler('previoustrack', () => {
      if (toggleTrackRef.current) {
        toggleTrackRef.current(TRACKS[(idx - 1 + TRACKS.length) % TRACKS.length].key);
      }
    });
  }, []); // Removed toggleTrack from dependencies

  const doCrossfade = useCallback((fadeOutAudio, fadeInAudio) => {
    isFading.current = true;
    fadeInAudio.currentTime = 0;

    const fadeOutGain = gainFor(fadeOutAudio);
    const fadeInGain = gainFor(fadeInAudio);
    
    // Leverage Web Audio API precise scheduling to run the volume fade on the 
    // audio thread so it continues perfectly even if the tab is backgrounded.
    const now = audioCtx.current.currentTime;
    const targetVol = sliderToVol(volSliderRef.current);
    
    fadeOutGain.gain.cancelScheduledValues(now);
    fadeInGain.gain.cancelScheduledValues(now);
    
    // Linear ramp starting/ending slightly above 0 avoids browser audio engine pops/glitches
    fadeOutGain.gain.setValueAtTime(fadeOutGain.gain.value || targetVol, now);
    fadeOutGain.gain.linearRampToValueAtTime(0.001, now + CROSSFADE_SEC);
    
    fadeInGain.gain.setValueAtTime(0.001, now);
    fadeInGain.gain.linearRampToValueAtTime(targetVol, now + CROSSFADE_SEC);

    fadeInAudio.play().catch(() => { });

    cancelAnimationFrame(fadeRaf.current);
    clearTimeout(fadeTimeout.current);
    
    fadeTimeout.current = setTimeout(() => {
      // Ensure values are fully zeroed/set in case of floating point precision issues
      fadeOutGain.gain.cancelScheduledValues(audioCtx.current.currentTime);
      fadeInGain.gain.cancelScheduledValues(audioCtx.current.currentTime);
      
      fadeOutGain.gain.value = 0;
      fadeInGain.gain.value = sliderToVol(volSliderRef.current);
      
      fadeOutAudio.pause();
      fadeOutAudio.currentTime = 0;
      activeDeck.current = activeDeck.current === 'A' ? 'B' : 'A';
      isFading.current = false;
    }, CROSSFADE_SEC * 1000 + 150);
  }, []); // only refs → stable

  const lazyInitDecks = useCallback(() => {
    if (audioA.current) return; // already initialised

    audioCtx.current = new (window.AudioContext || window.webkitAudioContext)();
    
    analyser.current = audioCtx.current.createAnalyser();
    analyser.current.fftSize = 128; // Increased resolution for ambient nuances
    analyser.current.smoothingTimeConstant = 0.65; // Faster decay for snappier drop
    analyser.current.minDecibels = -90; // Standard bottom floor
    analyser.current.maxDecibels = -10; // Prevent loud parts from getting artificially stuck at 255
    dataArray.current = new Uint8Array(analyser.current.frequencyBinCount);

    const makeAudio = () => {
      const a = new Audio();
      a.preload = 'none';
      a.loop = false;
      a.crossOrigin = 'anonymous';
      a.volume = 1; // GainNode controls actual level
      return a;
    };

    audioA.current = makeAudio();
    audioB.current = makeAudio();

    gainA.current = audioCtx.current.createGain();
    gainB.current = audioCtx.current.createGain();

    const wire = (audio, gain) => {
      const src = audioCtx.current.createMediaElementSource(audio);
      src.connect(gain);
      gain.connect(analyser.current);
    };
    wire(audioA.current, gainA.current);
    wire(audioB.current, gainB.current);
    
    analyser.current.connect(audioCtx.current.destination);

    // Error / buffering indicators
    const attach = (deck) => {
      deck.addEventListener('error', () => {
        if (deck.src) { setIsPlaying(false); setLoadingTrack(null); }
      });
      deck.addEventListener('waiting', () => {
        if (currentTrackRef.current) setLoadingTrack(currentTrackRef.current);
      });
      deck.addEventListener('canplay', () => setLoadingTrack(null));
    };
    attach(audioA.current);
    attach(audioB.current);

    // Crossfade monitor — trigger when nearing end of track
    const monitor = (deck, next) => {
      deck.addEventListener('timeupdate', () => {
        if (!isPlayingRef.current || isFading.current) return;
        if (deck.duration && deck.currentTime >= deck.duration - CROSSFADE_SEC) {
          doCrossfade(deck, next);
        }
      });
    };
    monitor(audioA.current, audioB.current);
    monitor(audioB.current, audioA.current);
  }, [doCrossfade]);

  const startVisualizer = useCallback(() => {
    if (!analyser.current) return;
    
    const loop = () => {
      visualizeRaf.current = requestAnimationFrame(loop);
      if (!isPlayingRef.current) return;

      analyser.current.getByteFrequencyData(dataArray.current);
      const data = dataArray.current;

      // Differentiate UI reactivity for vocal/chant vs atmospheric
      const trackId = currentTrackRef.current;
      const isVoice = ['omNamahShivay', 'aadidevMahadev', 'ramSankirtan'].includes(trackId);

      // Calculate both peak and average to get dynamic but stable ambient waves
      const getEnergy = (start, end) => {
        let max = 0;
        let sum = 0;
        for (let i = start; i < end; i++) {
          if (data[i] > max) max = data[i];
          sum += data[i];
        }
        const avg = sum / (end - start);
        // Rely purely on dynamic scaling. Use more peak for voice.
        return isVoice ? ((max * 0.8) + (avg * 0.2)) / 255 : ((max * 0.6) + (avg * 0.4)) / 255;
      };

      // With fftSize = 128 (64 bins), each bin is about 375 Hz.
      // We must start from Bin 0 to catch the heavy bass, drums, and tabla beats.
      const raw1 = getEnergy(0, 3);   // 0 - 1100Hz (Bass & Beats)
      const raw2 = getEnergy(3, 10);  // 1100 - 3750Hz (Middle Voice)
      const raw3 = getEnergy(10, 24); // 3750 - 9000Hz (High Pitch Voice)
      const raw4 = getEnergy(24, 56); // 9000Hz+ (Highs / Flutes)

      let v1, v2, v3, v4;
      if (isVoice) {
         // Beats (Low frequency). By using Math.pow(raw1, 2.5) we create a "noise gate"
         // that squashes drone down to a low height, but allows loud hits to peak aggressively.
         v1 = Math.min(1, Math.pow(raw1, 2.5) * 2.5);
         v2 = Math.min(0.65, raw2 * 1.5);
         v3 = Math.min(1, raw3 * 2.8);
         v4 = Math.min(1, raw4 * 2.0);
      } else {
         v1 = Math.min(1, raw1 * 1.4);
         v2 = Math.min(1, raw2 * 1.6);
         v3 = Math.min(1, raw3 * 1.8);
         v4 = Math.min(1, raw4 * 2.0);
      }

      // Remove random artificial jitter for voice so peaks accurately map to actual audio content
      const jt = () => isVoice ? 0 : (Math.random() - 0.5) * 1.5;

      const h1 = Math.max(3, Math.min(14, 3 + (v1 * 11) + jt()));
      const h2 = Math.max(3, Math.min(14, 3 + (v2 * 11) + jt()));
      const h3 = Math.max(3, Math.min(14, 3 + (v3 * 11) + jt()));
      const h4 = Math.max(3, Math.min(14, 3 + (v4 * 11) + jt()));

      const lh1 = Math.max(4, Math.min(20, 4 + (v1 * 16) + (isVoice ? 0 : jt() * 1.5)));
      const lh2 = Math.max(4, Math.min(20, 4 + (v2 * 16) + (isVoice ? 0 : jt() * 1.5)));
      const lh3 = Math.max(4, Math.min(20, 4 + (v3 * 16) + (isVoice ? 0 : jt() * 1.5)));
      const lh4 = Math.max(4, Math.min(20, 4 + (v4 * 16) + (isVoice ? 0 : jt() * 1.5)));

      const btnBars = document.querySelector('.ambient-btn.playing.reactive .abt__bars');
      if (btnBars && btnBars.children.length === 4) {
        btnBars.children[0].style.height = `${h1}px`;
        btnBars.children[1].style.height = `${h2}px`;
        btnBars.children[2].style.height = `${h3}px`;
        btnBars.children[3].style.height = `${h4}px`;
      }

      const liveBars = document.querySelector('.live-bars.reactive');
      if (liveBars && liveBars.children.length === 4) {
        liveBars.children[0].style.height = `${lh1}px`;
        liveBars.children[1].style.height = `${lh2}px`;
        liveBars.children[2].style.height = `${lh3}px`;
        liveBars.children[3].style.height = `${lh4}px`;
      }
    };
    cancelAnimationFrame(visualizeRaf.current);
    loop();
  }, []);

  useEffect(() => {
    if (isPlaying) {
      startVisualizer();
    } else {
      cancelAnimationFrame(visualizeRaf.current);
    }
  }, [isPlaying, startVisualizer]);

  // ── Toggle track (play / pause) ───────────────────────────────────────────
  const toggleTrack = useCallback((track) => {
    // Tap same playing track → pause
    if (currentTrackRef.current === track && isPlayingRef.current) {
      cancelAnimationFrame(fadeRaf.current);
      clearTimeout(fadeTimeout.current);
      isFading.current = false;
      audioA.current?.pause();
      audioB.current?.pause();
      setIsPlaying(false);
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
      return;
    }

    lazyInitDecks();

    // Resume AudioContext if suspended (browser autoplay policy)
    if (audioCtx.current?.state === 'suspended') audioCtx.current.resume();

    cancelAnimationFrame(fadeRaf.current);
    clearTimeout(fadeTimeout.current);
    isFading.current = false;
    activeDeck.current = 'A';

    // Load new src only when track changes
    if (currentTrackRef.current !== track) {
      audioA.current.src = AUDIO_URLS[track];
      audioB.current.src = AUDIO_URLS[track];
    }

    setCurrentTrack(track);
    setLoadingTrack(track);

    const vol = sliderToVol(volSliderRef.current);
    gainA.current.gain.value = vol;
    audioA.current.currentTime = 0;
    audioB.current.pause();
    audioB.current.currentTime = 0;
    gainB.current.gain.value = 0;

    audioA.current.play()
      .then(() => {
        setIsPlaying(true);
        attachMediaSession(track);
        
        // Trick for Mobile Browsers: We unlock audio B right here inside the synchronous 
        // user-gesture execution stack so that it doesn't get blocked later when programmatic crossfade begins.
        if (audioB.current.paused && audioB.current.currentTime === 0) {
          audioB.current.play().then(() => {
            audioB.current.pause();
            audioB.current.currentTime = 0;
          }).catch(() => {});
        }
      })
      .catch((err) => {
        setLoadingTrack(null);
        console.warn('Ambient play blocked:', err);
      });
  }, [lazyInitDecks, attachMediaSession]);

  // Update the ref whenever toggleTrack changes
  useEffect(() => {
    toggleTrackRef.current = toggleTrack;
  }, [toggleTrack]);

  // ── Volume (Guide §3 — also updates --fill on the DOM input) ─────────────
  const handleVolChange = useCallback((e) => {
    let slider = parseFloat(e.target.value);
    let vol = sliderToVol(slider);

    // Magnetic snap to round step
    for (const s of SNAPS) {
      if (Math.abs(vol - s) < 0.08) { vol = s; slider = volToSlider(s); break; }
    }

    // Update the filled-track gradient immediately (no re-render needed)
    e.target.style.setProperty('--fill', `${Math.round(slider * 100)}%`);

    localStorage.setItem('lst_ambient_vol', vol);
    setVolSlider(slider);

    if (!isFading.current) {
      const target = activeDeck.current === 'A' ? gainA.current : gainB.current;
      if (target) {
        target.gain.cancelScheduledValues(audioCtx.current.currentTime);
        target.gain.value = vol;
      }
    }
  }, []);

  // ── Mute ──────────────────────────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (audioA.current) audioA.current.muted = next;
      if (audioB.current) audioB.current.muted = next;
      return next;
    });
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────
  const vol = sliderToVol(volSlider);
  const isBoosted = vol > 1;

  return (
    <div id="ambient-widget">
      {/* Invisible backdrop for mobile to catch clicks without triggering underlying elements */}
      {panelOpen && (
        <div 
          className="ambient-mobile-backdrop" 
          onClick={(e) => { e.stopPropagation(); setPanelOpen(false); }}
        />
      )}

      <div id="ambient-panel" className={`${panelOpen ? 'open' : ''} ${isPlaying ? 'playing-bg' : ''}`.trim()}>

        {/* Panel header */}
        <div className="ambient-panel-header">
          <span className="ambient-panel-title">Ambient</span>
          {currentTrack && isPlaying && (() => {
            const t = TRACKS.find(tr => tr.key === currentTrack);
            return t ? <span className="ambient-now-playing">{t.emoji} {t.label}</span> : null;
          })()}
        </div>

        {/* Track grid — Guide §1: icon + 4 equalizer bars per button */}
        <div className="ambient-tracks-scroll">
          <div className="ambient-tracks">
            {TRACKS.map((t) => {
              const playing = currentTrack === t.key && isPlaying;
              const loading = loadingTrack === t.key;
              return (
                <button
                  key={t.key}
                  className={[
                    'ambient-btn',
                    playing ? 'playing reactive' : '',
                    loading ? 'loading' : '',
                  ].filter(Boolean).join(' ')}
                  title={t.label}
                  onClick={() => toggleTrack(t.key)}
                >
                  {/* Icon nudges up when playing via CSS transform */}
                  <span className="abt__icon">{t.emoji}</span>
                  {/* Bars always in DOM — opacity + animation driven by .playing CSS */}
                  <span className="abt__bars" aria-hidden="true">
                    <span /><span /><span /><span />
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Volume — Guide §3: premium filled-track slider */}
        <div className="ambient-volume">
          <span className="ambient-mute-btn" onClick={toggleMute} title={isMuted ? 'Unmute' : 'Mute'}>
            {isMuted ? '🔇' : '🔉'}
          </span>
          <div className="ambient-vol-wrap">
            <input
              ref={volInputRef}
              type="range"
              className={`vol-slider${isBoosted ? ' boosted' : ''}`}
              min="0" max="1" step="0.002"
              value={volSlider}
              onChange={handleVolChange}
            />
            <span className={`ambient-vol-label${isBoosted ? ' boosted' : ''}`}>
              {fmtVol(vol)}
            </span>
          </div>
        </div>

      </div>

      {/* Toggle button — Guide §2: live bars replace 🎵 when playing */}
      <button
        id="ambient-toggle"
        className={isPlaying ? 'active-glow' : ''}
        onClick={(e) => { e.stopPropagation(); setPanelOpen((v) => !v); }}
        title="Calm Sound"
      >
        <span className="ambient-toggle-icon">
          {isPlaying ? <LiveBars className="reactive" /> : '🎵'}
        </span>
        <span className="ambient-toggle-text">Calm Sound</span>
      </button>
    </div>
  );
}