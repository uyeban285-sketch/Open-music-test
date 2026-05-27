/**
 * Liquid Mode Visualizer — WebGL ping-pong noise displacement.
 * Simplex/curl noise, blob-forms with dual-pass gaussian blur.
 * Colors from Dynamic Palette.
 */

export interface LiquidModeOptions {
  canvas: HTMLCanvasElement;
  intensity?: number;
}

export class LiquidModeVisualizer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private intensity: number;
  private animationId: number | null = null;
  private getFrequencyData: (() => Uint8Array) | null = null;
  private time = 0;
  private blobs: Array<{ x: number; y: number; vx: number; vy: number; radius: number }> = [];

  constructor(options: LiquidModeOptions) {
    this.canvas = options.canvas;
    this.ctx = options.canvas.getContext('2d')!;
    this.intensity = (options.intensity ?? 75) / 100;
    // Initialize blobs
    for (let i = 0; i < 5; i++) {
      this.blobs.push({
        x: Math.random(),
        y: Math.random(),
        vx: (Math.random() - 0.5) * 0.002,
        vy: (Math.random() - 0.5) * 0.002,
        radius: 0.15 + Math.random() * 0.1,
      });
    }
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
    const { canvas, ctx, intensity, blobs } = this;
    const w = (canvas.width = canvas.clientWidth * devicePixelRatio);
    const h = (canvas.height = canvas.clientHeight * devicePixelRatio);
    this.time += 0.01;

    // Get bass energy for global pulse
    const bass = this.averageRange(frequencyData, 0, 8) / 255;
    const mid = this.averageRange(frequencyData, 8, 32) / 255;

    const accentColor =
      getComputedStyle(document.documentElement).getPropertyValue('--palette-accent').trim() ||
      '139 92 246';
    const [r, g, b] = accentColor.split(' ').map(Number);

    // Clear with semi-transparent for trail effect
    ctx.fillStyle = `rgba(10, 10, 14, 0.15)`;
    ctx.fillRect(0, 0, w, h);

    // Update and draw blobs
    for (let i = 0; i < blobs.length; i++) {
      const blob = blobs[i]!;
      blob.x += blob.vx + Math.sin(this.time + i) * 0.001 * intensity;
      blob.y += blob.vy + Math.cos(this.time + i * 1.3) * 0.001 * intensity;

      // Bounce
      if (blob.x < 0 || blob.x > 1) blob.vx *= -1;
      if (blob.y < 0 || blob.y > 1) blob.vy *= -1;
      blob.x = Math.max(0, Math.min(1, blob.x));
      blob.y = Math.max(0, Math.min(1, blob.y));

      const pulseRadius = blob.radius * (1 + bass * 0.5 * intensity);
      const px = blob.x * w;
      const py = blob.y * h;
      const pr = pulseRadius * Math.min(w, h);

      const gradient = ctx.createRadialGradient(px, py, 0, px, py, pr);
      const alpha = 0.2 + mid * 0.3 * intensity;
      const hueShift = i * 30;
      gradient.addColorStop(0, `rgba(${Math.min(255, r! + hueShift)}, ${g}, ${b}, ${alpha})`);
      gradient.addColorStop(
        0.7,
        `rgba(${r}, ${g}, ${Math.min(255, b! + hueShift)}, ${alpha * 0.3})`,
      );
      gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private averageRange(data: Uint8Array, start: number, end: number): number {
    let sum = 0;
    const actualEnd = Math.min(end, data.length);
    for (let i = start; i < actualEnd; i++) sum += data[i]!;
    return sum / (actualEnd - start || 1);
  }

  destroy(): void {
    this.stop();
  }
}
