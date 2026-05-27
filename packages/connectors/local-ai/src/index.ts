/**
 * Local AI Connector — connects to OpenAI-compatible endpoints
 * (Ollama, llama.cpp server, MLX, LM Studio, vLLM).
 */

export interface LocalAIConfig {
  enabled: boolean;
  baseUrl: string;
  modelChat: string;
  modelEmbed: string;
  timeoutMs: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class LocalAIClient {
  private config: LocalAIConfig;
  constructor(config: LocalAIConfig) {
    this.config = config;
  }

  get isEnabled(): boolean {
    return this.config.enabled;
  }

  async healthCheck(): Promise<{ ok: boolean; models?: string[]; error?: string }> {
    try {
      const res = await fetch(`${this.config.baseUrl}/models`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
      const data = await res.json();
      return { ok: true, models: (data.data ?? []).map((m: any) => m.id) };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  async chatCompletion(
    messages: ChatMessage[],
    options?: { temperature?: number; maxTokens?: number },
  ) {
    const res = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.modelChat,
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 512,
        stream: false,
      }),
      signal: AbortSignal.timeout(this.config.timeoutMs),
    });
    if (!res.ok) throw new Error(`Local AI chat error: ${res.status}`);
    return res.json();
  }

  async createEmbedding(input: string | string[]) {
    const res = await fetch(`${this.config.baseUrl}/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.modelEmbed,
        input: Array.isArray(input) ? input : [input],
      }),
      signal: AbortSignal.timeout(this.config.timeoutMs),
    });
    if (!res.ok) throw new Error(`Local AI embedding error: ${res.status}`);
    return res.json();
  }

  async explainRecommendation(params: {
    trackTitle: string;
    trackArtist: string;
    reasons: string[];
    userHistory: string[];
  }): Promise<string> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content:
          'You are a music recommendation explainer. Generate a brief, friendly explanation (1-2 sentences in Russian) why a track was recommended.',
      },
      {
        role: 'user',
        content: `Track: "${params.trackTitle}" by ${params.trackArtist}\nReasons: ${params.reasons.join(', ')}\nHistory: ${params.userHistory.slice(0, 5).join(', ')}`,
      },
    ];
    const response = await this.chatCompletion(messages, { temperature: 0.6, maxTokens: 150 });
    return response.choices?.[0]?.message?.content ?? 'Рекомендация на основе вашего вкуса.';
  }

  updateConfig(config: Partial<LocalAIConfig>) {
    this.config = { ...this.config, ...config };
  }
}

export const DEFAULT_LOCAL_AI_CONFIG: LocalAIConfig = {
  enabled: false,
  baseUrl: 'http://127.0.0.1:11434/v1',
  modelChat: 'llama3.1:8b-instruct',
  modelEmbed: 'nomic-embed-text',
  timeoutMs: 30000,
};
