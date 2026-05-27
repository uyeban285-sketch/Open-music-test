/**
 * Audio Engine — Web Audio API integration for playback and spectrum analysis.
 * Provides AnalyserNode data for Equalizer Visualizer.
 */

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private frequencyData: Uint8Array = new Uint8Array(0);

  get isInitialized(): boolean {
    return this.ctx !== null;
  }
  get sampleRate(): number {
    return this.ctx?.sampleRate ?? 44100;
  }

  async initialize(audioElement: HTMLAudioElement): Promise<void> {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    this.audioElement = audioElement;
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.6;
    this.source = this.ctx.createMediaElementSource(audioElement);
    this.source.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
    this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
  }

  getFrequencyData(): Uint8Array {
    if (!this.analyser) return new Uint8Array(64).fill(0);
    this.analyser.getByteFrequencyData(this.frequencyData);
    return this.frequencyData;
  }

  getTimeDomainData(): Uint8Array {
    if (!this.analyser) return new Uint8Array(2048).fill(128);
    const data = new Uint8Array(this.analyser.fftSize);
    this.analyser.getByteTimeDomainData(data);
    return data;
  }

  setFftSize(size: 512 | 1024 | 2048): void {
    if (this.analyser) {
      this.analyser.fftSize = size;
      this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
    }
  }

  resume(): void {
    this.ctx?.resume();
  }
  suspend(): void {
    this.ctx?.suspend();
  }

  destroy(): void {
    this.source?.disconnect();
    this.analyser?.disconnect();
    this.ctx?.close();
    this.ctx = null;
    this.analyser = null;
    this.source = null;
  }
}

export const audioEngine = new AudioEngine();
