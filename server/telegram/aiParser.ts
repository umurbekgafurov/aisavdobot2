import { GoogleGenAI } from '@google/genai';
import { AIParserIntent, AIParserResult } from '../../src/types/crm';

export class AIParser {
  private static circuitBreakerUntil = 0;

  private static getGeminiClient(): GoogleGenAI | null {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return null;
    }
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }

  /**
   * Primary AI Parser:
   * Parses customer message into one of 6 exact intents:
   * - product_query
   * - stock_query
   * - price_query
   * - order_intent
   * - greeting
   * - unknown
   */
  static async parseIntent(messageText: string): Promise<AIParserResult> {
    if (!messageText || typeof messageText !== 'string' || !messageText.trim()) {
      return {
        intent: 'unknown',
        confidence: 0,
      };
    }

    const trimmed = messageText.trim();

    // 1. Fast circuit breaker: if external API recently hit quota or overload, skip wait
    if (Date.now() < this.circuitBreakerUntil) {
      return this.fallbackParse(trimmed);
    }

    // 2. Try Gemini AI Model ('gemini-3.8-flash') with 2500ms safety timeout
    const ai = this.getGeminiClient();
    if (ai) {
      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('AI generation timeout')), 2500)
        );

        const apiPromise = ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: `Siz O'zbekistondagi chakana savdo Telegram boti uchun xabarlarni tahlil qiluvchi AI Parsersiz.
Mijoz xabarini quyidagi 6 ta qat'iy intentdan biriga ajrating:
1. "product_query": Mahsulot qidirish, modellari, ranglari, funksiyalari, xususiyatlari yoki katalogi haqida so'rash.
2. "stock_query": Mahsulot omborda bormi, mavjudmi, yetib keldimi, nechta qolganini so'rash.
3. "price_query": Narxini, qancha turishini, to'lov yoki chegirmasini so'rash.
4. "order_intent": Xarid qilish, buyurtma berish, zakaz qilish, olaman deyish, yetkazib berishni so'rash.
5. "greeting": Salomlashish, /start buyrug'i, hol-ahvol so'rash.
6. "unknown": Tushunarsiz, mavzudan tashqari yoki boshqa xabarlar.

Mijoz xabari: "${trimmed}"

Faqat toza JSON formatida javob bering, hech qanday markdown belgilari (masalan, \`\`\`json) qo'shmang:
{
  "intent": "product_query" | "stock_query" | "price_query" | "order_intent" | "greeting" | "unknown",
  "confidence": 0.95,
  "productQuery": "agar mahsulot nomi yoki kalit so'z bo'lsa (masalan, iPhone 15 Pro, Samsung S25, Redmi Note 13)",
  "quantity": 1,
  "customerPhone": "agar telefon raqam yozilgan bo'lsa",
  "deliveryAddress": "agar manzil yozilgan bo'lsa"
}`,
        });

        const response: any = await Promise.race([apiPromise, timeoutPromise]);
        const rawText = response.text?.trim() || '';
        const cleanedJson = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanedJson);

        const validIntents: AIParserIntent[] = [
          'product_query',
          'stock_query',
          'price_query',
          'order_intent',
          'greeting',
          'unknown',
        ];

        if (validIntents.includes(parsed.intent)) {
          return {
            intent: parsed.intent as AIParserIntent,
            confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.9,
            productQuery: parsed.productQuery || this.extractProductKeywords(trimmed),
            quantity: typeof parsed.quantity === 'number' ? parsed.quantity : this.extractQuantity(trimmed),
            customerPhone: parsed.customerPhone || this.extractPhone(trimmed),
            deliveryAddress: parsed.deliveryAddress || this.extractAddress(trimmed),
            extractedKeywords: [parsed.productQuery, parsed.intent].filter(Boolean),
          };
        }
      } catch (geminiErr: any) {
        // Activate circuit breaker for 30s so subsequent requests don't wait on timeouts
        this.circuitBreakerUntil = Date.now() + 30000;
        console.warn('[AIParser] Gemini fallback active:', geminiErr?.message?.slice(0, 100) || 'circuit breaker active');
      }
    }

    // 3. High-precision deterministic fallback parser (offline / resilient)
    return this.fallbackParse(trimmed);
  }

  /**
   * Deterministic Semantic Rule-Based Parser
   */
  static fallbackParse(text: string): AIParserResult {
    const lower = text.toLowerCase();
    const phone = this.extractPhone(text);
    const quantity = this.extractQuantity(text);
    const productQuery = this.extractProductKeywords(text);
    const address = this.extractAddress(text);

    // 1. Greeting
    if (
      lower === '/start' ||
      lower.startsWith('/start ') ||
      lower.includes('assalom') ||
      lower.includes('salom') ||
      lower.includes('qalaysiz') ||
      lower.includes('hayrli kun') ||
      lower.includes('privet') ||
      lower.includes('zdravstvuyte')
    ) {
      // If greeting has no product query and no direct purchase action, it is greeting
      if (!productQuery && !lower.includes('olaman') && !lower.includes('zakaz') && !lower.includes('narx')) {
        return {
          intent: 'greeting',
          confidence: 0.95,
        };
      }
    }

    // 2. Order Intent
    const orderKeywords = [
      'olaman',
      'olmoqchiman',
      'buyurtma',
      'zakaz',
      'sotib olaman',
      'sotib olmoqchiman',
      'beraman',
      'bermoqchiman',
      'yetkazib bering',
      'dostavka qiling',
      'jo\'nating',
      'yuboring',
      'zakazat',
      'kuplyu',
      'kupit',
    ];
    for (const kw of orderKeywords) {
      if (lower.includes(kw)) {
        return {
          intent: 'order_intent',
          confidence: 0.9,
          productQuery,
          quantity,
          customerPhone: phone,
          deliveryAddress: address,
        };
      }
    }

    // 3. Price Query
    const priceKeywords = [
      'narxi',
      'narx',
      'qancha',
      'qanchadan',
      'necha pul',
      'nechapul',
      'nechpul',
      'so\'m',
      'som',
      'skolko',
      'tsena',
      'stoit',
      'chegirma',
      'skidka',
    ];
    for (const kw of priceKeywords) {
      if (lower.includes(kw)) {
        return {
          intent: 'price_query',
          confidence: 0.88,
          productQuery,
          quantity,
        };
      }
    }

    // 4. Stock Query
    const stockKeywords = [
      'bormi',
      'mavjudmi',
      'omborda',
      'qoldiq',
      'qoldimi',
      'yetib keldimi',
      'keldimi',
      'bor mi',
      'est li',
      'v nalichii',
      'nalichie',
      'nechta bor',
      'nechta qoldi',
    ];
    for (const kw of stockKeywords) {
      if (lower.includes(kw)) {
        return {
          intent: 'stock_query',
          confidence: 0.88,
          productQuery,
          quantity,
        };
      }
    }

    // 5. Product Query (Asking about models, specs, colors, options, catalog)
    const productSpecKeywords = [
      'xususiyati',
      'rangi',
      'qora',
      'oq',
      'pro max',
      'katalog',
      'telefonlar',
      'gadjet',
      'smartfon',
      'tavsifi',
      'xarakteristika',
      'parametr',
    ];
    const hasSpecWord = productSpecKeywords.some((w) => lower.includes(w));
    if (productQuery || hasSpecWord) {
      return {
        intent: 'product_query',
        confidence: 0.8,
        productQuery: productQuery || text.slice(0, 40),
        quantity,
      };
    }

    // 6. Unknown
    return {
      intent: 'unknown',
      confidence: 0.5,
      notes: 'No specific keywords matched',
    };
  }

  private static extractPhone(text: string): string | undefined {
    const phoneRegex = /(?:\+?998|8)?[\s-]?\(?\d{2}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}/;
    const match = text.match(phoneRegex);
    return match ? match[0].replace(/\s+/g, '') : undefined;
  }

  private static extractQuantity(text: string): number {
    const qtyRegex = /(\d+)\s*(ta|dona|shtuk|sht|d|x)\b/i;
    const match = text.match(qtyRegex);
    if (match) {
      const q = parseInt(match[1], 10);
      if (!isNaN(q) && q > 0) return q;
    }
    return 1;
  }

  private static extractProductKeywords(text: string): string | undefined {
    const knownBrands = [
      'samsung',
      'galaxy',
      'iphone',
      'apple',
      'redmi',
      'xiaomi',
      'poco',
      'macbook',
      'airpods',
      'ipad',
      'honor',
      'vivo',
      'oppo',
      'huawei',
      'playstation',
      'ps5',
    ];

    const lower = text.toLowerCase();
    for (const b of knownBrands) {
      if (lower.includes(b)) {
        // Find brand and following model tokens
        const regex = new RegExp(`\\b(${b}[a-z0-9\\s\\+\\-]{0,25})`, 'i');
        const m = text.match(regex);
        if (m) return m[1].trim();
      }
    }
    return undefined;
  }

  private static extractAddress(text: string): string | undefined {
    const lower = text.toLowerCase();
    const cityMarkers = [
      'toshkent',
      'yunusobod',
      'chilonzor',
      'mirobod',
      'mirzo ulug\'bek',
      'sergeli',
      'samarqand',
      'buxoro',
      'andijon',
      'namangan',
      'farg\'ona',
      'viloyat',
      'ko\'cha',
      'dom',
      'kvartira',
    ];
    for (const marker of cityMarkers) {
      if (lower.includes(marker)) {
        const idx = lower.indexOf(marker);
        return text.slice(idx, idx + 45).trim();
      }
    }
    return undefined;
  }
}
