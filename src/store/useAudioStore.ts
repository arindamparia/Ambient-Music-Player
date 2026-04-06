import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import { encryptData, decryptData } from '../utils/crypto';

interface AudioState {
  currentTrackId: string | null;
  isPlaying: boolean;
  volume: number; // 0 to 1
  overdrive: number; // 1.0 to 3.0
  visualizerMode: 'bars' | 'waves';
  playbackPosition: number; // seconds — restored on page reload
  setCurrentTrack: (id: string | null) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setVolume: (volume: number) => void;
  setOverdrive: (overdrive: number) => void;
  setVisualizerMode: (mode: 'bars' | 'waves') => void;
  setPlaybackPosition: (pos: number) => void;
}

// Create an Async Storage wrapper around localStorage using Web Crypto
const secureStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    const encryptedData = localStorage.getItem(name);
    if (!encryptedData) return null;
    return await decryptData(encryptedData);
  },
  setItem: async (name: string, value: string): Promise<void> => {
    const encryptedData = await encryptData(value);
    localStorage.setItem(name, encryptedData);
  },
  removeItem: async (name: string): Promise<void> => {
    localStorage.removeItem(name);
  },
};

export const useAudioStore = create<AudioState>()(
  persist(
    (set) => ({
      currentTrackId: 'omNamahShivay', // Default priority track
      isPlaying: false,
      volume: 1.0,
      overdrive: 1.0,
      visualizerMode: 'waves',
      playbackPosition: 0,
      setCurrentTrack: (id) => set({ currentTrackId: id }),
      setIsPlaying: (isPlaying) => set({ isPlaying }),
      setVolume: (volume) => set({ volume }),
      setOverdrive: (overdrive) => set({ overdrive }),
      setVisualizerMode: (mode) => set({ visualizerMode: mode }),
      setPlaybackPosition: (pos) => set({ playbackPosition: pos }),
    }),
    {
      name: 'ambient-music-prefs.secure',
      storage: createJSONStorage(() => secureStorage),
      // Don't persist `isPlaying` state so it doesn't auto-play on reload
      partialize: (state) => ({
        currentTrackId: state.currentTrackId,
        volume: state.volume,
        overdrive: state.overdrive,
        visualizerMode: state.visualizerMode,
        playbackPosition: state.playbackPosition,
      }),
    }
  )
);
