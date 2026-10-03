import { CustomerSalesSignals } from '../../src/types/salesSignals';
import { CustomerIntentScore } from '../../src/types/intentScore';
import { CustomerSalesInsight } from '../../src/types/salesInsight';
import { CustomerSalesSignalsService } from './customerSalesSignals';
import { CustomerIntentScoreService } from './customerIntentScore';

export class CustomerSalesInsightService {
  /**
   * Deterministic builder: Combines existing CustomerSalesSignals + CustomerIntentScore
   * into a unified CustomerSalesInsight without recalculating signals or scores.
   * Zero AI/Gemini calls.
   */
  public static buildSalesInsight(
    signals: CustomerSalesSignals,
    intentScore: CustomerIntentScore,
    generatedAt: number = Date.now()
  ): CustomerSalesInsight {
    if (!signals.customerId || !signals.businessId) {
      throw new Error('signals must have customerId and businessId');
    }
    if (signals.customerId !== intentScore.customerId || signals.businessId !== intentScore.businessId) {
      throw new Error('Tenant or customer mismatch between signals and intentScore');
    }

    return {
      customerId: signals.customerId,
      businessId: signals.businessId,

      intentLevel: intentScore.level,
      intentScore: intentScore.score,

      signals: intentScore.signals ? [...intentScore.signals] : [],

      totalOrders: signals.totalOrders || 0,
      completedOrders: signals.completedOrders || 0,
      cancelledOrders: signals.cancelledOrders || 0,
      totalSpent: signals.totalSpent || 0,

      lastOrderAt: signals.lastOrderAt ?? null,
      lastInteractionAt: signals.lastInteractionAt ?? null,

      generatedAt,
    };
  }

  /**
   * Backward-compatible alias for Part 1 mapping helper
   */
  public static mapToSalesInsight(
    signals: CustomerSalesSignals,
    intentScore: CustomerIntentScore,
    generatedAt: number = Date.now()
  ): CustomerSalesInsight {
    return this.buildSalesInsight(signals, intentScore, generatedAt);
  }

  /**
   * Orchestrator: Fetches signals and score using M6.2 and M6.3 services,
   * then builds the final CustomerSalesInsight.
   */
  public static async buildForCustomer(
    businessId: string,
    customerId: string,
    nowMs: number = Date.now()
  ): Promise<CustomerSalesInsight> {
    const signals = await CustomerSalesSignalsService.computeSignalsForCustomer(
      businessId,
      customerId
    );
    const intentScore = CustomerIntentScoreService.calculateScoreFromSignals(
      signals,
      nowMs
    );
    return this.buildSalesInsight(signals, intentScore, nowMs);
  }
}

