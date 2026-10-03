import { CustomerSalesSignals } from './salesSignals';
import { CustomerSalesInsight } from './salesInsight';
import { SalesAssistantActionType } from './salesAction';

/**
 * 7 Canonical Customer Segments defined in M7.1 Architecture
 */
export type CustomerSegmentType =
  | 'new_customer'
  | 'interested'
  | 'high_intent'
  | 'active_buyer'
  | 'repeat_customer'
  | 'inactive_customer'
  | 'cancelled_customer';

export const ALL_CUSTOMER_SEGMENT_TYPES: readonly CustomerSegmentType[] = [
  'new_customer',
  'interested',
  'high_intent',
  'active_buyer',
  'repeat_customer',
  'inactive_customer',
  'cancelled_customer',
] as const;

/**
 * Human-readable labels in Uzbek for UI and reporting
 */
export const CUSTOMER_SEGMENT_LABELS: Record<CustomerSegmentType, string> = {
  new_customer: 'Yangi mijoz',
  interested: 'Qiziqayotgan mijoz',
  high_intent: 'Yuqori xarid niyati',
  active_buyer: 'Faol xaridor',
  repeat_customer: 'Doimiy xaridor',
  inactive_customer: 'Nofaol mijoz',
  cancelled_customer: 'Bekor qilingan xarid',
};

/**
 * M7 Customer Segmentation Input Contract
 */
export interface CustomerSegmentationInput {
  customerId: string;
  businessId: string;
  signals?: CustomerSalesSignals | null;
  insight?: CustomerSalesInsight | null;
  now?: number;
  options?: {
    inactiveThresholdDays?: number; // Default 30 days
    repeatPurchaseCycleDays?: number; // Default 21 days
  };
}

/**
 * M7 Customer Segmentation Output Contract
 */
export interface CustomerSegmentationResult {
  customerId: string;
  businessId: string;
  segment: CustomerSegmentType;
  score: number; // 0 - 100
  confidence: number; // 0.0 - 1.0
  reasons: string[];
  signals: string[];
  recommendedAction: SalesAssistantActionType;
  calculatedAt: number;
  metadata?: {
    totalOrders: number;
    totalSpent: number;
    lastOrderAt: number | null;
    lastInteractionAt: number | null;
  };
}

/**
 * Validation return structure
 */
export interface CustomerSegmentationValidationResult {
  isValid: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}
