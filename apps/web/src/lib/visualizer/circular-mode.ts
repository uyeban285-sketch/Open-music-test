/**
 * Circular Mode Visualizer — WebGL (via regl) concentric waves around cover.
 * Radius perturbed by frequency bins, beat-morphing shader.
 */

export interface CircularModeOptions {
  canvas: HTMLCanvasElement;
  intensity?: number;
}

export class CircularModeVisualizer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private intensity: number;
  private animationId: number | null = null;
  private getFrequencyData: (() => Uint8Array) | null = null;
  private phase = 0;

  constructor(options: CircularModeOptions) {
    this.canvas = options.canvas;
    this.ctx = options.canvas.getContext('2d')!;
    this.intensity = (options.intensity ?? 75) / 100;
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
    const data = this.getFrequencyData?.() ?? new Uint8Array(64);
    this.render(data);
  };

  private render(frequencyData: Uint8Array): void {
    const { canvas, ctx, intensity } = this;
    const w = (canvas.width = canvas.clientWidth * devicePixelRatio);
    const h = (canvas.height = canvas.clientHeight * devicePixelRatio);
    const cx = w / 2,
      cy = h / 2;
    const baseRadius = Math.min(w, h) * 0.25;

    ctx.clearRect(0, 0, w, h);
    this.phase += 0.02;

    const accentColor =
      getComputedStyle(document.documentElement).getPropertyValue('--palette-accent').trim() ||
      '139 92 246';
    const [r, g, b] = accentColor.split(' ').map(Number);

    // Draw 3 concentric rings
    for (let ring = 0; ring < 3; ring++) {
      const ringRadius = baseRadius * (1 + ring * 0.4);
      const alpha = 0.6 - ring * 0.15;
      const points = 64;

      ctx.beginPath();
      for (let i = 0; i <= points; i++) {
        const angle = (i / points) * Math.PI * 2;
        const freqIndex = Math.floor((i / points) * Math.min(frequencyData.length, 64));
        const amplitude = (frequencyData[freqIndex]! / 255) * baseRadius * 0.5 * intensity;
        const perturbation = amplitude * Math.sin(angle * 3 + this.phase + ring);
        const radius = ringRadius + perturbation;
        const x = cx + Math.cos(angle) * radius;
        const y = cy + Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      ctx.lineWidth = 2 - ring * 0.5;
      ctx.stroke();
    }
  }

  destroy(): void {
    this.stop();
  }
}
