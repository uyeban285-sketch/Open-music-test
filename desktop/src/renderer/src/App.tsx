import { useState, useEffect } from 'react';
import './index.css';

function App() {
  const [tracks, setTracks] = useState<any[]>([]);
  const [trackCount, setTrackCount] = useState(0);
  const [view, setView] = useState<'library' | 'playlists' | 'search' | 'settings'>('library');

  useEffect(() => {
    window.openMusic.listTracks({}).then(setTracks);
    window.openMusic.getTrackCount().then((r: any) => setTrackCount(r?.count ?? 0));
  }, []);

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0e] text-white">
      {/* Title Bar */}
      <div className="h-9 flex items-center justify-between px-4 bg-[#111115] select-none" style={{ WebkitAppRegion: 'drag' } as any}>
        <span className="text-sm font-bold text-purple-400">Open Music</span>
        <div className="flex gap-1" style={{ WebkitAppRegion: 'no-drag' } as any}>
          <button onClick={() => window.openMusic.minimizeWindow()} className="w-8 h-6 flex items-center justify-center hover:bg-white/10 rounded text-xs">─</button>
          <button onClick={() => window.openMusic.maximizeWindow()} className="w-8 h-6 flex items-center justify-center hover:bg-white/10 rounded text-xs">□</button>
          <button onClick={() => window.openMusic.closeWindow()} className="w-8 h-6 flex items-center justify-center hover:bg-red-500/80 rounded text-xs">✕</button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-56 bg-[#111115] border-r border-white/5 flex flex-col py-4 px-2">
          {[
            { key: 'library', label: 'Library', icon: '🎵' },
            { key: 'playlists', label: 'Playlists', icon: '📋' },
            { key: 'search', label: 'Search', icon: '🔍' },
            { key: 'settings', label: 'Settings', icon: '⚙️' },
          ].map((item) => (
            <button key={item.key} onClick={() => setView(item.key as any)}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm mb-1 transition-colors ${view === item.key ? 'bg-purple-500/20 text-purple-400' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
              <span>{item.icon}</span><span>{item.label}</span>
            </button>
          ))}
          <div className="mt-auto px-3 text-xs text-gray-600">{trackCount} tracks</div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {view === 'library' && (
            <div>
              <h1 className="text-2xl font-bold mb-4">Library</h1>
              {tracks.length === 0 ? (
                <div className="text-center py-20">
                  <p className="text-4xl mb-4">🎵</p>
                  <p className="text-gray-400 mb-2">Your library is empty</p>
                  <p className="text-gray-500 text-sm">Import music from a file or connect a service</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {tracks.map((track) => (
                    <div key={track.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer">
                      <div className="w-10 h-10 rounded bg-gray-800 flex-shrink-0 overflow-hidden">
                        {track.cover_url && <img src={track.cover_url} className="w-full h-full object-cover" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{track.title}</p>
                        <p className="text-xs text-gray-500 truncate">{track.artist}</p>
                      </div>
                      <span className="text-xs text-gray-600">{Math.floor((track.duration_ms || 0) / 60000)}:{String(Math.floor(((track.duration_ms || 0) % 60000) / 1000)).padStart(2, '0')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {view === 'playlists' && (
            <div>
              <h1 className="text-2xl font-bold mb-4">Playlists</h1>
              <p className="text-gray-400">Your playlists will appear here</p>
            </div>
          )}

          {view === 'search' && (
            <div>
              <h1 className="text-2xl font-bold mb-4">Search</h1>
              <input type="text" placeholder="Search your library..." className="w-full px-4 py-3 rounded-lg bg-[#1a1a1e] border border-white/10 text-white placeholder:text-gray-500 focus:border-purple-500 focus:outline-none" />
            </div>
          )}

          {view === 'settings' && (
            <div>
              <h1 className="text-2xl font-bold mb-4">Settings</h1>
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-[#1a1a1e]">
                  <h3 className="font-medium mb-2">Local AI</h3>
                  <p className="text-sm text-gray-400">Connect Ollama for local AI recommendations</p>
                  <p className="text-xs text-gray-600 mt-1">Install Ollama → pull llama3.1 → enable here</p>
                </div>
                <div className="p-4 rounded-lg bg-[#1a1a1e]">
                  <h3 className="font-medium mb-2">Import Music</h3>
                  <p className="text-sm text-gray-400">Import from Spotify JSON, Apple Music CSV, or other formats</p>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
