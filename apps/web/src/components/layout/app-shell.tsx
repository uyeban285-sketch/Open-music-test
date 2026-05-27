'use client';
import { MiniPlayer } from './mini-player';
import { MobileNav } from './mobile-nav';
import { Sidebar } from './sidebar';
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <main className="lg:pl-64 pb-32 lg:pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">{children}</div>
      </main>
      <MiniPlayer />
      <MobileNav />
    </div>
  );
}
