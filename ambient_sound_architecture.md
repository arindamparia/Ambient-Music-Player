# Ambient Sound Widget — Architecture & Feature Documentation

This document outlines the complete technical architecture and minute details of the `AmbientSoundWidget.jsx` implemented in the LifeStyle Tracker application.

## 1. Twin-Deck Virtual DJ System (Zero-Bandwidth Looping)

Instead of relying on the native `loop=true` attribute of HTML5 Audio, the widget uses a dual-deck architecture to guarantee gapless playback and infinite looping.

- **Twin Audio Elements**: The widget initializes two separate `<audio>` elements (`deck A` and `deck B`). Both decks are fed the exact same Cloudinary URL.
- **Crossfade Trigger**: An event listener monitors the `timeupdate` of the active deck. Exactly 4.0 seconds (`CROSSFADE_SEC`) before the track ends, the widget fires a crossfade to the secondary deck.
- **Native Cache Harvesting**: Because both decks share the same URL string, the browser native HTTP Disk Cache automatically steps in. Deck A downloads the track via `206 Partial Content` chunks. When Deck B loops and plays from `currentTime = 0`, it reads exclusively from the local disk cache without hitting the network, ensuring **zero bandwidth costs** for infinite looping.
- **Mobile Autoplay Evasion**: Mobile browsers block unprompted audio playback. When the user clicks "Play" on Deck A, the widget fires a silent `.play().then(pause)` on Deck B within the same synchronous user-gesture stack. This "unlocks" Deck B permanently so the automated crossfade an hour later doesn't get blocked by iOS/Android strict autoplay rules.

## 2. Web Audio API & Thread-Safe Crossfading

The standard `audio.volume` property is bypassed entirely. All audio is routed through the Web Audio API (`AudioContext`) to unlock professional playback features.

- **Gain Nodes**: Audio is connected to `GainNodes` (`gainA`, `gainB`). This allows volume levels to exceed the 100% normal playback limit.
- **Thread-Safe Precision**: The crossfade uses `.setValueAtTime()` and `.linearRampToValueAtTime()` on the Gain nodes. These instructions are handed off to the browser's dedicated, high-priority Audio Thread. This ensures that even if the Javascript main thread freezes, or the user switches tabs, the 4-second crossfade will execute perfectly without popping, stuttering, or mis-timing.

## 3. FFT Audio Visualizer & Source Discrimination

The widget features an animated 4-bar equalizer that reacts to the actual audio stream in real-time.

- **Frequency Splitting**: We use an `AnalyserNode` with an `fftSize` of 128 (yielding 64 frequency bins). These bins are mapped to the 4 equalizers:
  1. `0 - 1100Hz` (Bass, Drums, Tabla hits)
  2. `1100 - 3750Hz` (Mid-range frequencies)
  3. `3750 - 9000Hz` (High pitch vocals/chants)
  4. `9000Hz+` (Atmospheric highs, flutes)
- **Vocal/Mantra Source Discrimination**: Vocal tracks (e.g., *Om Namah Shivay*) require different visualization curves than atmospheric tracks (e.g., *Rain* or *Forest*).
  - **Dynamic Noise Gate**: For vocal tracks, we apply `Math.pow(raw, 2.5)`. This mathematically squashes low-level background drone noises but allows loud syllables and tabla strikes to peak aggressively, creating a snappy, accurate visualizer.
  - **Organic Jitter**: For nature tracks, which lack sharp rhythmic spikes, we use average-biased energy algorithms and inject a slight degree of artificial geometric jitter to make the bars feel alive like wind or water.

## 4. Media Session API (OS-Level Integration)

The widget hijacks the operating system's native media controls (Lock screen, Control Center, Bluetooth headsets) for a premium native app feel.

- **Metadata Sync**: Broadcasts the current track's emoji, title, and album art to the OS.
- **Hardware Button Mapping**: Connects OS "Next Track" and "Previous Track" buttons directly to the widget's internal track array so users can cycle through ambient sounds without opening the app.
- **The "Live Stream" Seeking Hack**: Ambient soundscapes are meant to be continuous backdrops; scrubbing through them ruins the loop caching logic. We tell the OS the track has an infinite duration (`setPositionState({ duration: Infinity })`) and swallow all hardware seeking events. This hides the seek bar on the OS lock screen, mimicking a live radio broadcast.

## 5. Non-Linear Volume Overdrive

The volume slider implements an "Overdrive" feature to make quiet atmospheric tracks audible in noisy environments.

- **The Curve**: The slider operates non-linearly. Dragging from `0%` to `50%` controls the standard volume (0x to 1x). Dragging from `50%` to `100%` exponentially boosts the track via the GainNode (1x to 3x).
- **CSS Painting**: Performance is retained by updating the slider's gradient fill via a CSS property (`target.style.setProperty('--fill')`). This bypasses React's render loop ensuring buttery smooth 60fps tracking without triggering costly DOM updates.
- **Persistence**: The chosen slider location is stored in `localStorage` under `lst_ambient_vol` and snaps to predefined clean intervals (0.5, 1.0, 1.5).
- **Suspension Resumption**: Browsers suspend AudioContexts to save battery when tabs are inactive. The app listens to the `visibilitychange` window event and gracefully resumes the AudioContext the moment the user pulls the tab back into focus.
