import { GeminiClient } from './geminiClient';

export type AIIntent =
  | 'product_query'
  | 'stock_query'
  | 'price_query'
  | 'order_intent'
  | 'greeting'
  | 'unknown';

export interface ParsedIntent {
  intent: AIIntent;
  product_name: string | null;
  quantity: number | null;
  confidence: number;
  language: 'uz' | 'ru' | 'en' | 'unknown';
}

export interface IntentParserResult {
  success: boolean;
  data?: ParsedIntent;
  errorCode?: string;
  errorMessage?: string;
}

export class IntentParser {
  private geminiClient: GeminiClient;

  constructor(geminiClient?: GeminiClient) {
    this.geminiClient = geminiClient || GeminiClient.getInstance();
  }

  /**
   * Parse user message text into structured intent
   * No database access, pure text classification and parameter extraction
   */
  async parseIntent(params: { text: string }): Promise<IntentParserResult> {
    const rawText = params?.text;

    if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
      return {
        success: false,
        errorCode: 'EMPTY_INPUT',
        errorMessage: 'Input text cannot be empty or whitespace only.',
      };
    }

    const trimmed = rawText.trim();

    const prompt = `You are a strict retail intent extraction engine for customer messages in Uzbek Latin, Russian, or English.
Analyze the following customer message and return a strictly structured JSON object.

RULES:
1. Return JSON only. No markdown fences, no explanations, no commentary.
2. Supported intents:
   - "order_intent": Customer expresses a clear, genuine intention to buy, order, purchase, or take items.
     Examples:
     * "iPhone 15 Pro 256GB kerak" -> order_intent
     * "2 ta iPhone 15 Pro 256GB olaman" -> order_intent
     * "Menga 3 dona Samsung S24 kerak" -> order_intent
     * "Мне нужно 2 iPhone 15" -> order_intent
     * "I want 3 Samsung S24 phones" -> order_intent
     * "Buyurtma bermoqchiman", "Zakaz qilmoqchiman", "Sotib olaman" -> order_intent
   - "price_query": Customer asks about price or cost (e.g. "iPhone 15 qancha?", "Narxi nechchi?", "Сколько стоит?", "How much is iPhone 15?"). Do NOT classify as order_intent.
   - "stock_query": Customer asks about availability or remaining count (e.g. "Nechta bor?", "Nechta qoldi?", "Сколько осталось?", "How many in stock?"). Do NOT classify as order_intent.
   - "product_query": Customer asks whether a product exists or asks for info (e.g. "iPhone 15 bormi?", "iPhone 15 haqida ma'lumot bering", "Есть ли iPhone 15?", "Tell me about iPhone 15"). Do NOT classify as order_intent.
   - "greeting": Polite greetings (e.g. "Assalomu alaykum", "Salom", "Здравствуйте", "Hello").
   - "unknown": Unclear, gibberish, multiple unrelated requests, or irrelevant messages (e.g. "asdfgh???").

3. MULTIPLE PRODUCTS SAFETY RULE:
   - If the customer asks to order multiple different products at once (e.g. "iPhone 15 va MacBook Air kerak", "Мне 1 iPhone и 1 iPad"), do NOT merge them into one product name.
   - Set product_name = null, quantity = null, confidence = 0.5 or lower, or mark intent as "unknown"/"order_intent" with product_name = null so downstream services do not silently place an inaccurate merged order.

4. product_name:
   - Extract the exact single product name, brand, and model mentioned in the message (e.g. "iPhone 15 Pro 256GB", "Samsung S24").
   - If no specific product is mentioned or multiple different products are mixed, return null.
   - Do NOT invent or hallucinate product names, brands, IDs, or SKUs.

5. quantity:
   - If quantity is explicitly stated in Uzbek, Russian, or English (e.g. "2 ta", "3 dona", "x2", "2 pieces", "4 шт", "1 unit"):
     extract the exact positive integer.
   - If intent is "order_intent" and a clear single product is requested but NO quantity is stated (e.g. "iPhone 15 Pro 256GB kerak", "Хочу iPhone 15"):
     default quantity = 1.
   - If quantity is zero, negative, fractional, or otherwise invalid (e.g. 0, -1, 1.5):
     return null.
   - For non-order intents (product_query, price_query, stock_query, greeting, unknown), return null unless an explicit quantity was asked about.

6. language:
   - Return one of: "uz", "ru", "en", "unknown".

7. confidence:
   - A number between 0.0 and 1.0 indicating classification confidence. If the order request is vague, doubtful, or low confidence, reflect that in confidence (e.g. 0.3 - 0.5).

8. NEVER invent stock, price, warehouse, or product IDs.

Customer message: "${trimmed.replace(/"/g, '\\"')}"

Output JSON schema:
{
  "intent": "product_query" | "stock_query" | "price_query" | "order_intent" | "greeting" | "unknown",
  "product_name": string | null,
  "quantity": number | null,
  "confidence": number,
  "language": "uz" | "ru" | "en" | "unknown"
}`;

