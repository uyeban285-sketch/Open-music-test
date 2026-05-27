'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
const items = [
  { href: '/', label: 'Library', icon: '🎵' },
  { href: '/playlists', label: 'Playlists', icon: '📋' },
  { href: '/search', label: 'Search', icon: '🔍' },
  { href: '/recommendations', label: 'For You', icon: '✨' },
  { href: '/settings', label: 'Settings', icon: '⚙️' },
];
export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface/90 backdrop-blur-glass border-t border-muted/10">
      <div className="flex items-center justify-around h-16">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 text-xs transition-colors ${pathname === item.href ? 'text-accent' : 'text-muted'}`}
          >
            <span className="text-xl">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
