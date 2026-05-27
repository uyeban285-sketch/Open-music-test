'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
const navItems = [
  { href: '/', label: 'Library', icon: '🎵' },
  { href: '/playlists', label: 'Playlists', icon: '📋' },
  { href: '/search', label: 'Search', icon: '🔍' },
  { href: '/recommendations', label: 'For You', icon: '✨' },
  { href: '/settings', label: 'Settings', icon: '⚙️' },
];
export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:left-0 bg-surface/80 backdrop-blur-glass border-r border-muted/10 z-40">
      <div className="flex items-center h-16 px-6">
        <h1 className="text-xl font-bold text-accent">Open Music</h1>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-accent/10 text-accent' : 'text-muted hover:text-foreground hover:bg-muted/10'}`}
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="px-3 py-4 border-t border-muted/10">
        <p className="text-xs text-muted px-3">Open Music v0.1.0</p>
      </div>
    </aside>
  );
}
