'use client';
import { usePlayerStore } from '@/stores/player-store';
export function MiniPlayer() {
  const { currentTrack, isPlaying, togglePlay, next, prev } = usePlayerStore();
  if (!currentTrack) return null;
  return (
    <div className="fixed bottom-16 lg:bottom-0 left-0 lg:left-64 right-0 z-40 h-16 bg-surface/95 backdrop-blur-glass border-t border-muted/10 flex items-center px-4 gap-4">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-10 h-10 rounded bg-muted/20 flex-shrink-0 overflow-hidden">
          {currentTrack.coverUrl && (
            <img src={currentTrack.coverUrl} alt="" className="w-full h-full object-cover" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{currentTrack.title}</p>
          <p className="text-xs text-muted truncate">{currentTrack.artist}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={prev}
          className="w-8 h-8 flex items-center justify-center text-muted hover:text-foreground"
          aria-label="Previous"
        >
          ⏮
        </button>
        <button
          onClick={togglePlay}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-accent text-white"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>
        <button
          onClick={next}
          className="w-8 h-8 flex items-center justify-center text-muted hover:text-foreground"
          aria-label="Next"
        >
          ⏭
        </button>
      </div>
    </div>
  );
}
