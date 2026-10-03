import { GeminiClient } from './geminiClient';
import { AIIntent } from './intentParser';

export interface ProductCandidateInfo {
  id?: string;
  name: string;
  sku?: string;
  price?: number;
}

export interface ReplyGeneratorInput {
  customerMessage: string;
  language: 'uz' | 'ru' | 'en' | 'unknown';
  intent: AIIntent;
  productName?: string | null;
  productResolutionStatus?: 'resolved' | 'not_found' | 'ambiguous' | 'skipped' | 'error';
  productInfo?: {
    id: string;
    name: string;
    sku?: string;
    category?: string;
  } | null;
  stockInfo?: {
    available: boolean;
    quantity: number;
    warehouseName?: string;
  } | null;
  priceInfo?: {
    available: boolean;
    price: number;
    currency: string;
  } | null;
  ambiguousCandidates?: ProductCandidateInfo[] | null;
}

export interface GeneratedReply {
  text: string;
  language: 'uz' | 'ru' | 'en' | 'unknown';
}

export interface ReplyGeneratorResult {
  success: boolean;
  data?: GeneratedReply;
  errorCode?: string;
  errorMessage?: string;
}

export class ReplyGenerator {
  private geminiClient: GeminiClient;

  constructor(geminiClient?: GeminiClient) {
    this.geminiClient = geminiClient || GeminiClient.getInstance();
  }

  /**
   * Builds the strict, grounded prompt containing ONLY trusted backend values.
   * Public/exposed for testability and anti-hallucination verification.
   */
  static buildPrompt(input: ReplyGeneratorInput): string {
    const targetLang = input.language === 'ru' ? 'Russian' : input.language === 'en' ? 'English' : 'Uzbek (Latin script)';

    const backendFacts: Record<string, any> = {
      detected_intent: input.intent,
      resolution_status: input.productResolutionStatus || 'skipped',
    };

    if (input.productName) {
      backendFacts.queried_product_name = input.productName;
    }

    if (input.productInfo) {
      backendFacts.resolved_product = {
        name: input.productInfo.name,
        sku: input.productInfo.sku || null,
        category: input.productInfo.category || null,
      };
    }

    if (input.stockInfo) {
      backendFacts.stock = {
        available: input.stockInfo.available,
        quantity: input.stockInfo.quantity,
        warehouse: input.stockInfo.warehouseName || null,
      };
    } else {
      backendFacts.stock = { available: null, quantity: null, note: 'Stock information not provided' };
    }

    if (input.priceInfo) {
      backendFacts.price = {
        available: input.priceInfo.available,
        amount: input.priceInfo.price,
        currency: input.priceInfo.currency || 'UZS',
      };
    } else {
      backendFacts.price = { available: null, amount: null, note: 'Price information not provided' };
    }

    if (input.ambiguousCandidates && input.ambiguousCandidates.length > 0) {
      backendFacts.matching_candidates = input.ambiguousCandidates.map((c) => ({
        name: c.name,
        sku: c.sku || null,
      }));
    }

    return `You are a professional, helpful, polite retail sales assistant replying to a Telegram customer message.
Generate a concise, natural customer reply strictly using the verified backend data provided below.

TARGET LANGUAGE: ${targetLang}
CUSTOMER MESSAGE: "${input.customerMessage}"

TRUSTED BACKEND DATA (JSON):
${JSON.stringify(backendFacts, null, 2)}

STRICT SAFETY AND GROUNDING RULES:
1. ONLY state facts present in the TRUSTED BACKEND DATA.
2. NEVER invent prices, currency, stock numbers, discounts, delivery times, or guarantees.
3. If stock info is unavailable or null, do NOT claim it is in stock or out of stock. State politely that stock details will be clarified.
4. If price info is unavailable or null, do NOT invent a price. State politely that price details will be clarified.
5. If resolution_status is "not_found", politely state that this product was not found in our catalog.
6. If resolution_status is "ambiguous" and matching_candidates exist, list or mention the available variants (e.g. storage/color options) so the customer can specify.
7. If intent is "greeting", respond politely with a warm greeting and ask how you can assist them.
8. If intent is "unknown", politely ask how you can help or ask the customer to clarify their request.
9. If intent is "order_intent", acknowledge the order interest using the verified stock/price and ask for confirmation or delivery details, but NEVER claim that the order has already been finalized or created.
10. Return ONLY a single JSON object in the exact format:
{
  "reply": "<the natural reply text in the target language>",
  "language": "${input.language === 'unknown' ? 'uz' : input.language}"
}
Do NOT include markdown fences, extra commentary, or formatting outside the JSON object.`;
  }

