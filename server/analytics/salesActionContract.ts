import {
  SalesAssistantAction,
  SalesAssistantActionType
} from '../../src/types/salesAction';
import {
  VALID_RECOMMENDATION_ACTIONS,
  isValidRecommendationAction
} from './salesRecommendation';

export const VALID_SALES_ACTIONS: readonly SalesAssistantActionType[] =
  VALID_RECOMMENDATION_ACTIONS;

export function isValidSalesAction(
  action: unknown
): action is SalesAssistantActionType {
  return isValidRecommendationAction(action);
}

export function validateSalesAssistantAction(action: unknown): {
  isValid: boolean;
  error?: string;
} {
  if (!action || typeof action !== 'object') {
    return { isValid: false, error: 'Sales action must be an object' };
  }

  const a = action as Record<string, unknown>;

  // 1. Action type validation
  if (!isValidSalesAction(a.action)) {
    return {
      isValid: false,
      error: `Invalid sales action type: ${String(a.action)}`,
    };
  }

  // 2. customerId validation
  if (typeof a.customerId !== 'string' || !a.customerId.trim()) {
    return {
      isValid: false,
      error: 'customerId must be a non-empty string',
    };
  }

  // 3. businessId validation
  if (typeof a.businessId !== 'string' || !a.businessId.trim()) {
    return {
      isValid: false,
      error: 'businessId must be a non-empty string',
    };
  }

  // 4. reason validation
  if (typeof a.reason !== 'string' || !a.reason.trim()) {
    return {
      isValid: false,
      error: 'reason must be a non-empty string explaining the action',
    };
  }

  // 5. confidence validation (0 <= confidence <= 1)
  if (
    typeof a.confidence !== 'number' ||
    Number.isNaN(a.confidence) ||
    a.confidence < 0 ||
    a.confidence > 1
  ) {
    return {
      isValid: false,
      error: `confidence must be a number between 0 and 1 (inclusive), got: ${String(a.confidence)}`,
    };
  }

  // 6. suggestedText validation
  if (typeof a.suggestedText !== 'string') {
    return {
      isValid: false,
      error: 'suggestedText must be a string (can be empty string for no_action)',
    };
  }

  return { isValid: true };
}

export class SalesActionService {
  /**
   * Validates a SalesAssistantAction payload.
   */
  public static validate(action: unknown): { isValid: boolean; error?: string } {
    return validateSalesAssistantAction(action);
  }

  /**
   * Pure factory method to create a strongly typed SalesAssistantAction.
   * Safety:
   * - No order creation
   * - No stock mutation
   * - No price mutation
   * - No automatic Telegram dispatch
   * - No Firestore mutation
   */
  public static createAction(params: {
    action: SalesAssistantActionType;
    customerId: string;
    businessId: string;
    reason: string;
    confidence: number;
    suggestedText: string;
  }): SalesAssistantAction {
    const candidate: SalesAssistantAction = {
      action: params.action,
      customerId: params.customerId?.trim(),
      businessId: params.businessId?.trim(),
      reason: params.reason?.trim(),
      confidence: params.confidence,
      suggestedText: params.suggestedText ?? '',
    };

    const validation = validateSalesAssistantAction(candidate);
    if (!validation.isValid) {
      throw new Error(`Failed to create SalesAssistantAction: ${validation.error}`);
    }

    return candidate;
  }

  /**
   * Deterministic safe fallback action when data is missing or invalid.
   */
  public static createFallbackAction(
    customerId: string,
    businessId: string,
    reason: string = 'Harakat talab etilmaydi yoki tahlil maʼlumotlari yetarli emas'
  ): SalesAssistantAction {
    return {
      action: 'no_action',
      customerId: customerId || 'unknown',
      businessId: businessId || 'unknown',
      reason,
      confidence: 0,
      suggestedText: '',
    };
  }
}
