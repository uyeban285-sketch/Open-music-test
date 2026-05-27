import { create } from 'zustand';
import { persist } from 'zustand/middleware';
interface TrackInfo {
  id: string;
  title: string;
  artist: string;
  coverUrl?: string;
  durationMs: number;
}
interface PlayerState {
  currentTrack: TrackInfo | null;
  queue: TrackInfo[];
  isPlaying: boolean;
  positionMs: number;
  repeatMode: 'off' | 'one' | 'all';
  shuffle: boolean;
  volume: number;
  play: (track?: TrackInfo) => void;
  pause: () => void;
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
  seek: (ms: number) => void;
  setQueue: (t: TrackInfo[]) => void;
  addToQueue: (t: TrackInfo) => void;
  removeFromQueue: (id: string) => void;
  setRepeatMode: (m: 'off' | 'one' | 'all') => void;
  toggleShuffle: () => void;
  setVolume: (v: number) => void;
}
export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      currentTrack: null,
      queue: [],
      isPlaying: false,
      positionMs: 0,
      repeatMode: 'off',
      shuffle: false,
      volume: 80,
      play: (track) =>
        track
          ? set({ currentTrack: track, isPlaying: true, positionMs: 0 })
          : set({ isPlaying: true }),
      pause: () => set({ isPlaying: false }),
      togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),
      next: () => {
        const { queue, currentTrack, repeatMode, shuffle } = get();
        if (!queue.length) return;
        if (shuffle) {
          set({ currentTrack: queue[Math.floor(Math.random() * queue.length)], positionMs: 0 });
          return;
        }
        const idx = queue.findIndex((t) => t.id === currentTrack?.id);
        const next = idx + 1;
        if (next < queue.length) set({ currentTrack: queue[next], positionMs: 0 });
        else if (repeatMode === 'all') set({ currentTrack: queue[0], positionMs: 0 });
        else set({ isPlaying: false });
      },
      prev: () => {
        const { queue, currentTrack, positionMs } = get();
        if (!queue.length) return;
        if (positionMs > 3000) {
          set({ positionMs: 0 });
          return;
        }
        const idx = queue.findIndex((t) => t.id === currentTrack?.id);
        if (idx > 0) set({ currentTrack: queue[idx - 1], positionMs: 0 });
      },
      seek: (ms) => set({ positionMs: ms }),
      setQueue: (tracks) => set({ queue: tracks }),
      addToQueue: (track) => set((s) => ({ queue: [...s.queue, track] })),
      removeFromQueue: (id) => set((s) => ({ queue: s.queue.filter((t) => t.id !== id) })),
      setRepeatMode: (mode) => set({ repeatMode: mode }),
      toggleShuffle: () => set((s) => ({ shuffle: !s.shuffle })),
      setVolume: (v) => set({ volume: v }),
    }),
    {
      name: 'open-music-player',
      partialize: (s) => ({
        currentTrack: s.currentTrack,
        queue: s.queue,
        positionMs: s.positionMs,
        repeatMode: s.repeatMode,
        shuffle: s.shuffle,
        volume: s.volume,
      }),
    },
  ),
);