  /**
   * Deterministic local fallback generator for when Gemini is offline or unavailable.
   * Ensures 100% reliability, zero hallucinations, and graceful degradation.
   */
  static generateFallbackReply(input: ReplyGeneratorInput): GeneratedReply {
    const lang = input.language === 'ru' ? 'ru' : input.language === 'en' ? 'en' : 'uz';
    const prodName = input.productInfo?.name || input.productName || '';

    // Uzbek fallback templates
    if (lang === 'uz') {
      if (input.intent === 'greeting') {
        return { text: 'Assalomu alaykum! Do\'konimizga xush kelibsiz. Sizga qanday yordam bera olaman?', language: 'uz' };
      }
      if (input.productResolutionStatus === 'not_found') {
        return { text: `Kechirasiz, "${prodName || 'so\'ralgan mahsulot'}" bizning do'konimizda topilmadi.`, language: 'uz' };
      }
      if (input.productResolutionStatus === 'ambiguous' && input.ambiguousCandidates?.length) {
        const list = input.ambiguousCandidates.map((c) => c.name).join(', ');
        return { text: `Bizda bir nechta variantlar mavjud: ${list}. Qaysi biri sizga kerak?`, language: 'uz' };
      }
      if (input.productResolutionStatus === 'resolved') {
        const parts: string[] = [];
        parts.push(`Ha, ${prodName} mavjud.`);
        if (input.stockInfo && input.stockInfo.available) {
          parts.push(`Omborda: ${input.stockInfo.quantity} dona bor.`);
        } else if (input.stockInfo && !input.stockInfo.available) {
          return { text: `Kechirasiz, ${prodName} hozirda sotuvda tugagan.`, language: 'uz' };
        }
        if (input.priceInfo && input.priceInfo.available) {
          parts.push(`Narxi: ${input.priceInfo.price.toLocaleString()} ${input.priceInfo.currency || 'so\'m'}.`);
        }
        return { text: parts.join(' '), language: 'uz' };
      }
      return { text: 'Assalomu alaykum! Qaysi mahsulot haqida ma\'lumot olmoqchisiz?', language: 'uz' };
    }

    // Russian fallback templates
    if (lang === 'ru') {
      if (input.intent === 'greeting') {
        return { text: 'Здравствуйте! Добро пожаловать. Чем могу вам помочь?', language: 'ru' };
      }
      if (input.productResolutionStatus === 'not_found') {
        return { text: `К сожалению, "${prodName || 'товар'}" не найден в нашем каталоге.`, language: 'ru' };
      }
      if (input.productResolutionStatus === 'ambiguous' && input.ambiguousCandidates?.length) {
        const list = input.ambiguousCandidates.map((c) => c.name).join(', ');
        return { text: `У нас есть несколько вариантов: ${list}. Какой именно вас интересует?`, language: 'ru' };
      }
      if (input.productResolutionStatus === 'resolved') {
        const parts: string[] = [];
        parts.push(`Да, ${prodName} есть в наличии.`);
        if (input.stockInfo && input.stockInfo.available) {
          parts.push(`Остаток: ${input.stockInfo.quantity} шт.`);
        } else if (input.stockInfo && !input.stockInfo.available) {
          return { text: `К сожалению, ${prodName} сейчас нет в наличии.`, language: 'ru' };
        }
        if (input.priceInfo && input.priceInfo.available) {
          parts.push(`Цена: ${input.priceInfo.price.toLocaleString()} ${input.priceInfo.currency || 'UZS'}.`);
        }
        return { text: parts.join(' '), language: 'ru' };
      }
      return { text: 'Здравствуйте! Какой товар вас интересует?', language: 'ru' };
    }

    // English fallback templates
    if (input.intent === 'greeting') {
      return { text: 'Hello! Welcome to our store. How can I help you today?', language: 'en' };
    }
    if (input.productResolutionStatus === 'not_found') {
      return { text: `Sorry, "${prodName || 'the product'}" was not found in our catalog.`, language: 'en' };
    }
    if (input.productResolutionStatus === 'ambiguous' && input.ambiguousCandidates?.length) {
      const list = input.ambiguousCandidates.map((c) => c.name).join(', ');
      return { text: `We have multiple options available: ${list}. Which one are you interested in?`, language: 'en' };
    }
    if (input.productResolutionStatus === 'resolved') {
      const parts: string[] = [];
      parts.push(`Yes, ${prodName} is available.`);
      if (input.stockInfo && input.stockInfo.available) {
        parts.push(`In stock: ${input.stockInfo.quantity} pcs.`);
      } else if (input.stockInfo && !input.stockInfo.available) {
        return { text: `Sorry, ${prodName} is currently out of stock.`, language: 'en' };
      }
      if (input.priceInfo && input.priceInfo.available) {
        parts.push(`Price: ${input.priceInfo.price.toLocaleString()} ${input.priceInfo.currency || 'UZS'}.`);
      }
      return { text: parts.join(' '), language: 'en' };
    }
    return { text: 'Hello! Which product would you like to inquire about?', language: 'en' };
  }

