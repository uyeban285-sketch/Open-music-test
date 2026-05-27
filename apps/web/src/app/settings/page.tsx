'use client';
import { useState } from 'react';
export default function SettingsPage() {
  const [theme, setTheme] = useState<'dark' | 'light' | 'system'>('dark');
  const [vizMode, setVizMode] = useState('bar');
  const [dynamicPalette, setDynamicPalette] = useState(true);
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      <div className="space-y-6">
        <section className="p-4 rounded-lg bg-surface">
          <h2 className="font-semibold mb-3">Appearance</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm">Theme</span>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value as any)}
                className="bg-background border border-muted/30 rounded px-2 py-1 text-sm"
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
                <option value="system">System</option>
              </select>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Dynamic Palette</span>
              <button
                onClick={() => setDynamicPalette(!dynamicPalette)}
                className={`w-10 h-5 rounded-full transition-colors ${dynamicPalette ? 'bg-accent' : 'bg-muted/30'}`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transform transition-transform ${dynamicPalette ? 'translate-x-5' : 'translate-x-0.5'}`}
                />
              </button>
            </div>
          </div>
        </section>
        <section className="p-4 rounded-lg bg-surface">
          <h2 className="font-semibold mb-3">Equalizer</h2>
          <div className="grid grid-cols-4 gap-2">
            {['bar', 'circular', 'liquid', 'off'].map((m) => (
              <button
                key={m}
                onClick={() => setVizMode(m)}
                className={`p-2 rounded text-xs text-center capitalize ${vizMode === m ? 'bg-accent/20 text-accent border border-accent' : 'bg-muted/10 text-muted border border-transparent'}`}
              >
                {m}
              </button>
            ))}
          </div>
        </section>
        <section className="p-4 rounded-lg bg-surface">
          <h2 className="font-semibold mb-3">Connected Services</h2>
          <p className="text-sm text-muted">Manage your music service connections</p>
          <a href="/settings" className="text-accent text-sm mt-2 inline-block">
            Manage connections →
          </a>
        </section>
        <section className="p-4 rounded-lg bg-surface">
          <h2 className="font-semibold mb-3">Privacy</h2>
          <p className="text-sm text-muted">Control how your data is used</p>
        </section>
      </div>
    </div>
  );
}
