import { CustomerSalesInsight } from '../../src/types/salesInsight';
import {
  SalesRecommendation,
  SalesRecommendationAction
} from '../../src/types/salesRecommendation';
import {
  validateSalesRecommendation,
  VALID_RECOMMENDATION_ACTIONS
} from './salesRecommendation';
import { GeminiClient } from '../ai/geminiClient';

export const FALLBACK_RECOMMENDATION: SalesRecommendation = {
  action: 'no_action',
  reason: 'Deterministik zaxira: maʼlumot yetarli emas yoki tahlil natijasi mavjud emas',
  confidence: 0,
};

/**
 * Builds the strict, zero-hallucination prompt for Gemini.
 */
export function buildRecommendationPrompt(insight: CustomerSalesInsight): string {
  const safeData = {
    customerId: insight.customerId || 'unknown',
    businessId: insight.businessId || 'unknown',
    intentLevel: insight.intentLevel || 'low',
    intentScore: typeof insight.intentScore === 'number' ? insight.intentScore : 0,
    signals: Array.isArray(insight.signals) ? insight.signals : [],
    totalOrders: insight.totalOrders || 0,
    completedOrders: insight.completedOrders || 0,
    cancelledOrders: insight.cancelledOrders || 0,
    totalSpent: insight.totalSpent || 0,
    lastOrderAt: insight.lastOrderAt || null,
    lastInteractionAt: insight.lastInteractionAt || null,
  };

  return `Siz savdo bo'yicha aqlli yordamchisiz. Quyidagi mijozning savdo ko'rsatkichlari (CustomerSalesInsight) asosida do'kon administratori uchun ENG MOS bitta tavsiya (SalesRecommendation) tanlang.

MIJOZ MA'LUMOTLARI:
${JSON.stringify(safeData, null, 2)}

QAT'IY QOIDALAR:
1. Faqat yuqorida berilgan structured ma'lumotlardan foydalaning.
2. Agar ma'lumot yo'q yoki yetarli bo'lmasa, hech narsani TAXMIN QILMANG.
3. Yangi mijoz, mahsulot yoki buyurtma faktlarini O'YLAB TOPMANG (hech qanday gallyutsinatsiya bo'lmasin).
4. Faqat va faqat quyidagi 6 ta "action"dan birini tanlang:
   - "follow_up" (mijoz qiziqish bildirgan, javob kutmoqda yoki muloqotni davom ettirish kerak bo'lganda)
   - "product_recommendation" (mijoz tovar so'ragan yoki mahsulot bo'yicha tavsiya kerak bo'lganda)
   - "price_follow_up" (mijoz narx so'ragan, narxga bog'liq savollar bo'lganda)
   - "order_follow_up" (faol buyurtmasi mavjud bo'lganda)
   - "repeat_purchase" (doimiy xaridor, avval buyurtma olgan va yangi xarid qilish ehtimoli bo'lganda)
   - "no_action" (tavsiya uchun yetarli signal yo'q, xarid niyati past yoki harakat talab etilmaganda)
5. "confidence" 0.0 dan 1.0 gacha bo'lgan raqam bo'lishi shart.
6. "reason" administrator tushunishi uchun o'zbek tilida qisqa, aniq va dalillarga asoslangan bo'lsin.
7. JAVOBNI FAQAT QUYIDAGI JSON FORMATIDA QAYTARING, hech qanday qo'shimcha matn yoki izoh yozmang:
{"action": "...", "reason": "...", "confidence": 0.85}`;
}

/**
 * Extracts and cleans JSON string from raw Gemini output (including markdown code blocks).
 */
export function extractJsonFromText(rawText: string): string {
  if (!rawText || typeof rawText !== 'string') return '';

  let text = rawText.trim();

  // Strip markdown code fences if present: ```json ... ``` or ``` ... ```
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/i, '');
    text = text.replace(/\s*```$/i, '');
    text = text.trim();
  }

  // Find the first '{' and last '}'
  const startIdx = text.indexOf('{');
  const endIdx = text.lastIndexOf('}');
  if (startIdx !== -1 && endIdx !== -1 && endIdx >= startIdx) {
    text = text.slice(startIdx, endIdx + 1);
  }

  return text;
}

/**
 * Parses and strictly validates Gemini response into SalesRecommendation.
 * Falls back to deterministic safe recommendation if parsing or validation fails.
 */
export function parseRecommendationResponse(rawText: string): SalesRecommendation {
  if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
    return { ...FALLBACK_RECOMMENDATION };
  }

  try {
    const cleanedJson = extractJsonFromText(rawText);
    const parsed = JSON.parse(cleanedJson);

    if (!parsed || typeof parsed !== 'object') {
      return { ...FALLBACK_RECOMMENDATION };
    }

    // Check action
    if (!VALID_RECOMMENDATION_ACTIONS.includes(parsed.action)) {
      return { ...FALLBACK_RECOMMENDATION };
    }

    // Check confidence: must be number between 0 and 1
    if (
      typeof parsed.confidence !== 'number' ||
      Number.isNaN(parsed.confidence) ||
      parsed.confidence < 0 ||
      parsed.confidence > 1
    ) {
      return { ...FALLBACK_RECOMMENDATION };
    }

    // Check reason: must be string
    const reason = typeof parsed.reason === 'string' && parsed.reason.trim() ? parsed.reason.trim() : '';
    if (!reason) {
      return { ...FALLBACK_RECOMMENDATION };
    }

    const candidate: SalesRecommendation = {
      action: parsed.action as SalesRecommendationAction,
      reason,
      confidence: parsed.confidence,
    };

    const validation = validateSalesRecommendation(candidate);
    if (!validation.isValid) {
      return { ...FALLBACK_RECOMMENDATION };
    }

    return candidate;
  } catch {
    return { ...FALLBACK_RECOMMENDATION };
  }
}

export class GeminiRecommendationGenerator {
  /**
   * Generates a validated SalesRecommendation using Gemini.
   * Pure advisory layer:
   * - Does NOT write to Firestore
   * - Does NOT create orders
   * - Does NOT mutate stock
   * - Does NOT change prices
   * - Does NOT send Telegram messages
   */
  public static async generateRecommendation(
    insight: CustomerSalesInsight,
    client?: GeminiClient
  ): Promise<SalesRecommendation> {
    if (!insight || !insight.customerId || !insight.businessId) {
      return { ...FALLBACK_RECOMMENDATION };
    }

    const gemini = client || GeminiClient.getInstance();

    if (!gemini.isConfigured()) {
      return {
        action: 'no_action',
        reason: 'AI xizmati (Gemini API) sozlanmagan, deterministik holat belgilandi',
        confidence: 0,
      };
    }

    const prompt = buildRecommendationPrompt(insight);
    const result = await gemini.generateText(prompt);

    if (!result.success || !result.text) {
      return {
        action: 'no_action',
        reason: `AI tahlilida nosozlik yuz berdi: ${result.errorMessage || 'nomaʼlum xatolik'}`,
        confidence: 0,
      };
    }

    return parseRecommendationResponse(result.text);
  }
}
