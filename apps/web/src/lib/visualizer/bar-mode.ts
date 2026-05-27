/**
 * Bar Mode Visualizer — Canvas 2D frequency bars.
 * 32-64 logarithmic frequency bins, temporal smoothing α=0.6.
 * Colors from CSS variable --palette-accent.
 */

export interface BarModeOptions {
  canvas: HTMLCanvasElement;
  barCount?: number;
  smoothing?: number;
  intensity?: number; // 0-100
}

export class BarModeVisualizer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private barCount: number;
  private smoothing: number;
  private intensity: number;
  private smoothedBars: Float32Array;
  private animationId: number | null = null;
  private getFrequencyData: (() => Uint8Array) | null = null;

  constructor(options: BarModeOptions) {
    this.canvas = options.canvas;
    this.ctx = options.canvas.getContext('2d')!;
    this.barCount = options.barCount ?? 48;
    this.smoothing = options.smoothing ?? 0.6;
    this.intensity = (options.intensity ?? 75) / 100;
    this.smoothedBars = new Float32Array(this.barCount);
  }

  start(getFrequencyData: () => Uint8Array): void {
    this.getFrequencyData = getFrequencyData;
    this.animate();
  }

  stop(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  setIntensity(value: number): void {
    this.intensity = Math.max(0, Math.min(1, value / 100));
  }

  private animate = (): void => {
    this.animationId = requestAnimationFrame(this.animate);
    const data = this.getFrequencyData?.() ?? new Uint8Array(this.barCount);
    this.render(data);
  };

  private render(frequencyData: Uint8Array): void {
    const { canvas, ctx, barCount, smoothing, intensity, smoothedBars } = this;
    const w = (canvas.width = canvas.clientWidth * devicePixelRatio);
    const h = (canvas.height = canvas.clientHeight * devicePixelRatio);

    ctx.clearRect(0, 0, w, h);

    // Logarithmic binning
    const bins = this.logarithmicBins(frequencyData, barCount);

    // Temporal smoothing
    for (let i = 0; i < barCount; i++) {
      smoothedBars[i] = smoothedBars[i]! * smoothing + bins[i]! * (1 - smoothing);
    }

    // Get accent color from CSS
    const accentColor =
      getComputedStyle(document.documentElement).getPropertyValue('--palette-accent').trim() ||
      '139 92 246';
    const [r, g, b] = accentColor.split(' ').map(Number);

    const barWidth = (w / barCount) * 0.7;
    const gap = (w / barCount) * 0.3;

    for (let i = 0; i < barCount; i++) {
      const barHeight = (smoothedBars[i]! / 255) * h * intensity;
      const x = i * (barWidth + gap) + gap / 2;
      const y = h - barHeight;

      const alpha = 0.4 + (smoothedBars[i]! / 255) * 0.6;
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, [barWidth / 3, barWidth / 3, 0, 0]);
      ctx.fill();
    }
  }

  private logarithmicBins(data: Uint8Array, count: number): Float32Array {
    const bins = new Float32Array(count);
    const dataLength = data.length;

    for (let i = 0; i < count; i++) {
      const startFreq = Math.pow(i / count, 2) * dataLength;
      const endFreq = Math.pow((i + 1) / count, 2) * dataLength;
      const start = Math.floor(startFreq);
      const end = Math.min(Math.ceil(endFreq), dataLength);

      let sum = 0;
      let samples = 0;
      for (let j = start; j < end; j++) {
        sum += data[j]!;
        samples++;
      }
      bins[i] = samples > 0 ? sum / samples : 0;
    }
    return bins;
  }

  destroy(): void {
    this.stop();
  }
}
