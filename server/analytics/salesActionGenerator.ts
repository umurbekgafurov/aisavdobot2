import { CustomerSalesInsight } from '../../src/types/salesInsight';
import { SalesRecommendation } from '../../src/types/salesRecommendation';
import { SalesAssistantAction } from '../../src/types/salesAction';
import {
  SalesActionService,
  isValidSalesAction
} from './salesActionContract';

export class SalesActionGenerator {
  /**
   * Generates a safe, professional suggested message text for admin review.
   * Anti-hallucination: Never invents products, discounts, or prices that were not verified.
   */
  public static generateSuggestedText(
    action: string,
    insight?: CustomerSalesInsight
  ): string {
    switch (action) {
      case 'order_follow_up':
        return 'Assalomu alaykum! Buyurtmangiz holati bo‘yicha xabar bermoqchimiz. Agar savollaringiz bo‘lsa, yordam berishdan mamnunmiz.';

      case 'price_follow_up':
        return 'Assalomu alaykum! Narxlar va mavjud takliflar bo‘yicha savollaringiz bormi? Sizga qulay variantlarni taqdim etishimiz mumkin.';

      case 'product_recommendation':
        return 'Assalomu alaykum! Qiziqayotgan mahsulotlaringiz bo‘yicha yangi variantlar va tavsiyalarimiz bor. Batafsil maʼlumot yuboraylikmi?';

      case 'repeat_purchase':
        return 'Assalomu alaykum! Do‘konimizning doimiy mijozi sifatida sizga xizmat ko‘rsatishdan mamnunmiz. Yangi kelgan mahsulotlarimiz bilan tanishib ko‘rasizmi?';

      case 'follow_up':
        return 'Assalomu alaykum! Murojaatingiz bo‘yicha yordam bera olamizmi? Qo‘shimcha savollaringiz bo‘lsa, mamnuniyat bilan javob beramiz.';

      case 'no_action':
      default:
        return '';
    }
  }

  /**
   * Pure advisory mapping:
   * (CustomerSalesInsight, SalesRecommendation) -> SalesAssistantAction
   *
   * Safety Constraints:
   * - No order creation
   * - No stock mutation
   * - No price mutation
   * - No automatic Telegram dispatch
   * - No Firestore mutation
   * - Strictly preserves tenant isolation (businessId + customerId)
   */
  public static generateAction(
    insight: CustomerSalesInsight | null | undefined,
    recommendation: SalesRecommendation | null | undefined
  ): SalesAssistantAction {
    // Missing or invalid insight
    if (
      !insight ||
      typeof insight !== 'object' ||
      !insight.customerId ||
      !insight.customerId.trim() ||
      !insight.businessId ||
      !insight.businessId.trim()
    ) {
      return SalesActionService.createFallbackAction(
        insight?.customerId || 'unknown',
        insight?.businessId || 'unknown',
        'Mijoz yoki do‘kon maʼlumotlari yetarli emas'
      );
    }

    const customerId = insight.customerId.trim();
    const businessId = insight.businessId.trim();

    // Missing or invalid recommendation
    if (
      !recommendation ||
      typeof recommendation !== 'object' ||
      !isValidSalesAction(recommendation.action) ||
      typeof recommendation.confidence !== 'number' ||
      Number.isNaN(recommendation.confidence) ||
      recommendation.confidence < 0 ||
      recommendation.confidence > 1 ||
      typeof recommendation.reason !== 'string' ||
      !recommendation.reason.trim()
    ) {
      return SalesActionService.createFallbackAction(
        customerId,
        businessId,
        'Tavsiya maʼlumotlari mavjud emas yoki formati noto‘g‘ri'
      );
    }

    const action = recommendation.action;
    const reason = recommendation.reason.trim();
    const confidence = recommendation.confidence;
    const suggestedText = SalesActionGenerator.generateSuggestedText(action, insight);

    return SalesActionService.createAction({
      action,
      customerId,
      businessId,
      reason,
      confidence,
      suggestedText,
    });
  }
}
