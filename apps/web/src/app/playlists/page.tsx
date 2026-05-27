'use client';
import { PlaylistCardSkeleton } from '@/components/skeletons/playlist-card-skeleton';
export default function PlaylistsPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Playlists</h1>
        <button className="px-4 py-2 rounded-lg bg-accent text-white text-sm hover:opacity-90">
          Create Playlist
        </button>
      </div>
      <div className="text-center py-16">
        <p className="text-4xl mb-4">📋</p>
        <h2 className="text-lg font-medium mb-2">No playlists yet</h2>
        <p className="text-muted text-sm">Create one or connect a service to import them</p>
      </div>
    </div>
  );
}
