import {
  SalesRecommendation,
  SalesRecommendationAction
} from '../../src/types/salesRecommendation';

export const VALID_RECOMMENDATION_ACTIONS: readonly SalesRecommendationAction[] = [
  'follow_up',
  'product_recommendation',
  'price_follow_up',
  'order_follow_up',
  'repeat_purchase',
  'no_action',
] as const;

export function isValidRecommendationAction(
  action: unknown
): action is SalesRecommendationAction {
  return (
    typeof action === 'string' &&
    VALID_RECOMMENDATION_ACTIONS.includes(action as SalesRecommendationAction)
  );
}

export function validateSalesRecommendation(rec: unknown): {
  isValid: boolean;
  error?: string;
} {
  if (!rec || typeof rec !== 'object') {
    return { isValid: false, error: 'Recommendation must be an object' };
  }

  const r = rec as Record<string, unknown>;

  if (!isValidRecommendationAction(r.action)) {
    return {
      isValid: false,
      error: `Invalid recommendation action: ${String(r.action)}`,
    };
  }

  if (typeof r.reason !== 'string' || r.reason.trim() === '') {
    return { isValid: false, error: 'Reason must be a non-empty string' };
  }

  if (
    typeof r.confidence !== 'number' ||
    Number.isNaN(r.confidence) ||
    r.confidence < 0 ||
    r.confidence > 1
  ) {
    return {
      isValid: false,
      error: `Confidence must be a number between 0 and 1 (inclusive), got: ${String(r.confidence)}`,
    };
  }

  return { isValid: true };
}

export class SalesRecommendationService {
  /**
   * Validates recommendation payload against contract rules.
   */
  public static validate(recommendation: unknown): { isValid: boolean; error?: string } {
    return validateSalesRecommendation(recommendation);
  }

  /**
   * Safe factory to create a valid recommendation adhering to the contract.
   * Pure advisory object: does not trigger orders, telegram messages, or inventory changes.
   */
  public static createRecommendation(
    action: SalesRecommendationAction,
    reason: string,
    confidence: number
  ): SalesRecommendation {
    const candidate: SalesRecommendation = {
      action,
      reason: reason.trim(),
      confidence: Math.max(0, Math.min(1, confidence)),
    };

    const validation = validateSalesRecommendation(candidate);
    if (!validation.isValid) {
      throw new Error(`Failed to create valid SalesRecommendation: ${validation.error}`);
    }

    return candidate;
  }
}
