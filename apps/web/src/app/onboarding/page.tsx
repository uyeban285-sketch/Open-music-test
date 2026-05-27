'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
type Step = 'connect' | 'theme' | 'visualizer' | 'done';
const STEPS: Step[] = ['connect', 'theme', 'visualizer', 'done'];
export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('connect');
  const [theme, setTheme] = useState<'dark' | 'light' | 'system'>('dark');
  const [viz, setViz] = useState<'bar' | 'circular' | 'liquid' | 'off'>('bar');
  const idx = STEPS.indexOf(step);
  const isLast = idx === STEPS.length - 1;
  const next = () => {
    if (isLast) {
      router.push('/');
      return;
    }
    setStep(STEPS[idx + 1]!);
  };
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="flex gap-2 mb-8">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={`w-2.5 h-2.5 rounded-full ${i <= idx ? 'bg-accent' : 'bg-muted/30'}`}
          />
        ))}
      </div>
      <div className="w-full max-w-lg">
        {step === 'connect' && (
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Connect a music service</h2>
            <p className="text-muted mb-6">Link your account to import your library</p>
            <div className="space-y-3 mb-6">
              <button className="w-full flex items-center gap-4 p-4 rounded-lg bg-surface hover:bg-muted/10 text-left">
                <span className="text-2xl">🎵</span>
                <div>
                  <p className="font-medium">Yandex Music</p>
                  <p className="text-sm text-muted">OAuth</p>
                </div>
              </button>
              <button className="w-full flex items-center gap-4 p-4 rounded-lg bg-surface hover:bg-muted/10 text-left">
                <span className="text-2xl">▶️</span>
                <div>
                  <p className="font-medium">YouTube Music</p>
                  <p className="text-sm text-muted">Google OAuth</p>
                </div>
              </button>
              <button className="w-full flex items-center gap-4 p-4 rounded-lg bg-surface hover:bg-muted/10 text-left">
                <span className="text-2xl">📁</span>
                <div>
                  <p className="font-medium">Import file</p>
                  <p className="text-sm text-muted">JSON/CSV/ZIP</p>
                </div>
              </button>
            </div>
          </div>
        )}
        {step === 'theme' && (
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Choose theme</h2>
            <div className="grid grid-cols-3 gap-3 my-6">
              {(['dark', 'light', 'system'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`p-4 rounded-lg border-2 ${theme === t ? 'border-accent bg-accent/10' : 'border-muted/20 bg-surface'}`}
                >
                  <span className="text-2xl block mb-1">
                    {t === 'dark' ? '🌙' : t === 'light' ? '☀️' : '💻'}
                  </span>
                  <span className="text-sm capitalize">{t}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {step === 'visualizer' && (
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Equalizer style</h2>
            <div className="grid grid-cols-2 gap-3 my-6">
              {(
                [
                  { id: 'bar', i: '📊' },
                  { id: 'circular', i: '🔵' },
                  { id: 'liquid', i: '🌊' },
                  { id: 'off', i: '⚡' },
                ] as const
              ).map((v) => (
                <button
                  key={v.id}
                  onClick={() => setViz(v.id as any)}
                  className={`p-4 rounded-lg border-2 ${viz === v.id ? 'border-accent bg-accent/10' : 'border-muted/20 bg-surface'}`}
                >
                  <span className="text-2xl block mb-1">{v.i}</span>
                  <span className="text-sm capitalize">{v.id}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {step === 'done' && (
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">All set!</h2>
            <p className="text-muted mb-6">AI will personalize as you listen.</p>
            <div className="p-6 rounded-lg bg-surface mb-6">
              <span className="text-4xl block mb-3">🎧</span>
              <p className="text-sm text-muted">Fine-tune in Settings anytime.</p>
            </div>
          </div>
        )}
        <div className="flex justify-between">
          <button onClick={next} className="text-sm text-muted">
            {isLast ? '' : 'Skip'}
          </button>
          <button
            onClick={next}
            className="px-6 py-2.5 rounded-lg bg-accent text-white font-medium"
          >
            {isLast ? 'Get Started' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
