import { CustomerSalesSignals } from '../../src/types/salesSignals';
import { CustomerIntentLevel, CustomerIntentScore } from '../../src/types/intentScore';
import { CustomerSalesSignalsService } from './customerSalesSignals';

export const INTENT_SCORE_THRESHOLDS = {
  HIGH: 70,
  MEDIUM: 40,
} as const;

export const INTENT_SIGNAL_WEIGHTS = {
  ACTIVE_ORDER: 40,
  PURCHASE_INTENT: 30,
  REPEAT_CUSTOMER: 15,
  COMPLETED_ORDER: 10,
  PRODUCT_INQUIRY: 10,
  PRICE_INQUIRY: 8,
  STOCK_INQUIRY: 5,
  CANCELLED_ORDER: -10,
} as const;

export class CustomerIntentScoreService {
  /**
   * M6.3 Part 2: Deterministic calculation of CustomerIntentScore from CustomerSalesSignals.
   * Does NOT call external AI/Gemini.
   * Guarantees 0 <= score <= 100 and explainable signals array.
   */
  public static calculateScoreFromSignals(
    signals: CustomerSalesSignals,
    nowMs: number = Date.now()
  ): CustomerIntentScore {
    if (!signals.businessId || !signals.customerId) {
      throw new Error('businessId and customerId are required in sales signals');
    }

    let rawScore = 0;
    const contributingSignals: string[] = [];

    // Strong signals
    if (signals.hasActiveOrder) {
      rawScore += INTENT_SIGNAL_WEIGHTS.ACTIVE_ORDER;
      contributingSignals.push('active_order');
    }

    if (signals.purchaseIntentDetected) {
      rawScore += INTENT_SIGNAL_WEIGHTS.PURCHASE_INTENT;
      contributingSignals.push('purchase_intent_detected');
    }

    if (signals.isRepeatCustomer) {
      rawScore += INTENT_SIGNAL_WEIGHTS.REPEAT_CUSTOMER;
      contributingSignals.push('repeat_customer');
    }

    if (signals.hasCompletedOrder) {
      rawScore += INTENT_SIGNAL_WEIGHTS.COMPLETED_ORDER;
      contributingSignals.push('completed_order');
    }

    // Medium signals
    if (signals.productInquiryDetected) {
      rawScore += INTENT_SIGNAL_WEIGHTS.PRODUCT_INQUIRY;
      contributingSignals.push('product_inquiry_detected');
    }

    if (signals.priceInquiryDetected) {
      rawScore += INTENT_SIGNAL_WEIGHTS.PRICE_INQUIRY;
      contributingSignals.push('price_inquiry_detected');
    }

    if (signals.stockInquiryDetected) {
      rawScore += INTENT_SIGNAL_WEIGHTS.STOCK_INQUIRY;
      contributingSignals.push('stock_inquiry_detected');
    }

    // Negative signal
    if (signals.hasCancelledOrder) {
      rawScore += INTENT_SIGNAL_WEIGHTS.CANCELLED_ORDER;
      contributingSignals.push('cancelled_order');
    }

    // Clamping: max(0, min(100, score))
    const score = Math.max(0, Math.min(100, Math.round(rawScore)));

    // Level determination
    let level: CustomerIntentLevel = 'low';
    if (score >= INTENT_SCORE_THRESHOLDS.HIGH) {
      level = 'high';
    } else if (score >= INTENT_SCORE_THRESHOLDS.MEDIUM) {
      level = 'medium';
    }

    return {
      customerId: signals.customerId,
      businessId: signals.businessId,
      level,
      score,
      signals: contributingSignals,
      calculatedAt: nowMs,
    };
  }

  /**
   * Fetches customer sales signals via M6.2 service and generates intent score.
   */
  public static async calculateScoreForCustomer(
    businessId: string,
    customerId: string,
    nowMs: number = Date.now()
  ): Promise<CustomerIntentScore> {
    const signals = await CustomerSalesSignalsService.computeSignalsForCustomer(
      businessId,
      customerId
    );
    return this.calculateScoreFromSignals(signals, nowMs);
  }
}

