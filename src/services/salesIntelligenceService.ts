import { CustomerSalesSignalsService } from '../../server/analytics/customerSalesSignals';
import { CustomerIntentScoreService } from '../../server/analytics/customerIntentScore';
import { CustomerSalesInsightService } from '../../server/analytics/customerSalesInsight';
import { GeminiRecommendationGenerator } from '../../server/analytics/geminiRecommendationGenerator';
import { SalesActionGenerator } from '../../server/analytics/salesActionGenerator';
import { SalesActionService } from '../../server/analytics/salesActionContract';
import { Customer, Order, ConversationMessage } from '../types';
import { CustomerSalesInsight } from '../types/salesInsight';
import { SalesRecommendation } from '../types/salesRecommendation';
import { SalesAssistantAction } from '../types/salesAction';

export {
  CustomerSalesSignalsService,
  CustomerIntentScoreService,
  CustomerSalesInsightService,
  GeminiRecommendationGenerator,
  SalesActionGenerator,
  SalesActionService,
};

export class SalesIntelligenceService {
  /**
   * Computes CustomerSalesInsight deterministically in the client.
   * Guarantees strict tenant isolation by matching customer.businessId.
   */
  public static computeCustomerInsight(
    customer: Customer | null | undefined,
    orders: Order[],
    messages: ConversationMessage[] = []
  ): CustomerSalesInsight | null {
    if (!customer || !customer.id || !customer.businessId) {
      return null;
    }

    // Filter orders strictly for this customer and business
    const customerOrders = orders.filter((o) => {
      if (o.customerId !== customer.id) return false;
      if (o.businessId && o.businessId !== customer.businessId) return false;
      return true;
    });

    // Filter messages strictly for this customer and business
    const customerMessages = (messages || []).filter((m) => {
      if (m.customerId !== customer.id) return false;
      if (m.businessId && m.businessId !== customer.businessId) return false;
      return true;
    });

    try {
      const signals = CustomerSalesSignalsService.computeSignals({
        businessId: customer.businessId,
        customerId: customer.id,
        customer,
        orders: customerOrders,
        messages: customerMessages,
      });

      const intentScore = CustomerIntentScoreService.calculateScoreFromSignals(signals);
      return CustomerSalesInsightService.buildSalesInsight(signals, intentScore);
    } catch (err) {
      console.error('[SalesIntelligenceService] Error computing insight:', err);
      return null;
    }
  }

  /**
   * Generates AI recommendation on-demand for a single customer.
   * Does NOT call AI automatically for all customers.
   */
  public static async generateCustomerRecommendation(
    insight: CustomerSalesInsight
  ): Promise<SalesRecommendation> {
    return GeminiRecommendationGenerator.generateRecommendation(insight);
  }
}