  /**
   * Generates a customer-facing Telegram reply based strictly on trusted backend data.
   */
  async generateReply(input: ReplyGeneratorInput): Promise<ReplyGeneratorResult> {
    if (!input || !input.customerMessage || typeof input.customerMessage !== 'string') {
      return {
        success: false,
        errorCode: 'INVALID_INPUT',
        errorMessage: 'Customer message is required and must not be empty.',
      };
    }

    const prompt = ReplyGenerator.buildPrompt(input);

    try {
      const genResult = await this.geminiClient.generateText(prompt);

      if (!genResult.success || !genResult.text) {
        console.warn(`[ReplyGenerator] Gemini generation failed: ${genResult.errorCode} - ${genResult.errorMessage}. Using safe fallback.`);
        return {
          success: false,
          errorCode: genResult.errorCode || 'GEMINI_ERROR',
          errorMessage: genResult.errorMessage || 'Failed to generate AI response from Gemini.',
          data: ReplyGenerator.generateFallbackReply(input),
        };
      }

      // Clean fences
      let cleaned = genResult.text.trim();
      cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '').trim();

      try {
        const parsed = JSON.parse(cleaned);

        if (parsed && typeof parsed.reply === 'string' && parsed.reply.trim()) {
          const lang = input.language === 'unknown' ? 'uz' : input.language;
          return {
            success: true,
            data: {
              text: parsed.reply.trim(),
              language: (parsed.language || lang) as any,
            },
          };
        } else {
          console.warn('[ReplyGenerator] Malformed JSON structure from Gemini. Using safe fallback.');
          return {
            success: false,
            errorCode: 'MALFORMED_OUTPUT',
            errorMessage: 'Gemini output did not match expected reply structure.',
            data: ReplyGenerator.generateFallbackReply(input),
          };
        }
      } catch (jsonErr: any) {
        console.warn('[ReplyGenerator] Failed to parse JSON from Gemini output. Using safe fallback.');
        return {
          success: false,
          errorCode: 'JSON_PARSE_ERROR',
          errorMessage: 'Failed to parse JSON response from Gemini.',
          data: ReplyGenerator.generateFallbackReply(input),
        };
      }
    } catch (err: any) {
      console.error('[ReplyGenerator] Unexpected error during reply generation:', err);
      return {
        success: false,
        errorCode: 'UNEXPECTED_ERROR',
        errorMessage: err?.message || 'Unexpected error in ReplyGenerator.',
        data: ReplyGenerator.generateFallbackReply(input),
      };
    }
  }
}