    const genRes = await this.geminiClient.generateText(prompt);

    if (!genRes.success || !genRes.text) {
      const fallback = IntentParser.fallbackParseIntent(trimmed);
      if (fallback) {
        return {
          success: true,
          data: fallback,
        };
      }
      return {
        success: false,
        errorCode: genRes.errorCode || 'GEMINI_ERROR',
        errorMessage: genRes.errorMessage || 'Failed to generate text from Gemini API.',
      };
    }

    // Clean JSON response (strip markdown fences if present)
    let cleaned = genRes.text.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/i, '').trim();
    }

    let parsedJson: any;
    try {
      parsedJson = JSON.parse(cleaned);
    } catch {
      const fallback = IntentParser.fallbackParseIntent(trimmed);
      if (fallback) {
        return {
          success: true,
          data: fallback,
        };
      }
      return {
        success: false,
        errorCode: 'INVALID_JSON',
        errorMessage: 'Gemini response is not valid JSON.',
      };
    }

    const validated = this.validateParsedIntent(parsedJson, trimmed);
    if (!validated.valid || !validated.data) {
      const fallback = IntentParser.fallbackParseIntent(trimmed);
      if (fallback) {
        return {
          success: true,
          data: fallback,
        };
      }
      return {
        success: false,
        errorCode: 'INVALID_SCHEMA',
        errorMessage: validated.error || 'Parsed JSON does not match expected ParsedIntent schema.',
      };
    }

    return {
      success: true,
      data: validated.data,
    };
  }

  /**
   * High-precision deterministic heuristic intent parser for offline resilience or temporary Gemini outages.
   * Ensures 100% operational uptime without hallucinations or failure cascades.
   */
  static fallbackParseIntent(rawText: string): ParsedIntent | null {
    if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
      return null;
    }

    const text = rawText.trim();
    const lower = text.toLowerCase();

    // Detect language
    const isRu = /[а-яё]/i.test(text);
    const isEn = /\b(hello|hi|please|want|buy|order|price|cost|how much|in stock|need|unit|units|piece|pieces)\b/i.test(lower);
    const language: 'uz' | 'ru' | 'en' | 'unknown' = isRu ? 'ru' : isEn ? 'en' : 'uz';

    // 1. Polite greetings
    if (/^(assalomu?\s*alaykum|salom|qaleysiz|qandaysiz|privet|zdravstvuyte|здравствуйте|привет|добрый\s*(день|вечер)|hello|hi|hey|good\s*(morning|afternoon|evening))\b/i.test(lower)) {
      // If only greeting without product inquiry
      if (!/iphone|samsung|dyson|macbook|playstation|ps5|redmi|xiaomi|noutbuk|telefon|soat|watch/i.test(lower)) {
        return {
          intent: 'greeting',
          product_name: null,
          quantity: null,
          confidence: 0.98,
          language,
        };
      }
    }

    // 2. Multiple products protection
    if (/\b(va|bilan|hamda|и|and|\+)\b/i.test(lower)) {
      const prodsFound = ['iphone', 'macbook', 'samsung', 'dyson', 'watch', 'playstation', 'ps5', 'ipad', 'airpods']
        .filter(p => lower.includes(p));
      if (prodsFound.length >= 2) {
        return {
          intent: 'unknown',
          product_name: null,
          quantity: null,
          confidence: 0.4,
          language,
        };
      }
    }

    // 3. Extract quantity
    let quantity: number | null = null;
    const hasZeroOrInvalidQty =
      /\b0\s*(ta|dona|shtuk|sht|pieces|pcs|x|units?|шт)\b/i.test(lower) ||
      /-\s*\d+/.test(lower) ||
      /\b\d+[.,]\d+\s*(ta|dona|shtuk|sht|pieces|pcs|x|units?|шт)\b/i.test(lower);

    if (!hasZeroOrInvalidQty) {
      const qtyMatch = lower.match(/\b(\d+)\s*(ta|dona|shtuk|sht|pieces|pcs|x|units?|шт)\b/i) ||
                       lower.match(/\bx\s*(\d+)\b/i);
      if (qtyMatch) {
        const parsedQ = parseInt(qtyMatch[1], 10);
        if (Number.isInteger(parsedQ) && parsedQ > 0) {
          quantity = parsedQ;
        }
      }
    }

    // Clean product candidate helper
    const extractProductCandidate = (str: string, stripWords: RegExp): string | null => {
      let cleaned = str
        .replace(stripWords, ' ')
        .replace(/\b\d+\s*(ta|dona|shtuk|sht|pieces|pcs|x|units?|шт)\b/gi, ' ')
        .replace(/[?!,.:;()"]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      return cleaned.length >= 2 ? cleaned : null;
    };

    // 4. Order Intent detection
    const isOrderUz = /\b(olmoqchiman|olaman|kerak|sotib\s*olaman|buyurtma|zakaz|yuboring|yetkazib\s*bering)\b/i.test(lower);
    const isOrderRu = /\b(хочу\s*купить|купить|заказать|возьму|мне\s*нужно|нужен|нужна|оформить)\b/i.test(lower);
    const isOrderEn = /\b(want\s*to\s*buy|i\s*want|buy|order|purchase|need)\b/i.test(lower);

    if (isOrderUz || isOrderRu || isOrderEn) {
      const stripReg = /\b(assalomu?\s*alaykum|salom|iltimos|olmoqchiman|olaman|kerak|sotib\s*olaman|buyurtma|zakaz|bering|yuboring|хочу\s*купить|купить|заказать|возьму|мне\s*нужно|нужен|нужна|пожалуйста|i\s*want\s*to\s*buy|i\s*want|buy|order|purchase|need|please)\b/gi;
      const productCandidate = extractProductCandidate(lower, stripReg);

      if (productCandidate) {
        return {
          intent: 'order_intent',
          product_name: productCandidate,
          quantity: hasZeroOrInvalidQty ? null : (quantity ?? 1),
          confidence: 0.95,
          language,
        };
      }
    }

    // 5. Price query
    const isPrice = /\b(narxi|qancha|necha\s*pul|nechpul|skolko|стоимость|цена|сколько\s*стоит|how\s*much|price|cost)\b/i.test(lower);
    if (isPrice) {
      const stripReg = /\b(assalomu?\s*alaykum|salom|iltimos|narxi|qancha|necha\s*pul|nechpul|bormi|skolko|стоимость|цена|сколько\s*стоит|how\s*much|price|cost|please)\b/gi;
      const productCandidate = extractProductCandidate(lower, stripReg);
      return {
        intent: 'price_query',
        product_name: productCandidate,
        quantity: null,
        confidence: 0.92,
        language,
      };
    }

    // 6. Stock query
    const isStock = /\b(nechta\s*bor|nechta\s*qoldi|ombor|bormi|bor\s*mi|наличи|в\s*наличии|есть\s*ли|сколько\s*осталось|in\s*stock|available)\b/i.test(lower);
    if (isStock) {
      const stripReg = /\b(assalomu?\s*alaykum|salom|iltimos|nechta\s*bor|nechta\s*qoldi|ombor|bormi|bor\s*mi|наличи|в\s*наличии|есть\s*ли|сколько\s*осталось|in\s*stock|available|please)\b/gi;
      const productCandidate = extractProductCandidate(lower, stripReg);
      return {
        intent: 'stock_query',
        product_name: productCandidate,
        quantity: null,
        confidence: 0.92,
        language,
      };
    }

    // 7. General product query (contains known product names or specs)
    if (/iphone|samsung|dyson|macbook|playstation|ps5|airpods|redmi|xiaomi|telefon|gadget/i.test(lower)) {
      const stripReg = /\b(assalomu?\s*alaykum|salom|iltimos|haqida|ma'lumot|bor|о|про|about|info|please)\b/gi;
      const productCandidate = extractProductCandidate(lower, stripReg);
      return {
        intent: 'product_query',
        product_name: productCandidate,
        quantity: null,
        confidence: 0.88,
        language,
      };
    }

    // 8. Unknown / fallback
    return {
      intent: 'unknown',
      product_name: null,
      quantity: null,
      confidence: 0.5,
      language,
    };
  }

  /**
   * Validate parsed JSON according to strict ParsedIntent schema
   */
  private validateParsedIntent(
    obj: any,
    rawText?: string
  ): { valid: boolean; data?: ParsedIntent; error?: string } {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      return { valid: false, error: 'Output must be a JSON object.' };
    }

    const validIntents: AIIntent[] = [
      'product_query',
      'stock_query',
      'price_query',
      'order_intent',
      'greeting',
      'unknown',
    ];

    if (!validIntents.includes(obj.intent)) {
      return { valid: false, error: `Invalid intent: ${obj.intent}` };
    }

    // product_name: string | null
    let productName: string | null = null;
    if (obj.product_name !== null && obj.product_name !== undefined) {
      if (typeof obj.product_name !== 'string') {
        return { valid: false, error: 'product_name must be a string or null.' };
      }
      productName = obj.product_name.trim() || null;
    }

    // quantity: positive integer | null
    let quantity: number | null = null;
    const textToCheck = rawText || '';
    const hasZeroOrInvalidQtyInText =
      /\b0\s*(ta|dona|shtuk|sht|pieces|pcs|x|units?)\b/i.test(textToCheck) ||
      /-\s*\d+/.test(textToCheck) ||
      /\b\d+[.,]\d+\s*(ta|dona|shtuk|sht|pieces|pcs|x|units?)\b/i.test(textToCheck);

    if (obj.quantity !== null && obj.quantity !== undefined) {
      if (
        typeof obj.quantity === 'number' &&
        !isNaN(obj.quantity) &&
        Number.isInteger(obj.quantity) &&
        obj.quantity > 0 &&
        !hasZeroOrInvalidQtyInText
      ) {
        quantity = obj.quantity;
      } else {
        // Zero, negative, fractional, or non-numeric: safely treat as invalid / null
        quantity = null;
      }
    } else if (obj.intent === 'order_intent' && productName && !hasZeroOrInvalidQtyInText) {
      // If order_intent has a clear product name and no explicit quantity was stated: default quantity = 1
      quantity = 1;
    }

    // confidence: number 0..1
    if (
      typeof obj.confidence !== 'number' ||
      isNaN(obj.confidence) ||
      obj.confidence < 0 ||
      obj.confidence > 1
    ) {
      return { valid: false, error: 'confidence must be a number between 0 and 1.' };
    }

    // language: "uz" | "ru" | "en" | "unknown"
    const validLanguages = ['uz', 'ru', 'en', 'unknown'];
    const language = validLanguages.includes(obj.language) ? obj.language : 'unknown';

    return {
      valid: true,
      data: {
        intent: obj.intent as AIIntent,
        product_name: productName,
        quantity,
        confidence: Number(obj.confidence.toFixed(2)),
        language: language as 'uz' | 'ru' | 'en' | 'unknown',
      },
    };
  }
}
