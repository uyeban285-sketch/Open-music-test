/**
 * Apply Dynamic Palette — updates CSS variables with smooth transition.
 * Respects prefers-reduced-motion.
 */

import type { PaletteResult } from './k-means-worker';

const TRANSITION_DURATION_MS = 500;

export function applyPalette(palette: PaletteResult, reducedMotion = false): void {
  const root = document.documentElement;
  const transitionMs = reducedMotion ? 0 : TRANSITION_DURATION_MS;

  // Set transition on root
  root.style.setProperty('--palette-transition', `${transitionMs}ms`);

  // Apply colors
  const { background, dominant, accent, text } = palette;
  root.style.setProperty('--palette-bg', `${background.r} ${background.g} ${background.b}`);
  root.style.setProperty('--palette-accent', `${accent.r} ${accent.g} ${accent.b}`);
  root.style.setProperty('--palette-fg', `${text.r} ${text.g} ${text.b}`);
  root.style.setProperty(
    '--palette-surface',
    `${Math.min(background.r + 14, 255)} ${Math.min(background.g + 14, 255)} ${Math.min(background.b + 14, 255)}`,
  );
}

export function resetPalette(): void {
  const root = document.documentElement;
  root.style.setProperty('--palette-bg', '10 10 14');
  root.style.setProperty('--palette-fg', '250 250 250');
  root.style.setProperty('--palette-accent', '139 92 246');
  root.style.setProperty('--palette-surface', '24 24 28');
}
