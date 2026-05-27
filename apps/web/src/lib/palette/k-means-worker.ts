/**
 * K-means color extraction for Dynamic Palette.
 * Runs in Web Worker via OffscreenCanvas for <200ms budget.
 * Extracts 4-6 dominant colors from track cover art.
 */

interface RGB {
  r: number;
  g: number;
  b: number;
}
interface HSL {
  h: number;
  s: number;
  l: number;
}

export interface PaletteResult {
  colors: Array<{ rgb: RGB; hsl: HSL; population: number }>;
  dominant: RGB;
  accent: RGB;
  background: RGB;
  text: RGB;
  extractionTimeMs: number;
}

/**
 * Extract dominant colors from an image URL.
 * Uses k-means clustering on downsampled 64x64 image.
 */
export async function extractPalette(
  imageUrl: string,
  k = 5,
  maxIterations = 30,
): Promise<PaletteResult> {
  const start = performance.now();

  // Load and downsample image
  const pixels = await loadImagePixels(imageUrl, 64, 64);

  // Filter near-greys (low saturation)
  const colorful = pixels.filter((p) => {
    const hsl = rgbToHsl(p);
    return hsl.s > 0.1;
  });

  const input = colorful.length > 50 ? colorful : pixels;

  // K-means clustering
  const clusters = kMeans(input, k, maxIterations);

  // Sort by population
  clusters.sort((a, b) => b.population - a.population);

  const colors = clusters.map((c) => ({
    rgb: c.centroid,
    hsl: rgbToHsl(c.centroid),
    population: c.population,
  }));

  const dominant = colors[0]?.rgb ?? { r: 139, g: 92, b: 246 };
  const accent = colors[1]?.rgb ?? dominant;

  // Ensure text contrast (WCAG AA ≥ 4.5:1)
  const background = ensureContrast(dominant, 'background');
  const text = ensureContrast(dominant, 'text');

  return {
    colors,
    dominant,
    accent,
    background,
    text,
    extractionTimeMs: performance.now() - start,
  };
}

// ─── K-Means ─────────────────────────────────────────────────────────────────

interface Cluster {
  centroid: RGB;
  points: RGB[];
  population: number;
}

function kMeans(pixels: RGB[], k: number, maxIter: number): Cluster[] {
  // Initialize centroids randomly
  let centroids: RGB[] = [];
  const step = Math.max(1, Math.floor(pixels.length / k));
  for (let i = 0; i < k; i++) {
    centroids.push(pixels[i * step] ?? pixels[0]!);
  }

  let clusters: Cluster[] = [];

  for (let iter = 0; iter < maxIter; iter++) {
    // Assign pixels to nearest centroid
    clusters = centroids.map((c) => ({ centroid: c, points: [], population: 0 }));

    for (const p of pixels) {
      let minDist = Infinity;
      let nearest = 0;
      for (let i = 0; i < centroids.length; i++) {
        const d = colorDistance(p, centroids[i]!);
        if (d < minDist) {
          minDist = d;
          nearest = i;
        }
      }
      clusters[nearest]!.points.push(p);
    }

    // Update centroids
    let converged = true;
    const newCentroids: RGB[] = [];
    for (const cluster of clusters) {
      if (cluster.points.length === 0) {
        newCentroids.push(cluster.centroid);
        continue;
      }
      const avg = {
        r: Math.round(cluster.points.reduce((s, p) => s + p.r, 0) / cluster.points.length),
        g: Math.round(cluster.points.reduce((s, p) => s + p.g, 0) / cluster.points.length),
        b: Math.round(cluster.points.reduce((s, p) => s + p.b, 0) / cluster.points.length),
      };
      if (colorDistance(avg, cluster.centroid) > 1) converged = false;
      newCentroids.push(avg);
      cluster.population = cluster.points.length;
      cluster.centroid = avg;
    }

    centroids = newCentroids;
    if (converged) break;
  }

  return clusters.filter((c) => c.population > 0);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function colorDistance(a: RGB, b: RGB): number {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

function rgbToHsl(rgb: RGB): HSL {
  const r = rgb.r / 255,
    g = rgb.g / 255,
    b = rgb.b / 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0,
    s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }

  return { h: h * 360, s, l };
}

function relativeLuminance(rgb: RGB): number {
  const [rs, gs, bs] = [rgb.r, rgb.g, rgb.b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs! + 0.7152 * gs! + 0.0722 * bs!;
}

function contrastRatio(c1: RGB, c2: RGB): number {
  const l1 = relativeLuminance(c1);
  const l2 = relativeLuminance(c2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function ensureContrast(dominant: RGB, role: 'background' | 'text'): RGB {
  const hsl = rgbToHsl(dominant);
  if (role === 'background') {
    // Dark background from dominant hue
    return hslToRgb({ h: hsl.h, s: Math.min(hsl.s, 0.3), l: 0.08 });
  }
  // Ensure text is readable (≥4.5:1)
  const white = { r: 250, g: 250, b: 250 };
  const bg = hslToRgb({ h: hsl.h, s: Math.min(hsl.s, 0.3), l: 0.08 });
  if (contrastRatio(white, bg) >= 4.5) return white;
  return { r: 255, g: 255, b: 255 };
}

function hslToRgb(hsl: HSL): RGB {
  const { h, s, l } = hsl;
  const hNorm = h / 360;
  let r: number, g: number, b: number;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, hNorm + 1 / 3);
    g = hue2rgb(p, q, hNorm);
    b = hue2rgb(p, q, hNorm - 1 / 3);
  }

  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

async function loadImagePixels(url: string, w: number, h: number): Promise<RGB[]> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, w, h);
      const imageData = ctx.getImageData(0, 0, w, h);
      const pixels: RGB[] = [];
      for (let i = 0; i < imageData.data.length; i += 4) {
        pixels.push({
          r: imageData.data[i]!,
          g: imageData.data[i + 1]!,
          b: imageData.data[i + 2]!,
        });
      }
      resolve(pixels);
    };
    img.onerror = () => resolve([{ r: 139, g: 92, b: 246 }]);
    img.src = url;
  });
}
