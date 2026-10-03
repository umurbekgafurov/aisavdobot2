import { GoogleGenAI } from '@google/genai';

export interface GeminiClientOptions {
  apiKey?: string;
  model?: string;
}

export interface GenerateTextResult {
  success: boolean;
  text?: string;
  errorCode?: string;
  errorMessage?: string;
}

export class GeminiClient {
  private static instance: GeminiClient | null = null;
  private client: GoogleGenAI | null = null;
  private modelName: string;

  constructor(options?: GeminiClientOptions) {
    const envKey = typeof process !== 'undefined' ? process.env?.GEMINI_API_KEY : (import.meta as any)?.env?.VITE_GEMINI_API_KEY;
    const envModel = typeof process !== 'undefined' ? process.env?.GEMINI_MODEL : undefined;
    const key = options?.apiKey !== undefined ? options.apiKey : envKey;
    this.modelName = options?.model || envModel || 'gemini-3.1-flash-lite';

    if (key && key.trim()) {
      try {
        this.client = new GoogleGenAI({
          apiKey: key.trim(),
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        });
      } catch (err: any) {
        console.error('[GeminiClient] Initialization error:', err?.message || err);
        this.client = null;
      }
    } else {
      this.client = null;
    }
  }

  static getInstance(): GeminiClient {
    if (!GeminiClient.instance) {
      GeminiClient.instance = new GeminiClient();
    }
    return GeminiClient.instance;
  }

  /**
   * Reset instance (useful for testing or key updates)
   */
  static resetInstance(): void {
    GeminiClient.instance = null;
  }

  /**
   * Check if Gemini API key is configured
   */
  isConfigured(): boolean {
    return this.client !== null;
  }

  /**
   * Get configured model name
   */
  getModelName(): string {
    return this.modelName;
  }

  /**
   * Reusable server-side text generation with automated model fallback.
   * Handles missing key, temporary model spikes (503/429), timeouts, and API exceptions cleanly without throwing.
   */
  async generateText(prompt: string): Promise<GenerateTextResult> {
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return {
        success: false,
        errorCode: 'EMPTY_PROMPT',
        errorMessage: 'Prompt cannot be empty.',
      };
    }

    if (!this.client) {
      return {
        success: false,
        errorCode: 'MISSING_API_KEY',
        errorMessage: 'GEMINI_API_KEY is not configured on the server.',
      };
    }

    const candidateModels = [
      this.modelName,
      'gemini-3.1-flash-lite',
      'gemini-flash-latest',
      'gemini-3.8-flash',
    ].filter((m, i, arr) => arr.indexOf(m) === i);

    let lastError: any = null;

    for (const modelToTry of candidateModels) {
      try {
        const response = await this.client.models.generateContent({
          model: modelToTry,
          contents: prompt.trim(),
        });

        const reply = response.text?.trim() || '';
        return {
          success: true,
          text: reply,
        };
      } catch (err: any) {
        lastError = err;
        const msg = err?.message || String(err);
        const isTemporary =
          msg.includes('503') ||
          msg.includes('UNAVAILABLE') ||
          msg.includes('high demand') ||
          msg.includes('429') ||
          msg.includes('quota') ||
          msg.includes('RESOURCE_EXHAUSTED') ||
          msg.includes('timeout') ||
          msg.includes('ETIMEDOUT') ||
          err?.status === 503 ||
          err?.status === 429;

        if (!isTemporary) {
          break;
        }
      }
    }

    const msg = lastError?.message || String(lastError);
    const isQuotaOrRateLimit = msg.includes('429') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED') || lastError?.status === 429;
    const isTimeout = msg.includes('timeout') || msg.includes('ETIMEDOUT');
    const isOverloaded = msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('high demand') || lastError?.status === 503;

    return {
      success: false,
      errorCode: isQuotaOrRateLimit ? 'RATE_LIMIT' : isOverloaded ? 'MODEL_OVERLOADED' : isTimeout ? 'TIMEOUT' : 'API_ERROR',
      errorMessage: isQuotaOrRateLimit
        ? 'Gemini API quota or rate limit reached.'
        : isOverloaded
        ? 'Gemini models are temporarily experiencing high demand.'
        : isTimeout
        ? 'Gemini API call timed out.'
        : 'Gemini API request failed.',
    };
  }
}
