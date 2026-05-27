export { BarModeVisualizer } from './bar-mode';
export { CircularModeVisualizer } from './circular-mode';
export { LiquidModeVisualizer } from './liquid-mode';

export type VisualizerMode = 'bar' | 'circular' | 'liquid' | 'off';

/**
 * Factory to create the appropriate visualizer based on mode.
 */
export function createVisualizer(mode: VisualizerMode, canvas: HTMLCanvasElement, intensity = 75) {
  switch (mode) {
    case 'bar':
      return new BarModeVisualizer({ canvas, intensity });
    case 'circular':
      return new CircularModeVisualizer({ canvas, intensity });
    case 'liquid':
      return new LiquidModeVisualizer({ canvas, intensity });
    case 'off':
      return null;
  }
}
